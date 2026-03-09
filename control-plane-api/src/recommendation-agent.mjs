import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';

function clamp01(value) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

function truncate(value, maxLength = 96) {
  if (!value) return '';
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function findScopedAgent(agents, agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  return agent;
}

function assertAgentRunnable(agent) {
  if (agent.state === 'paused') throw new HttpError(409, 'AGENT_PAUSED', `Agent ${agent.name} is paused and cannot generate recommendations.`);
  if (agent.orchestration?.dependencyState === 'blocked') throw new HttpError(409, 'AGENT_BLOCKED', `Agent ${agent.name} is blocked and cannot generate recommendations.`);
}

function toTaskStatus(status) {
  if (status === 'failed') return 'failed';
  if (status === 'degraded') return 'waiting_review';
  return 'completed';
}

function toExecutionStatus(status) {
  if (status === 'failed') return 'failed';
  if (status === 'degraded') return 'warning';
  return 'success';
}

function estimateCost(recommendations, signals, documents) {
  return Number((0.04 + recommendations * 0.014 + signals * 0.004 + documents * 0.003).toFixed(2));
}

function buildQueryText(agent, input, signals) {
  return truncate(
    input.query
      ?? [agent.name, agent.lastTask, ...signals.slice(0, 2).map((item) => item.summary)].filter(Boolean).join(' · '),
    420,
  );
}

function recommendationFromSignal(agent, signal) {
  const priority = signal.strength >= 0.76 || signal.confidence >= 0.8 ? 'high' : 'medium';
  const category = signal.signalType === 'research_momentum' ? 'workflow_suggestion' : 'prioritized_action';
  const title = signal.direction === 'down'
    ? `Mitigate risk around ${truncate(signal.subject, 52)}`
    : `Act on ${truncate(signal.subject, 52)}`;
  return {
    category,
    priority,
    title,
    summary: `${agent.name} should respond to ${signal.signalType.replace(/_/g, ' ')} around ${signal.subject}.`,
    rationale: [signal.summary, `Strength ${signal.strength.toFixed(2)} with confidence ${signal.confidence.toFixed(2)}.`],
    confidence: clamp01((signal.strength + signal.confidence) / 2),
    sourceSignalIds: [signal.id],
    relatedNodeIds: [],
    relatedDocumentIds: [],
    metadata: { signalType: signal.signalType, direction: signal.direction },
  };
}

function recommendationFromGraphNode(node) {
  return {
    category: 'workflow_suggestion',
    priority: node.health === 'critical' ? 'high' : 'medium',
    title: `Coordinate workflow around ${truncate(node.label, 52)}`,
    summary: `Use graph context for ${node.label} to improve routing and prioritization.`,
    rationale: [node.description, `Graph score ${node.score.toFixed(2)} and health ${node.health}.`],
    confidence: clamp01(0.5 + node.score * 0.4),
    sourceSignalIds: [],
    relatedNodeIds: [node.id],
    relatedDocumentIds: [],
    metadata: { nodeType: node.type, tags: node.tags },
  };
}

function recommendationFromUsage(pattern) {
  return {
    category: 'prioritized_action',
    priority: pattern.sampleCount >= 5 ? 'high' : 'medium',
    title: `Scale ${truncate(`${pattern.signalKey}:${pattern.signalValue}`, 52)}`,
    summary: `Behavior data shows repeat activity for ${pattern.signalKey}=${pattern.signalValue}.`,
    rationale: [`Observed ${pattern.sampleCount} samples in ${pattern.scope} scope.`, `Window ended at ${pattern.windowEndedAt ?? pattern.createdAt}.`],
    confidence: clamp01(0.45 + pattern.sampleCount * 0.07),
    sourceSignalIds: [],
    relatedNodeIds: [],
    relatedDocumentIds: [],
    metadata: { usagePatternId: pattern.id, scope: pattern.scope },
  };
}

function recommendationFromDocument(match) {
  return {
    category: 'research_lead',
    priority: match.score >= 0.78 ? 'high' : 'medium',
    title: `Deepen research from ${truncate(match.title || 'knowledge match', 52)}`,
    summary: `Embeddings similarity surfaced ${match.title || 'a relevant document'} for follow-up analysis.`,
    rationale: [truncate(match.snippet, 120), `Similarity score ${match.score.toFixed(2)}.`],
    confidence: clamp01(match.score),
    sourceSignalIds: [],
    relatedNodeIds: [],
    relatedDocumentIds: [match.documentId],
    metadata: { sourceType: match.sourceType },
  };
}

function dedupeRecommendations(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.category}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchDocuments({ embeddingsService, store, tenantId, appId, queryText, adminContext, limit }) {
  const embedded = await embeddingsService.embed({
    items: [{ text: queryText, title: 'Recommendation query', sourceType: 'query', metadata: { kind: 'recommendation_query' } }],
    persist: false,
    chunkSize: 240,
    overlap: 0,
  }, adminContext);
  const vector = embedded.embeddings[0]?.embeddingVector;
  if (!vector?.length) return [];
  return store.searchEmbeddings({ tenantId, appId, vector, sourceTypes: ['research_note', 'event', 'agent_note', 'document'], limit });
}

async function createRecommendations({ store, tenantId, appId, actor, runId, agentId, candidates, createdAt }) {
  const recommendations = [];
  for (const candidate of candidates) {
    const recommendation = {
      id: `rec_${randomUUID()}`,
      tenantId,
      appId,
      agentId,
      ...candidate,
      createdAt,
    };
    await store.saveKnowledgeEvent({
      id: `ke_${randomUUID()}`,
      tenantId,
      appId,
      eventType: 'recommendation_created',
      sourceService: 'recommendation_agent',
      sourceRef: runId,
      payload: { recommendation },
      createdAt,
    });
    await store.publishDomainEvent({
      tenantId,
      appId,
      actor,
      actorDisplay: actor,
      type: 'recommendation_created',
      source: 'control_plane_api',
      resourceType: 'recommendation',
      resourceId: recommendation.id,
      summary: recommendation.summary,
      timestamp: createdAt,
      metadata: { agentId, category: recommendation.category, priority: recommendation.priority },
    });
    recommendations.push(recommendation);
  }
  return recommendations;
}

function summarizeRun(recommendations) {
  if (!recommendations.length) return 'No sufficiently strong operator recommendations were generated from the current context.';
  return `${recommendations.length} operator recommendation(s) generated from signals, graph context, and behavior data.`;
}

export function createRecommendationAgentService({ store, embeddingsService }) {
  return {
    async listRuns(input = {}, filters = {}) {
      return store.listRecommendationAgentRuns({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, status: input.status, limit: input.limit ?? 20 });
    },
    async listRecommendations(input = {}, filters = {}) {
      return store.listRecommendations({ tenantId: filters.tenantId ?? null, appId: filters.appId ?? null, agentId: input.agentId, category: input.category, priority: input.priority, limit: input.limit ?? 20 });
    },
    async execute(input, adminContext, filters = {}) {
      const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
      assertAgentRunnable(agent);
      const now = new Date().toISOString();
      const updatedAgent = structuredClone(agent);
      const taskId = `task_${randomUUID()}`;
      const executionId = `exec_${randomUUID()}`;
      const signals = (await store.listMarketSignals({ tenantId: agent.tenantId, appId: agent.appId, limit: input.signalLimit })).slice(0, input.signalLimit);
      const graph = await store.getKnowledgeGraph({ tenantId: agent.tenantId, appId: agent.appId, query: input.query, limit: input.maxRecommendations + 2 });
      const usagePatterns = (await store.listUsagePatterns({ tenantId: agent.tenantId, appId: agent.appId, limit: input.behaviorLimit })).slice(0, input.behaviorLimit);
      const documentMatches = await searchDocuments({
        embeddingsService,
        store,
        tenantId: agent.tenantId,
        appId: agent.appId,
        queryText: buildQueryText(agent, input, signals),
        adminContext,
        limit: input.documentLimit,
      });

      updatedAgent.tasks.unshift({ id: taskId, title: 'Recommendation · Operator actions', summary: `Synthesize up to ${input.maxRecommendations} prioritized actions.`, status: 'running', priority: updatedAgent.orchestration?.priority ?? 'medium', owner: 'recommendation-agent', executionId, startedAt: now, updatedAt: now });
      updatedAgent.executionHistory.unshift({ id: executionId, workflowVersion: updatedAgent.workflowVersion, taskId, status: 'running', startedAt: now, endedAt: now, costUsd: 0, outputSummary: 'Recommendation agent run started.' });
      updatedAgent.logs.unshift({ id: `log_${randomUUID()}`, level: 'info', source: 'recommendation-agent', message: `Recommendation synthesis started for ${updatedAgent.name} by ${adminContext.userId}.`, timestamp: now });
      updatedAgent.lastTask = 'Recommendation · Operator actions';
      updatedAgent.lastHeartbeatAt = now;
      updatedAgent.queueDepth += 1;
      updatedAgent.state = 'running';
      await store.saveAgent(updatedAgent);

      const runId = `recommendation_run_${randomUUID()}`;
      const candidates = dedupeRecommendations([
        ...signals.map((signal) => recommendationFromSignal(updatedAgent, signal)),
        ...graph.nodes.slice(0, input.maxRecommendations).map(recommendationFromGraphNode),
        ...usagePatterns.map(recommendationFromUsage),
        ...documentMatches.map(recommendationFromDocument),
      ]).slice(0, input.maxRecommendations);

      const createdAt = new Date().toISOString();
      const recommendations = await createRecommendations({ store, tenantId: agent.tenantId, appId: agent.appId, actor: adminContext.userId, runId, agentId: agent.id, candidates, createdAt });
      const status = recommendations.length ? 'completed' : 'degraded';
      const task = updatedAgent.tasks.find((item) => item.id === taskId);
      const execution = updatedAgent.executionHistory.find((item) => item.id === executionId);
      if (!task || !execution) throw new HttpError(409, 'AGENT_RECOMMENDATION_STATE_INVALID', 'Missing task or execution state for recommendation run.');

      task.status = toTaskStatus(status);
      task.updatedAt = createdAt;
      execution.status = toExecutionStatus(status);
      execution.endedAt = createdAt;
      execution.costUsd = estimateCost(recommendations.length, signals.length, documentMatches.length);
      execution.outputSummary = summarizeRun(recommendations);
      updatedAgent.queueDepth = Math.max(0, updatedAgent.queueDepth - 1);
      updatedAgent.lastHeartbeatAt = createdAt;
      updatedAgent.state = status === 'degraded' ? 'throttled' : 'running';
      updatedAgent.logs.unshift({ id: `log_${randomUUID()}`, level: status === 'degraded' ? 'warn' : 'info', source: 'recommendation-agent', message: `Recommendation synthesis completed with ${recommendations.length} recommendation(s).`, timestamp: createdAt });

      const run = {
        id: runId,
        agentId: agent.id,
        tenantId: agent.tenantId,
        appId: agent.appId,
        status,
        taskId,
        executionId,
        summary: summarizeRun(recommendations),
        recommendationCount: recommendations.length,
        signalCount: signals.length,
        graphContextCount: graph.nodes.length,
        behaviorPatternCount: usagePatterns.length,
        documentMatchCount: documentMatches.length,
        recommendationIds: recommendations.map((item) => item.id),
        metadata: { query: input.query ?? null, sourceSignalTypes: [...new Set(signals.map((item) => item.signalType))], ...(input.metadata ?? {}) },
        createdAt,
      };

      const audit = await store.recordRecommendationAgentRun(run, 'recommendation_agent_execute', adminContext.userId);
      await store.saveAgent(updatedAgent);
      await store.publishDomainEvent({
        tenantId: agent.tenantId,
        appId: agent.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'agent_run_updated',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: agent.id,
        summary: `Recommendation agent ${agent.name} finished with ${status}`,
        timestamp: createdAt,
        metadata: { taskId, executionId, recommendationRunId: run.id, recommendationCount: run.recommendationCount },
      });

      return { item: run, agent: updatedAgent, recommendations, audit };
    },
  };
}