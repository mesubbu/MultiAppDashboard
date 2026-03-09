import { describe, expect, it } from 'vitest';

import { agentsData } from './data/platform-data.mjs';
import { createInsightAgentService } from './insight-agent.mjs';
import { createControlPlaneStore } from './store.mjs';

const adminContext = {
  tenantId: 'tenant_nova',
  appId: 'app_admin',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

function createState() {
  const agent = structuredClone(agentsData.find((item) => item.id === 'agent_finance_03'));
  return {
    agents: agent ? [agent] : [],
    documents: [],
    embeddings: [],
    memory: [],
    events: [
      {
        id: 'evt_order_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        type: 'order_placed',
        actor: 'Nova buyer',
        summary: 'Large enterprise order placed for premium inventory.',
        timestamp: '2026-03-09T10:00:00.000Z',
      },
      {
        id: 'evt_message_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        type: 'message_sent',
        actor: 'Nova support',
        summary: 'Customer success follow-up volume increased for high-value accounts.',
        timestamp: '2026-03-09T10:05:00.000Z',
      },
    ],
    usagePatterns: [
      {
        id: 'usage_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        scope: 'operator',
        signalKey: 'domain_event',
        signalValue: 'order_placed',
        sampleCount: 5,
        metadata: {},
        windowStartedAt: '2026-03-09T09:00:00.000Z',
        windowEndedAt: '2026-03-09T10:00:00.000Z',
        createdAt: '2026-03-09T10:00:00.000Z',
      },
    ],
    auditLogs: [],
    researchRuns: [
      {
        id: 'research_run_seed_1',
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        source: 'market_api',
        query: 'commodity basket',
        status: 'completed',
        provider: 'market-snapshot-adapter/local-hash',
        degraded: false,
        summary: '2 research item(s) collected for commodity basket.',
        documentsCreated: 2,
        embeddingsCreated: 2,
        itemsCollected: 2,
        metadata: {},
        createdAt: '2026-03-09T09:50:00.000Z',
      },
    ],
    researchSchedules: [],
    researchAgentRuns: [],
    researchAgentTriggers: [],
    insightAgentRuns: [],
    marketSignals: [],
    knowledgeEvents: [],
  };
}

describe('insight agent service', () => {
  it('detects signals, writes market signals and knowledge events, and updates agent history', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const insightAgentService = createInsightAgentService({ store });

    const response = await insightAgentService.execute({
      agentId: 'agent_finance_03',
      eventLimit: 10,
      usageLimit: 10,
      researchLimit: 5,
      signalLimit: 4,
      metadata: { channel: 'unit-test' },
    }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });

    expect(response.item.status).toBe('completed');
    expect(response.item.signalCount).toBeGreaterThan(0);
    expect(response.signals.length).toBeGreaterThan(0);
    expect(state.marketSignals.length).toBeGreaterThan(0);
    expect(state.knowledgeEvents.length).toBeGreaterThan(0);
    expect(state.insightAgentRuns).toHaveLength(1);
    expect(response.agent.tasks[0]?.title).toContain('Insight');
    expect(response.agent.executionHistory[0]?.status).toBe('success');
  });

  it('processes new platform events once and skips already-consumed events on later runs', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const insightAgentService = createInsightAgentService({ store });

    const first = await insightAgentService.processEvents({
      agentId: 'agent_finance_03',
      eventTypes: ['order_placed', 'message_sent'],
      eventLimit: 10,
      usageLimit: 5,
      researchLimit: 2,
      signalLimit: 3,
      metadata: {},
    }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });

    expect(first.items).toHaveLength(1);
    expect(first.items[0]?.trigger).toBe('event');

    const second = await insightAgentService.processEvents({
      agentId: 'agent_finance_03',
      eventTypes: ['order_placed', 'message_sent'],
      eventLimit: 10,
      usageLimit: 5,
      researchLimit: 2,
      signalLimit: 3,
      metadata: {},
    }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });

    expect(second.items).toHaveLength(0);
  });
});