import { afterEach, describe, expect, it, vi } from 'vitest';

import { createReasoningEngine } from './reasoning-engine.mjs';

const adminContext = {
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

const viewerContext = {
  ...adminContext,
  roles: ['viewer'],
};

function createStore(overrides = {}) {
  return {
    getOverview: async () => ({ metrics: [], alerts: [], queueBacklog: 482, runningAgents: 42, healthyServices: 11, liveEventsPerMinute: 146 }),
    getAnalytics: async () => ({ kpis: [{ label: 'Gross volume', value: '$2.1M' }], tenantGrowth: [], toolUsageByDomain: [{ label: 'Research' }] }),
    listAgents: async () => [{ name: 'Finance Insights Agent', state: 'throttled', queueDepth: 18, decisionsToday: 41 }],
    listEvents: async () => [{ summary: 'Demand spike detected', type: 'signal_detected' }],
    getObservability: async () => [{ name: 'Gateway API', status: 'degraded', cpuPercent: 88, restarts24h: 2 }],
    listMemory: async () => [{ id: 'tenant:acme', vectorCount: 1220 }],
    listModels: async () => [{ key: 'planner', activeModel: 'llama3.1', provider: 'ollama', latencyMs: 540, errorRate: 0.02 }],
    listTools: async () => [{ name: 'knowledge-graph.read', riskLevel: 'high' }],
    getKnowledgeGraph: async () => ({ nodes: [{ label: 'HVAC Leads', type: 'category', score: 0.91 }], edges: [{ label: 'demand > supply', source: 'Dallas', target: 'HVAC Leads', strength: 0.83 }] }),
    ...overrides,
  };
}

describe('reasoning engine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns structured plan output with explicit tool invocations', async () => {
    const engine = createReasoningEngine({ store: createStore() });

    const result = await engine.execute({
      message: 'Plan how to safely expand tool access',
      history: [],
      pathname: '/tools',
      route: 'analyze',
    }, adminContext);

    expect(result.mode).toBe('plan');
    expect(result.intent).toBe('tooling');
    expect(result.structuredOutput.actions[0]?.title).toBe('Validate tool contracts');
    expect(result.toolCalls.map((tool) => tool.tool)).toEqual(expect.arrayContaining(['control.read.tools', 'control.read.models']));
  });

  it('respects mixed reasoning-tool permissions for viewer roles', async () => {
    const engine = createReasoningEngine({ store: createStore() });

    const result = await engine.execute({
      message: 'Plan how to safely expand tool access',
      history: [],
      pathname: '/tools',
      route: 'analyze',
    }, viewerContext);

    expect(result.toolCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'control.read.tools', status: 'completed' }),
      expect.objectContaining({ tool: 'control.read.models', status: 'blocked' }),
    ]));
  });

  it('falls back to local reasoning when the remote provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider offline')));
    const engine = createReasoningEngine({
      store: createStore(),
      config: { reasoningProvider: 'ollama', reasoningApiUrl: 'http://ollama.local', reasoningModel: 'llama3.1' },
    });

    const result = await engine.execute({
      message: 'Summarize service health',
      history: [],
      pathname: '/observability',
      route: 'analyze',
    }, adminContext);

    expect(result.provider.name).toBe('ollama');
    expect(result.degraded).toBe(true);
    expect(result.content).toContain('Summary for: Summarize service health');
  });

  it('incorporates memory context into structured findings', async () => {
    const engine = createReasoningEngine({ store: createStore() });

    const result = await engine.execute({
      message: 'What should I prioritize?',
      history: [],
      route: 'recommend',
      memoryContext: {
        summary: 'Loaded memory.',
        items: [{ id: 'ctx_1', documentId: 'doc_1', sourceType: 'research_note', title: 'Prior demand memo', snippet: 'Demand was elevated in Mumbai.', score: 0.82, metadata: {}, createdAt: '2026-03-09T10:00:00.000Z' }],
        preferences: [{ id: 'pref_1', key: 'response_style', value: 'concise', sampleCount: 1, updatedAt: '2026-03-09T10:00:00.000Z' }],
        conversation: [{ id: 'turn_1', documentId: 'doc_turn_1', sessionId: 'assistant-history:owner:platform-root:control-dashboard', tenantId: 'platform-root', appId: 'control-dashboard', userId: 'owner', userMessage: 'Show supply gaps', assistantMessage: 'Mumbai is hottest.', toolCalls: [], createdAt: '2026-03-09T10:00:00.000Z' }],
        agentExperiences: [{ id: 'xp_1', agentId: 'agent_growth_01', outcome: 'success', summary: 'Escalated quickly.', sampleCount: 1, createdAt: '2026-03-09T10:00:00.000Z', metadata: {} }],
      },
    }, adminContext);

    expect(result.structuredOutput.findings.join(' ')).toContain('Operator preference');
    expect(result.structuredOutput.findings.join(' ')).toContain('Relevant long-term memory');
    expect(result.structuredOutput.actions.map((item) => item.title)).toContain('Apply prior agent learning');
  });
});