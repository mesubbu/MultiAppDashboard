import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';

function clamp01(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function statusWeight(status) {
  if (status === 'success') return 1;
  if (status === 'warning') return 0.6;
  if (status === 'blocked') return 0.35;
  return 0;
}

function findScopedAgent(agents, agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  return agent;
}

function buildCategoryPerformance(linkedOutcomes, recommendationsById) {
  const grouped = new Map();
  for (const outcome of linkedOutcomes) {
    const recommendation = recommendationsById.get(outcome.relatedRecommendationId);
    if (!recommendation) continue;
    const key = recommendation.category;
    const current = grouped.get(key) ?? { category: key, outcomeCount: 0, successCount: 0, scores: [] };
    current.outcomeCount += 1;
    current.successCount += outcome.status === 'success' ? 1 : 0;
    current.scores.push(clamp01(outcome.score * statusWeight(outcome.status)));
    grouped.set(key, current);
  }
  return [...grouped.values()]
    .map((item) => ({
      category: item.category,
      outcomeCount: item.outcomeCount,
      successRate: clamp01(item.successCount / Math.max(1, item.outcomeCount)),
      averageScore: clamp01(average(item.scores)),
    }))
    .sort((left, right) => right.averageScore - left.averageScore);
}

function buildStrategyLearning(agent, outcomes, recommendations) {
  const createdAt = new Date().toISOString();
  const recommendationsById = new Map(recommendations.map((item) => [item.id, item]));
  const linkedOutcomes = outcomes.filter((item) => item.relatedRecommendationId && recommendationsById.has(item.relatedRecommendationId));
  const predictionAccuracy = linkedOutcomes.length
    ? clamp01(average(linkedOutcomes.map((item) => {
      const recommendation = recommendationsById.get(item.relatedRecommendationId);
      const actualScore = clamp01(item.score * statusWeight(item.status));
      return clamp01(1 - Math.abs((recommendation?.confidence ?? 0.5) - actualScore));
    })))
    : undefined;
  const recommendationAcceptanceRate = linkedOutcomes.length
    ? clamp01(linkedOutcomes.filter((item) => item.status === 'success').length / linkedOutcomes.length)
    : undefined;
  const categoryPerformance = buildCategoryPerformance(linkedOutcomes, recommendationsById);
  const successfulStrategies = categoryPerformance.filter((item) => item.successRate >= 0.7).slice(0, 3).map((item) => item.category.replace(/_/g, ' '));
  const riskyStrategies = categoryPerformance.filter((item) => item.successRate < 0.45).slice(0, 3).map((item) => item.category.replace(/_/g, ' '));
  const suggestedAdjustments = [];

  if (predictionAccuracy == null) suggestedAdjustments.push('Capture operator outcomes against recommendation ids to calibrate strategy confidence.');
  else if (predictionAccuracy < 0.68) suggestedAdjustments.push('Tighten recommendation confidence thresholds before issuing high-priority actions.');
  if (recommendationAcceptanceRate != null && recommendationAcceptanceRate < 0.55) suggestedAdjustments.push('Bias toward workflow suggestions until operator acceptance improves for prioritized actions.');
  if (riskyStrategies.length) suggestedAdjustments.push(`Revisit ${riskyStrategies[0]} strategy prompts using fresher signals and graph evidence.`);
  if (!suggestedAdjustments.length && successfulStrategies[0]) suggestedAdjustments.push(`Reinforce ${successfulStrategies[0]} strategies because recent outcomes align with predicted confidence.`);

  return {
    id: `strategy_learning_${agent.id}`,
    agentId: agent.id,
    tenantId: agent.tenantId,
    appId: agent.appId,
    evaluationWindow: 'rolling_30',
    summary: predictionAccuracy == null
      ? `Strategy learning is collecting evidence for ${agent.name}; link more recommendation outcomes to calibrate prediction accuracy.`
      : `Prediction accuracy is ${Math.round(predictionAccuracy * 100)}% across ${linkedOutcomes.length} linked recommendation outcome(s) for ${agent.name}.`,
    predictionAccuracy,
    recommendationAcceptanceRate,
    learningConfidence: clamp01(Math.min(1, linkedOutcomes.length / 6) * 0.4 + (predictionAccuracy ?? 0.5) * 0.35 + (recommendationAcceptanceRate ?? 0.5) * 0.25),
    successfulStrategies,
    riskyStrategies,
    suggestedAdjustments,
    metadata: {
      linkedOutcomeCount: linkedOutcomes.length,
      recommendationCount: recommendations.length,
      latestRecommendationId: recommendations[0]?.id ?? null,
      latestOutcomeId: outcomes[0]?.id ?? null,
      categoryPerformance,
    },
    createdAt,
  };
}

function buildPerformance(agent, outcomes, learning) {
  const scored = outcomes.map((item) => clamp01(item.score * statusWeight(item.status)));
  const recent = scored.slice(0, Math.ceil(scored.length / 2));
  const previous = scored.slice(Math.ceil(scored.length / 2));
  const improvementDelta = Number((average(recent) - average(previous)).toFixed(2));
  const trend = improvementDelta > 0.05 ? 'up' : improvementDelta < -0.05 ? 'down' : 'flat';
  return {
    id: `agent_perf_${agent.id}`,
    agentId: agent.id,
    tenantId: agent.tenantId,
    appId: agent.appId,
    evaluationWindow: learning.evaluationWindow,
    successRate: clamp01(outcomes.filter((item) => item.status === 'success').length / Math.max(1, outcomes.length)),
    avgLatencyMs: Number(average(outcomes.map((item) => item.latencyMs).filter((value) => typeof value === 'number')).toFixed(0)),
    avgCostUsd: Number(average(outcomes.map((item) => item.costUsd).filter((value) => typeof value === 'number')).toFixed(2)),
    taskCount: outcomes.length,
    feedbackScore: clamp01(average(scored)),
    predictionAccuracy: learning.predictionAccuracy,
    recommendationAcceptanceRate: learning.recommendationAcceptanceRate,
    improvementDelta,
    trend,
    metadata: {
      statusCounts: outcomes.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {}),
      latestOutcomeId: outcomes[0]?.id ?? null,
      strategyLearningId: learning.id,
      learningConfidence: learning.learningConfidence,
      suggestedAdjustments: learning.suggestedAdjustments,
      successfulStrategies: learning.successfulStrategies,
      riskyStrategies: learning.riskyStrategies,
      categoryPerformance: learning.metadata.categoryPerformance,
    },
    recordedAt: learning.createdAt,
  };
}

