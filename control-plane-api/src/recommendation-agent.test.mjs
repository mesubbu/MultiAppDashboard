import { describe, expect, it } from 'vitest';

import { agentsData } from './data/platform-data.mjs';
import { createRecommendationAgentService } from './recommendation-agent.mjs';
import { createControlPlaneStore } from './store.mjs';

const adminContext = { tenantId: 'tenant_nova', appId: 'app_admin', userId: 'usr_platform_owner', roles: ['platform_owner'] };

function createState() {
  const agent = structuredClone(agentsData.find((item) => item.id === 'agent_finance_03'));
  return {
    agents: agent ? [agent] : [],
    documents: [],
    embeddings: [],
    memory: [],
    events: [],
    usagePatterns: [{
      id: 'usage_1', tenantId: 'tenant_nova', appId: 'app_admin', scope: 'operator', signalKey: 'domain_event', signalValue: 'order_placed', sampleCount: 5, metadata: {}, windowStartedAt: '2026-03-09T09:00:00.000Z', windowEndedAt: '2026-03-09T10:00:00.000Z', createdAt: '2026-03-09T10:00:00.000Z',
    }],
    auditLogs: [],
    graphNodes: [{ id: 'node_1', tenantId: 'tenant_nova', appId: 'app_admin', type: 'demand', label: 'Premium inventory demand', metadata: 'premium', description: 'Demand node for premium inventory.', tags: ['premium'], score: 0.88, health: 'healthy' }],
    graphEdges: [],
    researchRuns: [],
    researchSchedules: [],
    researchAgentRuns: [],
    researchAgentTriggers: [],
    insightAgentRuns: [],
    recommendationAgentRuns: [],
    agentPerformance: [],
    marketSignals: [{
      id: 'signal_1', tenantId: 'tenant_nova', appId: 'app_admin', signalType: 'conversion_momentum', subject: 'Premium inventory', direction: 'up', strength: 0.82, confidence: 0.86, summary: 'Premium inventory demand is accelerating.', metadata: {}, detectedAt: '2026-03-09T10:15:00.000Z',
    }],
    knowledgeEvents: [],
  };
}

describe('recommendation agent service', () => {
  it('generates recommendations from signals and behavior patterns', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const recommendationAgentService = createRecommendationAgentService({
      store,
      embeddingsService: { embed: async () => ({ embeddings: [{ embeddingVector: [0.1, 0.2, 0.3] }] }) },
    });

    const response = await recommendationAgentService.execute({
      agentId: 'agent_finance_03',
      signalLimit: 5,
      behaviorLimit: 5,
      documentLimit: 3,
      maxRecommendations: 4,
      metadata: { channel: 'unit-test' },
    }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });

    expect(response.item.status).toBe('completed');
    expect(response.item.recommendationCount).toBeGreaterThan(0);
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(state.knowledgeEvents.some((item) => item.eventType === 'recommendation_created')).toBe(true);
    expect(state.recommendationAgentRuns).toHaveLength(1);
    expect(response.agent.tasks[0]?.title).toContain('Recommendation');
  });
});