import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';

function addMinutes(timestamp, minutes) {
  return new Date(new Date(timestamp).getTime() + minutes * 60_000).toISOString();
}

function findScopedAgent(agents, agentId) {
  const agent = agents.find((item) => item.id === agentId);
  if (!agent) throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  return agent;
}

function assertAgentRunnable(agent) {
  if (agent.state === 'paused') {
    throw new HttpError(409, 'AGENT_PAUSED', `Agent ${agent.name} is paused and cannot run research.`);
  }
  if (agent.orchestration?.dependencyState === 'blocked') {
    throw new HttpError(409, 'AGENT_BLOCKED', `Agent ${agent.name} is blocked and cannot run research.`);
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

function estimateCost(researchRun) {
  return Number((0.02 + researchRun.documentsCreated * 0.015 + researchRun.embeddingsCreated * 0.005).toFixed(2));
}

function toEffectiveContext(adminContext, agent) {
  return {
    ...adminContext,
    tenantId: agent.tenantId,
    appId: agent.appId,
  };
}

function buildTaskTitle(query) {
  return `Research · ${query}`.slice(0, 120);
}

function buildTaskSummary(input, trigger) {
  return `Collect ${input.source} findings for ${input.query} via ${trigger} trigger.`;
}

async function saveTriggerRunState(store, trigger, adminContext, nextFields) {
  const updated = {
    ...trigger,
    ...nextFields,
    updatedAt: nextFields.updatedAt ?? new Date().toISOString(),
  };
  await store.saveResearchAgentTrigger(updated, 'research_agent_trigger_run', adminContext.userId);
  return updated;
}

export function createResearchAgentService({ store, researchService }) {
  return {
    async listRuns(input = {}, filters = {}) {
      return store.listResearchAgentRuns({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        agentId: input.agentId,
        status: input.status,
        trigger: input.trigger,
        limit: input.limit ?? 20,
      });
    },
    async execute(input, adminContext, filters = {}, executionContext = { trigger: 'manual' }) {
      const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
      assertAgentRunnable(agent);

      const now = new Date().toISOString();
      const updatedAgent = structuredClone(agent);
      const taskId = `task_${randomUUID()}`;
      const executionId = `exec_${randomUUID()}`;
      const effectiveContext = toEffectiveContext(adminContext, updatedAgent);

      updatedAgent.tasks.unshift({
        id: taskId,
        title: buildTaskTitle(input.query),
        summary: buildTaskSummary(input, executionContext.trigger),
        status: 'running',
        priority: updatedAgent.orchestration?.priority ?? 'medium',
        owner: 'research-agent',
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
        outputSummary: 'Research agent run started.',
      });
      updatedAgent.logs.unshift({
        id: `log_${randomUUID()}`,
        level: 'info',
        source: 'research-agent',
        message: `Research run started for ${input.query} by ${adminContext.userId}.`,
        timestamp: now,
      });
      updatedAgent.lastTask = buildTaskTitle(input.query);
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
        summary: `Research agent triggered for ${input.query}`,
        timestamp: now,
        metadata: {
          trigger: executionContext.trigger,
          triggerId: executionContext.triggerId,
          eventId: executionContext.event?.id,
          eventType: executionContext.event?.type,
          taskId,
          executionId,
          source: input.source,
        },
      });

      const researchResponse = await researchService.collect({
        source: input.source,
        query: input.query,
        sourceUri: input.sourceUri,
        limit: input.limit,
        persist: input.persist,
        metadata: {
          ...input.metadata,
          agentId: updatedAgent.id,
          taskId,
          executionId,
          trigger: executionContext.trigger,
          triggerId: executionContext.triggerId,
          eventId: executionContext.event?.id,
          eventType: executionContext.event?.type,
          eventSummary: executionContext.event?.summary,
        },
      }, effectiveContext, { tenantId: updatedAgent.tenantId, appId: updatedAgent.appId });

      const finishedAt = new Date().toISOString();
      const task = updatedAgent.tasks.find((item) => item.id === taskId);
      const execution = updatedAgent.executionHistory.find((item) => item.id === executionId);
      if (!task || !execution) {
        throw new HttpError(409, 'AGENT_RESEARCH_STATE_INVALID', 'Missing task or execution state for research agent run.');
      }

      task.status = toTaskStatus(researchResponse.item.status);
      task.updatedAt = finishedAt;
      execution.status = toExecutionStatus(researchResponse.item.status);
      execution.endedAt = finishedAt;
      execution.costUsd = estimateCost(researchResponse.item);
      execution.outputSummary = researchResponse.item.summary;
      updatedAgent.queueDepth = Math.max(0, updatedAgent.queueDepth - 1);
      updatedAgent.lastHeartbeatAt = finishedAt;
      updatedAgent.state = researchResponse.item.status === 'failed'
        ? 'error'
        : researchResponse.item.status === 'degraded'
          ? 'throttled'
          : 'running';
      updatedAgent.logs.unshift({
        id: `log_${randomUUID()}`,
        level: researchResponse.item.status === 'failed' ? 'error' : researchResponse.item.status === 'degraded' ? 'warn' : 'info',
        source: 'research-agent',
        message: `Research run completed with ${researchResponse.item.status} status for ${input.query}.`,
        timestamp: finishedAt,
      });

      const run = {
        id: `research_agent_run_${randomUUID()}`,
        agentId: updatedAgent.id,
        tenantId: updatedAgent.tenantId,
        appId: updatedAgent.appId,
        researchRunId: researchResponse.item.id,
        trigger: executionContext.trigger,
        triggerId: executionContext.triggerId,
        eventId: executionContext.event?.id,
        source: input.source,
        query: input.query,
        sourceUri: input.sourceUri,
        status: researchResponse.item.status,
        taskId,
        executionId,
        summary: researchResponse.item.summary,
        documentsCreated: researchResponse.item.documentsCreated,
        embeddingsCreated: researchResponse.item.embeddingsCreated,
        metadata: {
          provider: researchResponse.item.provider,
          degraded: researchResponse.item.degraded,
          ...(input.metadata ?? {}),
        },
        createdAt: finishedAt,
      };

      const audit = await store.recordResearchAgentRun(run, 'research_agent_execute', adminContext.userId);
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
        summary: `Research agent ${updatedAgent.name} finished with ${researchResponse.item.status}`,
        timestamp: finishedAt,
        metadata: {
          taskId,
          executionId,
          taskStatus: task.status,
          executionStatus: execution.status,
          trigger: executionContext.trigger,
          triggerId: executionContext.triggerId,
          eventId: executionContext.event?.id,
          researchRunId: researchResponse.item.id,
        },
      });

      return {
        item: run,
        agent: updatedAgent,
        researchRun: researchResponse.item,
        audit,
      };
    },
    async listTriggers(input = {}, filters = {}) {
      return store.listResearchAgentTriggers({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        agentId: input.agentId,
        triggerType: input.triggerType,
        status: input.status,
        limit: input.limit ?? 20,
      });
    },
    async createTrigger(input, adminContext, filters = {}) {
      const agent = findScopedAgent(await store.listAgents(filters), input.agentId);
      const now = new Date().toISOString();
      const trigger = {
        id: `research_agent_trigger_${randomUUID()}`,
        agentId: agent.id,
        tenantId: agent.tenantId,
        appId: agent.appId,
        name: input.name,
        triggerType: input.triggerType,
        source: input.source,
        query: input.query,
        sourceUri: input.sourceUri,
        intervalMinutes: input.intervalMinutes,
        eventTypes: input.eventTypes,
        limit: input.limit,
        persist: input.persist,
        status: input.status,
        nextRunAt: input.triggerType === 'schedule' ? addMinutes(now, input.intervalMinutes) : undefined,
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };
      const audit = await store.saveResearchAgentTrigger(trigger, 'research_agent_trigger_create', adminContext.userId);
      return { item: trigger, audit };
    },
    async runDueTriggers(adminContext, filters = {}) {
      const now = new Date().toISOString();
      const triggers = await store.listResearchAgentTriggers({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        triggerType: 'schedule',
        status: 'active',
        limit: filters.limit ?? 20,
      });
      const results = [];
      for (const trigger of triggers.filter((item) => item.nextRunAt && new Date(item.nextRunAt).getTime() <= new Date(now).getTime())) {
        try {
          const result = await this.execute({
            agentId: trigger.agentId,
            source: trigger.source,
            query: trigger.query,
            sourceUri: trigger.sourceUri,
            limit: trigger.limit,
            persist: trigger.persist,
            triggerId: trigger.id,
            metadata: trigger.metadata,
          }, adminContext, { tenantId: trigger.tenantId, appId: trigger.appId }, { trigger: 'schedule', triggerId: trigger.id });
          results.push(result.item);
          await saveTriggerRunState(store, trigger, adminContext, {
            lastRunAt: result.item.createdAt,
            nextRunAt: addMinutes(result.item.createdAt, trigger.intervalMinutes ?? 60),
            updatedAt: result.item.createdAt,
            metadata: { ...trigger.metadata },
          });
        } catch (error) {
          await saveTriggerRunState(store, trigger, adminContext, {
            lastRunAt: now,
            nextRunAt: addMinutes(now, trigger.intervalMinutes ?? 60),
            updatedAt: now,
            metadata: { ...trigger.metadata, lastError: error instanceof Error ? error.message : 'Unknown trigger error' },
          });
        }
      }
      return { items: results };
    },
    async processEventTriggers(adminContext, filters = {}) {
      const triggers = await store.listResearchAgentTriggers({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        triggerType: 'event',
        status: 'active',
        limit: filters.limit ?? 20,
      });
      const results = [];
      for (const trigger of triggers) {
        const scopedEvents = await store.listEvents({ tenantId: trigger.tenantId, appId: trigger.appId, limit: filters.eventLimit ?? 50 });
        const matchingEvents = scopedEvents
          .filter((event) => trigger.eventTypes?.includes(event.type))
          .filter((event) => !trigger.lastEventAt || new Date(event.timestamp).getTime() > new Date(trigger.lastEventAt).getTime())
          .sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());

        if (!matchingEvents.length) continue;

        let lastProcessedAt = trigger.lastEventAt;
        for (const event of matchingEvents.slice(0, filters.maxRunsPerTrigger ?? 3)) {
          try {
            const result = await this.execute({
              agentId: trigger.agentId,
              source: trigger.source,
              query: trigger.query,
              sourceUri: trigger.sourceUri,
              limit: trigger.limit,
              persist: trigger.persist,
              triggerId: trigger.id,
              eventId: event.id,
              metadata: { ...trigger.metadata, triggerEventType: event.type },
            }, adminContext, { tenantId: trigger.tenantId, appId: trigger.appId }, { trigger: 'event', triggerId: trigger.id, event });
            results.push(result.item);
            lastProcessedAt = event.timestamp;
          } catch (error) {
            await saveTriggerRunState(store, trigger, adminContext, {
              updatedAt: new Date().toISOString(),
              metadata: { ...trigger.metadata, lastError: error instanceof Error ? error.message : 'Unknown trigger error' },
            });
            break;
          }
        }

        if (lastProcessedAt && lastProcessedAt !== trigger.lastEventAt) {
          await saveTriggerRunState(store, trigger, adminContext, {
            lastEventAt: lastProcessedAt,
            lastRunAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: { ...trigger.metadata },
          });
        }
      }
      return { items: results };
    },
  };
}