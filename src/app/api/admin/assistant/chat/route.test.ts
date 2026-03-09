import { beforeEach, describe, expect, it, vi } from 'vitest';

const controlPlaneMocks = vi.hoisted(() => ({
  getKnowledgeGraph: vi.fn(async () => ({
    nodes: [
      {
        id: 'category:farm',
        type: 'category',
        label: 'Farm Equipment',
        metadata: 'High demand category',
        description: 'Rising demand in Mumbai.',
        tags: ['category', 'demand-surge'],
        score: 0.88,
        health: 'healthy',
      },
      {
        id: 'location:mumbai',
        type: 'location',
        label: 'Mumbai',
        metadata: 'High demand metro',
        description: 'Demand hotspot.',
        tags: ['location', 'high-demand'],
        score: 0.87,
        health: 'degraded',
      },
      {
        id: 'vendor:novafoods',
        type: 'vendor',
        label: 'Nova Foods',
        metadata: 'Vendor / tenant_nova',
        description: 'Supply-rich vendor.',
        tags: ['vendor', 'supply-rich'],
        score: 0.82,
        health: 'healthy',
      },
      {
        id: 'listing:tractor301',
        type: 'listing',
        label: 'Tractor Listing 301',
        metadata: 'Marketplace listing',
        description: 'Primary listing in the cluster.',
        tags: ['listing'],
        score: 0.75,
        health: 'healthy',
      },
      {
        id: 'agent:growth',
        type: 'agent',
        label: 'Growth Agent',
        metadata: 'Monitors supply gaps',
        description: 'Supply-demand mismatch agent.',
        tags: ['agent', 'growth'],
        score: 0.94,
        health: 'healthy',
      },
    ],
    edges: [],
  })),
  getAgents: vi.fn(async () => ({
    items: [
      {
        id: 'agent_finance',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        name: 'Finance Insights Agent',
        state: 'throttled',
        queue: 'finance-analytics',
        queueDepth: 8,
        budgetUsd: 450,
        budgetUtilizationPercent: 79,
        avgLatencyMs: 1180,
        tokenUsage1h: 162000,
        decisionsToday: 22,
        workflowVersion: 'wf.finance.v7',
        lastTask: 'Prepared monthly margin projection.',
        orchestration: { stage: 'reason', autonomyLevel: 'supervised' },
        dependencies: [],
        decisions: [
          {
            id: 'dec_1',
            summary: 'Throttle long-form reasoning until margin baseline stabilizes.',
            rationale: 'Budget usage touched 79% while backlog remains above target.',
            confidence: 0.81,
            outcome: 'blocked',
            timestamp: '2026-03-08T13:40:00.000Z',
          },
        ],
        logs: [],
        tasks: [],
        runs: [],
      },
      {
        id: 'agent_growth',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        name: 'Growth Agent',
        state: 'running',
        queue: 'growth-signals',
        queueDepth: 11,
        budgetUsd: 300,
        budgetUtilizationPercent: 68,
        avgLatencyMs: 942,
        tokenUsage1h: 128000,
        decisionsToday: 14,
        workflowVersion: 'wf.growth.v4',
        lastTask: 'Detected supply gap in agri-implements.',
        orchestration: { stage: 'observe', autonomyLevel: 'autonomous' },
        dependencies: [],
        decisions: [],
        logs: [],
        tasks: [],
        runs: [],
      },
    ],
  })),
  getEvents: vi.fn(async () => ({
    items: [
      {
        id: 'evt_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        type: 'agent_triggered',
        actor: 'Growth Agent',
        summary: 'Growth agent triggered after demand anomaly crossed threshold.',
        timestamp: '2026-03-08T13:44:00.000Z',
      },
    ],
  })),
  getObservability: vi.fn(async () => ({ items: [] })),
}));

const aiGatewayMocks = vi.hoisted(() => {
  class MockAiGatewayServiceError extends Error {
    constructor(message = 'AI gateway failed') {
      super(message);
      this.name = 'AiGatewayServiceError';
    }
  }

  return {
    isConfigured: vi.fn(() => false),
    analyze: vi.fn(),
    command: vi.fn(),
    research: vi.fn(),
    recommend: vi.fn(),
    AiGatewayServiceError: MockAiGatewayServiceError,
  };
});

const memoryMocks = vi.hoisted(() => ({
  isConfigured: vi.fn(() => false),
  retrieveContext: vi.fn(async () => ({ summary: '', items: [], preferences: [], conversation: [], agentExperiences: [] })),
  saveConversationTurn: vi.fn(async () => ({ items: [] })),
  upsertPreferences: vi.fn(async () => ({ items: [] })),
}));

