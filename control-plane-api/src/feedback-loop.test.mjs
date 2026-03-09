import { describe, expect, it } from 'vitest';

import { agentsData } from './data/platform-data.mjs';
import { createFeedbackLoopService } from './feedback-loop.mjs';
import { createControlPlaneStore } from './store.mjs';

const adminContext = { tenantId: 'tenant_nova', appId: 'app_admin', userId: 'usr_platform_owner', roles: ['platform_owner'] };

describe('feedback loop service', () => {
  it('records agent outcomes, updates knowledge signals, and saves performance snapshots', async () => {
    const agent = structuredClone(agentsData.find((item) => item.id === 'agent_finance_03'));
    const state = { agents: agent ? [agent] : [], documents: [], embeddings: [], memory: [], events: [], usagePatterns: [], auditLogs: [], researchRuns: [], researchSchedules: [], researchAgentRuns: [], researchAgentTriggers: [], insightAgentRuns: [], recommendationAgentRuns: [], agentPerformance: [], marketSignals: [], knowledgeEvents: [] };
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const feedbackLoopService = createFeedbackLoopService({ store });

    const response = await feedbackLoopService.recordOutcome({
      agentId: 'agent_finance_03',
      source: 'manual',
      status: 'success',
      score: 0.92,
      summary: 'Recommendation accepted by the operator and converted to a workflow update.',
      latencyMs: 320,
      costUsd: 0.12,
      metadata: { channel: 'unit-test' },
    }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });

    expect(response.item.status).toBe('success');
    expect(response.performance.feedbackScore).toBeGreaterThan(0);
    expect(state.knowledgeEvents.some((item) => item.eventType === 'agent_outcome_recorded')).toBe(true);
    expect(state.agentPerformance).toHaveLength(1);
    expect(state.usagePatterns).toHaveLength(1);
  });
});