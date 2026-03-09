import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';

function clamp01(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function findScopedAgent(agents, agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  return agent;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildSummary(outcomes, performance) {
  const items = performance.slice().sort((left, right) => {
    if (right.feedbackScore !== left.feedbackScore) return right.feedbackScore - left.feedbackScore;
    return right.successRate - left.successRate;
  });
  const predictionAccuracyValues = performance.map((item) => item.predictionAccuracy).filter((value) => typeof value === 'number');
  return {
    totalOutcomes: outcomes.length,
    averageSuccessRate: clamp01(average(performance.map((item) => item.successRate))),
    averageFeedbackScore: clamp01(average(performance.map((item) => item.feedbackScore))),
    averagePredictionAccuracy: clamp01(average(predictionAccuracyValues)),
    improvingAgents: performance.filter((item) => item.trend === 'up').length,
    topPerformers: items.slice(0, 5),
  };
}

export function createFeedbackLoopService({ store, strategyLearningService }) {
  return {
    async listOutcomes(input = {}, filters = {}) {
      return store.listAgentOutcomes({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, status: input.status, limit: input.limit ?? 20 });
    },
    async listPerformance(input = {}, filters = {}) {
      const items = await store.listAgentPerformance({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, limit: input.limit ?? 20 });
      const outcomes = await store.listAgentOutcomes({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, limit: 200 });
      return { items, summary: buildSummary(outcomes, items) };
    },
    async recordOutcome(input, adminContext, filters = {}) {
      const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
      const createdAt = new Date().toISOString();
      const latestRecommendation = input.source === 'recommendation' && !input.relatedRecommendationId
        ? (await store.listRecommendations({ tenantId: agent.tenantId, appId: agent.appId, agentId: agent.id, limit: 1 }))[0]
        : null;
      const outcome = {
        id: `outcome_${randomUUID()}`,
        agentId: agent.id,
        tenantId: agent.tenantId,
        appId: agent.appId,
        source: input.source,
        status: input.status,
        score: clamp01(input.score),
        summary: input.summary,
        relatedRunId: input.relatedRunId,
        relatedRecommendationId: input.relatedRecommendationId ?? latestRecommendation?.id,
        latencyMs: input.latencyMs,
        costUsd: input.costUsd,
        metadata: { ...(input.metadata ?? {}), autoLinkedRecommendationId: latestRecommendation?.id ?? null },
        createdAt,
      };

      await store.saveUsagePattern({
        id: `usage_${randomUUID()}`,
        tenantId: agent.tenantId,
        appId: agent.appId,
        scope: 'agent',
        signalKey: `agent_outcome.${agent.id}`,
        signalValue: input.status,
        sampleCount: 1,
        metadata: { agentId: agent.id, source: input.source, score: outcome.score, recordedBy: adminContext.userId },
        windowStartedAt: createdAt,
        windowEndedAt: createdAt,
      });
      await store.saveKnowledgeEvent({
        id: `ke_${randomUUID()}`,
        tenantId: agent.tenantId,
        appId: agent.appId,
        eventType: 'agent_outcome_recorded',
        sourceService: 'feedback_loop',
        sourceRef: input.relatedRunId ?? outcome.id,
        payload: { outcome },
        createdAt,
      });
      const audit = await store.recordAgentOutcome(outcome, 'agent_outcome_recorded', adminContext.userId);
      const { performance } = strategyLearningService
        ? await strategyLearningService.recomputeAgent(agent.id, adminContext, { tenantId: agent.tenantId, appId: agent.appId })
        : { performance: (await store.listAgentPerformance({ tenantId: agent.tenantId, appId: agent.appId, agentId: agent.id, limit: 1 }))[0] };
      await store.publishDomainEvent({
        tenantId: agent.tenantId,
        appId: agent.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'agent_outcome_recorded',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: agent.id,
        summary: input.summary,
        timestamp: createdAt,
        metadata: { outcomeId: outcome.id, status: outcome.status, score: outcome.score, performanceId: performance.id },
      });
      return { item: outcome, performance, audit };
    },
  };
}