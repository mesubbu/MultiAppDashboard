import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';

const EVENT_SIGNAL_TYPES = {
  listing_created: { signalType: 'demand_spike', direction: 'up' },
  order_placed: { signalType: 'conversion_momentum', direction: 'up' },
  message_sent: { signalType: 'engagement_trend', direction: 'up' },
  agent_triggered: { signalType: 'automation_pressure', direction: 'up' },
  research_collected: { signalType: 'research_momentum', direction: 'up' },
};

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
  if (agent.state === 'paused') {
    throw new HttpError(409, 'AGENT_PAUSED', `Agent ${agent.name} is paused and cannot detect insights.`);
  }
  if (agent.orchestration?.dependencyState === 'blocked') {
    throw new HttpError(409, 'AGENT_BLOCKED', `Agent ${agent.name} is blocked and cannot detect insights.`);
  }
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

function estimateCost(signalCount, eventCount, usageCount) {
  return Number((0.03 + signalCount * 0.012 + eventCount * 0.003 + usageCount * 0.002).toFixed(2));
}

function buildTaskTitle(trigger) {
  return trigger === 'event' ? 'Insight · Platform events' : 'Insight · Signal detection';
}

function buildTaskSummary(trigger, signalLimit) {
  return trigger === 'event'
    ? `Consume recent platform events and emit up to ${signalLimit} market signals.`
    : `Analyze recent platform activity and emit up to ${signalLimit} market signals.`;
}

function toSignalFromEvent(event, totalEvents) {
  const config = EVENT_SIGNAL_TYPES[event.type];
  if (!config) return null;
  return {
    signalType: config.signalType,
    subject: truncate(event.summary, 72) || event.type,
    direction: config.direction,
    strength: clamp01(0.56 + totalEvents * 0.04),
    confidence: clamp01(0.68 + totalEvents * 0.03),
    summary: `${event.summary} This pattern maps to ${config.signalType.replace(/_/g, ' ')}.`,
    metadata: { eventIds: [event.id], eventType: event.type, actor: event.actor },
  };
}

function toSignalFromUsagePattern(pattern) {
  return {
    signalType: 'usage_trend',
    subject: `${pattern.signalKey}:${pattern.signalValue}`,
    direction: pattern.sampleCount >= 3 ? 'up' : 'neutral',
    strength: clamp01(0.4 + pattern.sampleCount * 0.08),
    confidence: clamp01(0.48 + pattern.sampleCount * 0.07),
    summary: `Usage trend detected for ${pattern.signalKey}=${pattern.signalValue} with ${pattern.sampleCount} samples in ${pattern.scope} scope.`,
    metadata: { usagePatternId: pattern.id, sampleCount: pattern.sampleCount, scope: pattern.scope },
  };
}

function toSignalFromResearchRun(run) {
  return {
    signalType: 'research_momentum',
    subject: truncate(run.query, 72),
    direction: run.status === 'failed' ? 'neutral' : 'up',
    strength: clamp01(0.45 + run.itemsCollected * 0.06),
    confidence: clamp01(run.status === 'completed' ? 0.78 : 0.62),
    summary: `Research run for ${run.query} produced ${run.itemsCollected} item(s) and suggests follow-up operator attention.`,
    metadata: { researchRunId: run.id, source: run.source, status: run.status },
  };
}