export function createStrategyLearningService({ store }) {
  return {
    async list(input = {}, filters = {}) {
      return store.listStrategyLearning({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, limit: input.limit ?? 20 });
    },
    async recomputeAgent(agentId, adminContext, filters = {}) {
      const agent = findScopedAgent(await store.listAgents(filters), agentId);
      const scoped = { tenantId: agent.tenantId, appId: agent.appId, agentId: agent.id };
      const outcomes = await store.listAgentOutcomes({ ...scoped, limit: 60 });
      const recommendations = await store.listRecommendations({ ...scoped, limit: 60 });
      const learning = buildStrategyLearning(agent, outcomes, recommendations);
      const performance = buildPerformance(agent, outcomes, learning);
      await store.saveAgentPerformance(performance);
      await store.saveKnowledgeEvent({
        id: `ke_${randomUUID()}`,
        tenantId: agent.tenantId,
        appId: agent.appId,
        eventType: 'strategy_learning_updated',
        sourceService: 'strategy_learning',
        sourceRef: agent.id,
        payload: { learning, performance },
        createdAt: learning.createdAt,
      });
      await store.publishDomainEvent({
        tenantId: agent.tenantId,
        appId: agent.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'analysis_completed',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: agent.id,
        summary: learning.summary,
        timestamp: learning.createdAt,
        metadata: { strategyLearningId: learning.id, predictionAccuracy: learning.predictionAccuracy, recommendationAcceptanceRate: learning.recommendationAcceptanceRate },
      });
      return { learning, performance };
    },
  };
}