vi.mock('@/services/control-plane', () => ({
  controlPlaneService: controlPlaneMocks,
}));

vi.mock('@/services/ai-gateway', () => ({
  aiGatewayService: {
    isConfigured: aiGatewayMocks.isConfigured,
    analyze: aiGatewayMocks.analyze,
    command: aiGatewayMocks.command,
    research: aiGatewayMocks.research,
    recommend: aiGatewayMocks.recommend,
  },
  AiGatewayServiceError: aiGatewayMocks.AiGatewayServiceError,
}));

vi.mock('@/services/memory', () => ({
  memoryService: {
    isConfigured: memoryMocks.isConfigured,
    retrieveContext: memoryMocks.retrieveContext,
    saveConversationTurn: memoryMocks.saveConversationTurn,
    upsertPreferences: memoryMocks.upsertPreferences,
  },
}));

import { POST } from '@/app/api/admin/assistant/chat/route';
import { createSession, resetAuthStateForTests, SESSION_COOKIE } from '@/lib/auth';
import { resetDashboardEnvForTests } from '@/lib/env';
import type { SessionUser } from '@/types/platform';

const platformOwner: SessionUser = {
  userId: 'owner',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

const viewer: SessionUser = {
  userId: 'viewer',
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  name: 'Viewer',
  email: 'viewer@test.local',
  roles: ['viewer'],
};

function createRequest(token: string, body: unknown, url = 'https://dashboard.local/api/admin/assistant/chat') {
  return {
    cookies: {
      get(name: string) {
        return name === SESSION_COOKIE ? { value: token } : undefined;
      },
    },
    nextUrl: new URL(url),
    json: async () => body,
  } as never;
}

describe('assistant chat route', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    aiGatewayMocks.isConfigured.mockReturnValue(false);
    memoryMocks.isConfigured.mockReturnValue(false);
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.CONTROL_PLANE_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
    resetDashboardEnvForTests();
    await resetAuthStateForTests();
  });

  it('answers supply gap questions with read-only control-plane tool calls', async () => {
    const { token } = await createSession(platformOwner);

    const response = await POST(
      createRequest(token, {
        message: 'Show supply gaps',
        history: [],
        pathname: '/knowledge-graph',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toContain('Farm Equipment');
    expect(body.message.content).toContain('Mumbai');
    expect(memoryMocks.retrieveContext).toHaveBeenCalledTimes(1);
    expect(memoryMocks.saveConversationTurn).toHaveBeenCalledTimes(1);
    expect(body.message.toolCalls.map((tool: { tool: string }) => tool.tool)).toEqual([
      'control.read.knowledge-graph',
      'control.read.agents',
      'control.read.events',
    ]);
    expect(body.message.toolCalls.every((tool: { status: string }) => tool.status === 'completed')).toBe(true);
  });

  it('answers throttled agent questions with scoped agent details', async () => {
    const { token } = await createSession(platformOwner);

    const response = await POST(
      createRequest(token, {
        message: 'Which agents are throttled?',
        history: [],
        pathname: '/agents',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toContain('Finance Insights Agent');
    expect(body.message.content).toContain('finance-analytics');
    expect(body.message.toolCalls).toEqual([
      expect.objectContaining({
        tool: 'control.read.agents',
        status: 'completed',
      }),
    ]);
  });

  it('keeps the assistant read-only and returns permission-aware replies for blocked tools', async () => {
    const { token } = await createSession(viewer);

    const response = await POST(
      createRequest(token, {
        message: 'Summarize service health',
        history: [],
        pathname: '/observability',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toContain('observability:read');
    expect(body.message.toolCalls).toEqual([
      expect.objectContaining({
        tool: 'control.read.observability',
        status: 'blocked',
      }),
    ]);
  });

  it('uses the remote AI gateway when configured', async () => {
    const { token } = await createSession(platformOwner);
    process.env.CONTROL_PLANE_API_BASE_URL = 'http://control-plane.internal';
    resetDashboardEnvForTests();
    aiGatewayMocks.isConfigured.mockReturnValue(true);
    memoryMocks.retrieveContext.mockResolvedValue({
      summary: 'Loaded memory.',
      items: [{ id: 'ctx_1', documentId: 'doc_1', sourceType: 'research_note', title: 'Prior Mumbai gap', snippet: 'Demand was elevated previously.', score: 0.88, metadata: {}, createdAt: '2026-03-09T09:00:00.000Z' }],
      preferences: [{ id: 'pref_1', key: 'response_style', value: 'concise', sampleCount: 1, updatedAt: '2026-03-09T09:00:00.000Z' }],
      conversation: [],
      agentExperiences: [],
    } as never);
    aiGatewayMocks.research.mockResolvedValue({
      route: 'research',
      promptTemplate: 'supply_gap_research_v1',
      message: {
        id: 'assistant_gateway_1',
        role: 'assistant',
        content: 'Gateway research summary',
        createdAt: '2026-03-09T10:00:00.000Z',
        toolCalls: [],
      },
      suggestions: ['Show the hottest category-to-location paths'],
      degraded: false,
      guardrails: {
        concurrency: { limit: 2, inFlight: 1 },
        budget: { estimatedUnits: 200, remainingUnits: 2200, windowStartedAt: '2026-03-09T10:00:00.000Z' },
      },
    });

    const response = await POST(
      createRequest(token, {
        message: 'Show supply gaps',
        history: [],
        pathname: '/knowledge-graph',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toBe('Gateway research summary');
    expect(aiGatewayMocks.research).toHaveBeenCalledTimes(1);
    expect(aiGatewayMocks.research).toHaveBeenCalledWith(expect.objectContaining({
      memoryContext: expect.objectContaining({
        preferences: [expect.objectContaining({ key: 'response_style', value: 'concise' })],
      }),
    }));
    expect(memoryMocks.saveConversationTurn).toHaveBeenCalledTimes(1);
    expect(controlPlaneMocks.getKnowledgeGraph).not.toHaveBeenCalled();
  });

  it('routes admin action prompts through the AI command gateway when configured', async () => {
    const { token } = await createSession(platformOwner);
    process.env.CONTROL_PLANE_API_BASE_URL = 'http://control-plane.internal';
    resetDashboardEnvForTests();
    aiGatewayMocks.isConfigured.mockReturnValue(true);
    memoryMocks.retrieveContext.mockResolvedValue({
      summary: 'Finance agent recently produced recommendation context.',
      items: [],
      preferences: [],
      conversation: [],
      agentExperiences: [],
    } as never);
    aiGatewayMocks.command.mockResolvedValue({
      route: 'command',
      promptTemplate: 'control_plane_commands_v1',
      message: {
        id: 'assistant_gateway_2',
        role: 'assistant',
        content: 'Executed recommendation agent for Finance Copilot.',
        createdAt: '2026-03-09T10:05:00.000Z',
        toolCalls: [{ tool: 'control.run.recommendation-agent', permission: 'agents:operate', status: 'completed', summary: 'Executed recommendation run recommendation_run_1.' }],
      },
      suggestions: ['Record a success outcome'],
      command: { intent: 'run_recommendation_agent', mode: 'act', targetAgentId: 'agent_finance_03', executedActions: ['control.run.recommendation-agent'], dryRun: false },
      degraded: false,
      guardrails: {
        concurrency: { limit: 2, inFlight: 1 },
        budget: { estimatedUnits: 160, remainingUnits: 2040, windowStartedAt: '2026-03-09T10:05:00.000Z' },
      },
    });

    const response = await POST(
      createRequest(token, {
        message: 'Run recommendation agent for Finance Copilot',
        history: [],
        pathname: '/agents',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toContain('Executed recommendation agent');
    expect(aiGatewayMocks.command).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local assistant when the remote AI gateway fails', async () => {
    const { token } = await createSession(platformOwner);
    process.env.CONTROL_PLANE_API_BASE_URL = 'http://control-plane.internal';
    resetDashboardEnvForTests();
    aiGatewayMocks.isConfigured.mockReturnValue(true);
    aiGatewayMocks.analyze.mockRejectedValue(new aiGatewayMocks.AiGatewayServiceError('gateway down'));

    const response = await POST(
      createRequest(token, {
        message: 'Which agents are throttled?',
        history: [],
        pathname: '/agents',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.message.content).toContain('Finance Insights Agent');
    expect(controlPlaneMocks.getAgents).toHaveBeenCalledTimes(1);
  });

  it('captures assistant preferences from chat messages', async () => {
    const { token } = await createSession(platformOwner);

    const response = await POST(
      createRequest(token, {
        message: 'Please keep replies concise and use bullet points for supply gap updates.',
        history: [],
        pathname: '/knowledge-graph',
      }),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    expect(memoryMocks.upsertPreferences).toHaveBeenCalledWith({
      items: expect.arrayContaining([
        { key: 'response_style', value: 'concise' },
        { key: 'response_format', value: 'bullets' },
      ]),
    });
  });
});