function dedupeSignals(signals) {
  const seen = new Set();
  return signals.filter((signal) => {
    const key = `${signal.signalType}:${signal.subject}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectProcessedEventIds(runs) {
  const ids = new Set();
  for (const run of runs) {
    const eventIds = Array.isArray(run.metadata?.processedEventIds) ? run.metadata.processedEventIds : [];
    for (const eventId of eventIds) {
      if (typeof eventId === 'string') ids.add(eventId);
    }
  }
  return ids;
}

async function createSignals({ store, tenantId, appId, actor, runId, candidates, detectedAt }) {
  const signals = [];
  for (const candidate of candidates) {
    const signal = {
      id: `signal_${randomUUID()}`,
      tenantId,
      appId,
      signalType: candidate.signalType,
      subject: candidate.subject,
      direction: candidate.direction,
      strength: candidate.strength,
      confidence: candidate.confidence,
      summary: candidate.summary,
      metadata: candidate.metadata ?? {},
      detectedAt,
    };
    await store.saveMarketSignal(signal);
    await store.saveKnowledgeEvent({
      id: `ke_${randomUUID()}`,
      tenantId,
      appId,
      eventType: 'signal_detected',
      sourceService: 'insight_agent',
      sourceRef: runId,
      payload: { signalId: signal.id, signalType: signal.signalType, subject: signal.subject, direction: signal.direction, metadata: signal.metadata },
      createdAt: detectedAt,
    });
    await store.publishDomainEvent({
      tenantId,
      appId,
      actor,
      actorDisplay: actor,
      type: 'signal_detected',
      source: 'control_plane_api',
      resourceType: 'signal',
      resourceId: signal.id,
      summary: signal.summary,
      timestamp: detectedAt,
      metadata: { runId, signalType: signal.signalType, subject: signal.subject, direction: signal.direction },
    });
    signals.push(signal);
  }
  return signals;
}

function summarizeRun(trigger, signals) {
  if (!signals.length) {
    return trigger === 'event'
      ? 'No new market signals detected from unprocessed platform events.'
      : 'No significant market signals detected from the current activity window.';
  }
  return `${signals.length} market signal(s) detected across recent platform activity.`;
}

export function createInsightAgentService({ store }) {
  async function runInsight(input, adminContext, filters = {}, executionContext = { trigger: 'manual', events: null }) {
    const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
    assertAgentRunnable(agent);

    const now = new Date().toISOString();
    const updatedAgent = structuredClone(agent);
    const taskId = `task_${randomUUID()}`;
    const executionId = `exec_${randomUUID()}`;
    const events = executionContext.events ?? await store.listEvents({
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      limit: input.eventLimit,
    });
    const scopedEvents = (input.eventTypes?.length ? events.filter((event) => input.eventTypes.includes(event.type)) : events).slice(0, input.eventLimit);
    const usagePatterns = (await store.listUsagePatterns({
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      limit: input.usageLimit,
    })).slice(0, input.usageLimit);
    const researchRuns = (await store.listResearchRuns({
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      limit: input.researchLimit,
    }))
      .filter((item) => item.status !== 'failed')
      .slice(0, input.researchLimit);

    updatedAgent.tasks.unshift({
      id: taskId,
      title: buildTaskTitle(executionContext.trigger),
      summary: buildTaskSummary(executionContext.trigger, input.signalLimit),
      status: 'running',
      priority: updatedAgent.orchestration?.priority ?? 'medium',
      owner: 'insight-agent',
      executionId,
      startedAt: now,
      updatedAt: now,
    });
    updatedAgent.executionHistory.unshift({
      id: executionId,
      workflowVersion: updatedAgent.workflowVersion,
      taskId,
      status: 'running',
      startedAt: now,
      endedAt: now,
      costUsd: 0,
      outputSummary: 'Insight agent run started.',
    });
    updatedAgent.logs.unshift({
      id: `log_${randomUUID()}`,
      level: 'info',
      source: 'insight-agent',
      message: `Insight detection started for ${updatedAgent.name} by ${adminContext.userId}.`,
      timestamp: now,
    });
    updatedAgent.lastTask = buildTaskTitle(executionContext.trigger);
    updatedAgent.lastHeartbeatAt = now;
    updatedAgent.queueDepth += 1;
    updatedAgent.state = 'running';

    await store.saveAgent(updatedAgent);
    await store.publishDomainEvent({
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      actor: adminContext.userId,
      actorDisplay: adminContext.userId,
      type: 'agent_triggered',
      source: 'control_plane_api',
      resourceType: 'agent',
      resourceId: updatedAgent.id,
      summary: `Insight agent triggered for ${updatedAgent.name}`,
      timestamp: now,
      metadata: { trigger: executionContext.trigger, taskId, executionId, eventCount: scopedEvents.length },
    });

    const candidates = dedupeSignals([
      ...scopedEvents.map((event) => toSignalFromEvent(event, scopedEvents.length)).filter(Boolean),
      ...usagePatterns.map(toSignalFromUsagePattern),
      ...researchRuns.map(toSignalFromResearchRun),
    ]).slice(0, input.signalLimit);

    const runId = `insight_run_${randomUUID()}`;
    const detectedAt = new Date().toISOString();
    const signals = await createSignals({
      store,
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      actor: adminContext.userId,
      runId,
      candidates,
      detectedAt,
    });

    const status = signals.length === 0 ? 'degraded' : 'completed';
    const task = updatedAgent.tasks.find((item) => item.id === taskId);
    const execution = updatedAgent.executionHistory.find((item) => item.id === executionId);
    if (!task || !execution) {
      throw new HttpError(409, 'AGENT_INSIGHT_STATE_INVALID', 'Missing task or execution state for insight agent run.');
    }

    task.status = toTaskStatus(status);
    task.updatedAt = detectedAt;
    execution.status = toExecutionStatus(status);
    execution.endedAt = detectedAt;
    execution.costUsd = estimateCost(signals.length, scopedEvents.length, usagePatterns.length);
    execution.outputSummary = summarizeRun(executionContext.trigger, signals);
    updatedAgent.queueDepth = Math.max(0, updatedAgent.queueDepth - 1);
    updatedAgent.lastHeartbeatAt = detectedAt;
    updatedAgent.state = status === 'degraded' ? 'throttled' : 'running';
    updatedAgent.logs.unshift({
      id: `log_${randomUUID()}`,
      level: status === 'degraded' ? 'warn' : 'info',
      source: 'insight-agent',
      message: `Insight detection completed with ${status} status and ${signals.length} signal(s).`,
      timestamp: detectedAt,
    });

    const run = {
      id: runId,
      agentId: updatedAgent.id,
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      trigger: executionContext.trigger,
      status,
      taskId,
      executionId,
      summary: summarizeRun(executionContext.trigger, signals),
      signalCount: signals.length,
      marketSignalIds: signals.map((signal) => signal.id),
      eventCount: scopedEvents.length,
      usagePatternCount: usagePatterns.length,
      researchRunCount: researchRuns.length,
      metadata: {
        processedEventIds: scopedEvents.map((event) => event.id),
        eventTypes: [...new Set(scopedEvents.map((event) => event.type))],
        signalTypes: [...new Set(signals.map((signal) => signal.signalType))],
        ...(input.metadata ?? {}),
      },
      createdAt: detectedAt,
    };

    const action = executionContext.trigger === 'event' ? 'insight_agent_process_events' : 'insight_agent_execute';
    const audit = await store.recordInsightAgentRun(run, action, adminContext.userId);
    await store.saveAgent(updatedAgent);
    await store.publishDomainEvent({
      tenantId: updatedAgent.tenantId,
      appId: updatedAgent.appId,
      actor: adminContext.userId,
      actorDisplay: adminContext.userId,
      type: 'agent_run_updated',
      source: 'control_plane_api',
      resourceType: 'agent',
      resourceId: updatedAgent.id,
      summary: `Insight agent ${updatedAgent.name} finished with ${status}`,
      timestamp: detectedAt,
      metadata: { taskId, executionId, taskStatus: task.status, executionStatus: execution.status, insightRunId: run.id, signalCount: run.signalCount },
    });

    return { item: run, agent: updatedAgent, signals, audit };
  }

  return {
    async listRuns(input = {}, filters = {}) {
      return store.listInsightAgentRuns({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        agentId: input.agentId,
        status: input.status,
        trigger: input.trigger,
        limit: input.limit ?? 20,
      });
    },
    async listSignals(input = {}, filters = {}) {
      return store.listMarketSignals({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        signalType: input.signalType,
        direction: input.direction,
        limit: input.limit ?? 20,
      });
    },
    async execute(input, adminContext, filters = {}) {
      return runInsight(input, adminContext, filters, { trigger: 'manual', events: null });
    },
    async processEvents(input, adminContext, filters = {}) {
      const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
      const priorRuns = await store.listInsightAgentRuns({
        tenantId: agent.tenantId,
        appId: agent.appId,
        agentId: agent.id,
        trigger: 'event',
        limit: 100,
      });
      const processedEventIds = collectProcessedEventIds(priorRuns);
      const recentEvents = await store.listEvents({ tenantId: agent.tenantId, appId: agent.appId, limit: input.eventLimit });
      const candidateEvents = recentEvents
        .filter((event) => !input.eventTypes?.length || input.eventTypes.includes(event.type))
        .filter((event) => !processedEventIds.has(event.id));

      if (!candidateEvents.length) {
        return { items: [] };
      }

      const result = await runInsight(input, adminContext, { tenantId: agent.tenantId, appId: agent.appId }, {
        trigger: 'event',
        events: candidateEvents,
      });
      return { items: [result.item] };
    },
  };
}