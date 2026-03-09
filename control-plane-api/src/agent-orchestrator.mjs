import { randomUUID } from 'node:crypto';

import { HttpError } from './http.mjs';
import { canMoveToStage, getInvalidTransitionMessage, getNextDependencyState } from './orchestration.mjs';

function deriveWorkflowStatus(participants) {
  if (participants.some((item) => item.status === 'waiting_review')) return 'waiting_review';
  if (participants.some((item) => item.status === 'running')) return 'running';
  if (participants.some((item) => item.status === 'queued')) return 'queued';
  if (participants.every((item) => item.status === 'completed')) return 'completed';
  if (participants.some((item) => item.status === 'failed')) return 'failed';
  return 'queued';
}

function inferExecutionStatus(taskStatus) {
  if (taskStatus === 'completed') return 'success';
  if (taskStatus === 'failed') return 'failed';
  if (taskStatus === 'waiting_review') return 'warning';
  return 'running';
}

function priorityToNumber(priority) {
  return priority === 'high' ? 2 : priority === 'medium' ? 1 : 0;
}

function applyStageChange(agent, stage, lane, now) {
  if (!stage || stage === agent.orchestration.stage) {
    if (lane) agent.orchestration.lane = lane;
    return;
  }
  const transitionContext = {
    currentStage: agent.orchestration.stage,
    dependencyState: agent.orchestration.dependencyState,
  };
  if (!canMoveToStage(transitionContext, stage)) {
    throw new HttpError(409, 'INVALID_STAGE_TRANSITION', getInvalidTransitionMessage(transitionContext, stage));
  }
  agent.orchestration.stage = stage;
  if (lane) agent.orchestration.lane = lane;
  agent.orchestration.stageEnteredAt = now;
  agent.orchestration.dependencyState = getNextDependencyState(agent.orchestration.stage, agent.orchestration.blockers.length);
}

function getScopedAgents(agents, agentIds) {
  const selected = agents.filter((agent) => agentIds.includes(agent.id));
  const missing = agentIds.filter((agentId) => !selected.some((agent) => agent.id === agentId));
  if (missing.length) {
    throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${missing.join(', ')}.`);
  }
  return selected;
}

function assertSharedScope(agents) {
  const [first] = agents;
  if (!first) return;
  const mismatch = agents.find((agent) => agent.tenantId !== first.tenantId || agent.appId !== first.appId);
  if (mismatch) {
    throw new HttpError(409, 'CROSS_SCOPE_WORKFLOW_NOT_SUPPORTED', 'All workflow participants must belong to the same tenant and app scope.');
  }
}

export function createAgentOrchestratorService({ store }) {
  return {
    async listWorkflows(input = {}, filters = {}) {
      return store.listOrchestratorWorkflows({
        tenantId: filters.tenantId ?? null,
        appId: filters.appId ?? null,
        status: input.status,
        agentId: input.agentId,
        limit: input.limit ?? 20,
      });
    },
    async scheduleWorkflow(input, adminContext, filters) {
      const now = new Date().toISOString();
      const workflowId = `workflow_${randomUUID()}`;
      const owner = input.owner ?? adminContext.userId;
      const selectedAgents = getScopedAgents(await store.listAgents(filters), input.agentIds);
      assertSharedScope(selectedAgents);
      const updatedAgents = selectedAgents.map((agent) => {
        const updated = structuredClone(agent);
        applyStageChange(updated, input.stage, input.lane, now);
        const taskId = `task_${randomUUID()}`;
        const executionId = `exec_${randomUUID()}`;
        const taskStatus = updated.state === 'paused' || updated.orchestration.dependencyState !== 'ready' ? 'queued' : 'running';
        const executionStatus = taskStatus === 'queued' ? 'warning' : 'running';
        updated.tasks.unshift({ id: taskId, title: input.title, summary: input.summary, status: taskStatus, priority: input.priority, owner, workflowId, executionId, startedAt: now, updatedAt: now });
        updated.executionHistory.unshift({ id: executionId, workflowVersion: updated.workflowVersion, workflowId, taskId, status: executionStatus, startedAt: now, endedAt: now, costUsd: 0, outputSummary: taskStatus === 'running' ? 'Scheduled by orchestrator.' : 'Scheduled by orchestrator and waiting on dependencies.' });
        updated.logs.unshift({ id: `log_${randomUUID()}`, level: 'info', source: 'orchestrator', message: `Scheduled workflow ${workflowId} by ${adminContext.userId}.`, timestamp: now });
        updated.lastTask = input.title;
        updated.queueDepth += 1;
        if (taskStatus === 'running') updated.state = 'running';
        return updated;
      });

      const workflow = {
        id: workflowId,
        tenantId: updatedAgents[0]?.tenantId ?? adminContext.tenantId,
        appId: updatedAgents[0]?.appId ?? adminContext.appId,
        title: input.title,
        summary: input.summary,
        status: deriveWorkflowStatus(updatedAgents.map((agent) => ({ agentId: agent.id, taskId: agent.tasks[0].id, executionId: agent.executionHistory[0].id, status: agent.tasks[0].status, updatedAt: now }))),
        priority: input.priority,
        owner,
        stage: input.stage ?? updatedAgents[0]?.orchestration.stage ?? 'intake',
        lane: input.lane ?? updatedAgents[0]?.orchestration.lane ?? 'active',
        participants: updatedAgents.map((agent) => ({ agentId: agent.id, taskId: agent.tasks[0].id, executionId: agent.executionHistory[0].id, status: agent.tasks[0].status, updatedAt: now })),
        recommendations: [],
        metadata: input.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      };

      await Promise.all(updatedAgents.map((agent) => store.saveAgent(agent)));
      const audit = await store.recordOrchestratorWorkflow(workflow, 'orchestrator_schedule', adminContext.userId);
      await Promise.all(updatedAgents.map((agent) => store.publishDomainEvent({
        tenantId: agent.tenantId,
        appId: agent.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'agent_task_scheduled',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: agent.id,
        summary: `Scheduled ${input.title}`,
        timestamp: now,
        metadata: { workflowId, taskId: agent.tasks[0].id, executionId: agent.executionHistory[0].id, taskStatus: agent.tasks[0].status, priority: priorityToNumber(input.priority) },
      })));
      return { item: workflow, agents: updatedAgents, audit };
    },
    async updateWorkflowLifecycle(workflowId, input, adminContext, filters) {
      const now = new Date().toISOString();
      const workflow = await store.getOrchestratorWorkflow(workflowId, filters);
      if (!workflow) throw new HttpError(404, 'WORKFLOW_NOT_FOUND', `No workflow found for ${workflowId}.`);
      const agent = getScopedAgents(await store.listAgents(filters), [input.agentId])[0];
      const updatedAgent = structuredClone(agent);
      const participant = workflow.participants.find((item) => item.agentId === input.agentId);
      if (!participant) throw new HttpError(404, 'WORKFLOW_PARTICIPANT_NOT_FOUND', `No workflow participant found for ${input.agentId}.`);
      const task = updatedAgent.tasks.find((item) => item.id === participant.taskId);
      const execution = updatedAgent.executionHistory.find((item) => item.id === participant.executionId);
      if (!task || !execution) throw new HttpError(409, 'WORKFLOW_STATE_INVALID', 'Workflow participant is missing task or execution state.');

      applyStageChange(updatedAgent, input.stage, input.lane, now);
      task.status = input.taskStatus;
      task.updatedAt = now;
      execution.status = input.executionStatus ?? inferExecutionStatus(input.taskStatus);
      execution.endedAt = now;
      execution.costUsd = input.costUsd ?? execution.costUsd;
      execution.outputSummary = input.outputSummary ?? execution.outputSummary;
      participant.status = input.taskStatus;
      participant.outputSummary = input.outputSummary ?? participant.outputSummary;
      participant.updatedAt = now;

      if (input.taskStatus === 'running') {
        updatedAgent.state = 'running';
        updatedAgent.queueDepth = Math.max(updatedAgent.queueDepth, 1);
      } else if (input.taskStatus === 'waiting_review') {
        updatedAgent.state = 'throttled';
        const blocker = input.blocker ?? 'Awaiting human review';
        if (!updatedAgent.orchestration.blockers.includes(blocker)) updatedAgent.orchestration.blockers.push(blocker);
        updatedAgent.orchestration.dependencyState = 'blocked';
      } else if (input.taskStatus === 'completed') {
        updatedAgent.state = 'running';
        updatedAgent.queueDepth = Math.max(0, updatedAgent.queueDepth - 1);
        updatedAgent.orchestration.blockers = updatedAgent.orchestration.blockers.filter((item) => item !== (input.blocker ?? 'Awaiting human review') && item !== 'Awaiting human review');
        updatedAgent.orchestration.dependencyState = getNextDependencyState(updatedAgent.orchestration.stage, updatedAgent.orchestration.blockers.length);
      } else if (input.taskStatus === 'failed') {
        updatedAgent.state = 'error';
        updatedAgent.queueDepth = Math.max(0, updatedAgent.queueDepth - 1);
        if (input.blocker && !updatedAgent.orchestration.blockers.includes(input.blocker)) updatedAgent.orchestration.blockers.push(input.blocker);
        updatedAgent.orchestration.dependencyState = getNextDependencyState(updatedAgent.orchestration.stage, updatedAgent.orchestration.blockers.length);
      }

      updatedAgent.logs.unshift({ id: `log_${randomUUID()}`, level: input.taskStatus === 'failed' ? 'error' : input.taskStatus === 'waiting_review' ? 'warn' : 'info', source: 'orchestrator', message: `Workflow ${workflowId} updated to ${input.taskStatus} by ${adminContext.userId}.`, timestamp: now });

      const updatedWorkflow = {
        ...workflow,
        stage: input.stage ?? workflow.stage,
        lane: input.lane ?? workflow.lane,
        participants: workflow.participants.map((item) => item.agentId === input.agentId ? participant : item),
        status: deriveWorkflowStatus(workflow.participants.map((item) => item.agentId === input.agentId ? participant : item)),
        updatedAt: now,
      };
      if (['completed', 'failed'].includes(updatedWorkflow.status) && updatedWorkflow.participants.every((item) => ['completed', 'failed'].includes(item.status))) {
        updatedWorkflow.completedAt = now;
      }

      await store.saveAgent(updatedAgent);
      const audit = await store.recordOrchestratorWorkflow(updatedWorkflow, 'orchestrator_update', adminContext.userId);
      await store.publishDomainEvent({
        tenantId: updatedAgent.tenantId,
        appId: updatedAgent.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'agent_run_updated',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: updatedAgent.id,
        summary: `Workflow ${workflowId} updated to ${input.taskStatus}`,
        timestamp: now,
        metadata: { workflowId, taskId: task.id, executionId: execution.id, taskStatus: input.taskStatus, executionStatus: execution.status },
      });
      return { item: updatedWorkflow, agents: [updatedAgent], audit };
    },
    async aggregateWorkflow(workflowId, input, adminContext, filters) {
      const now = new Date().toISOString();
      const workflow = await store.getOrchestratorWorkflow(workflowId, filters);
      if (!workflow) throw new HttpError(404, 'WORKFLOW_NOT_FOUND', `No workflow found for ${workflowId}.`);
      if (workflow.participants.some((item) => ['queued', 'running'].includes(item.status))) {
        throw new HttpError(409, 'WORKFLOW_STILL_RUNNING', 'Queued or running workflow participants must finish before aggregation.');
      }
      const agents = getScopedAgents(await store.listAgents(filters), workflow.participants.map((item) => item.agentId)).map((agent) => {
        const updated = structuredClone(agent);
        updated.logs.unshift({ id: `log_${randomUUID()}`, level: input.outcome === 'failed' ? 'error' : input.outcome === 'warning' ? 'warn' : 'info', source: 'orchestrator', message: `Workflow ${workflowId} aggregated by ${adminContext.userId}: ${input.summary}`, timestamp: now });
        return updated;
      });
      const updatedWorkflow = {
        ...workflow,
        status: input.outcome === 'failed' ? 'failed' : 'completed',
        aggregationSummary: input.summary,
        outcome: input.outcome,
        recommendations: input.recommendations,
        updatedAt: now,
        completedAt: now,
      };

      await Promise.all(agents.map((agent) => store.saveAgent(agent)));
      const audit = await store.recordOrchestratorWorkflow(updatedWorkflow, 'orchestrator_aggregate', adminContext.userId);
      await store.publishDomainEvent({
        tenantId: updatedWorkflow.tenantId,
        appId: updatedWorkflow.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'workflow_aggregated',
        source: 'control_plane_api',
        resourceType: 'workflow',
        resourceId: updatedWorkflow.id,
        summary: input.summary,
        timestamp: now,
        metadata: { outcome: input.outcome, participantCount: updatedWorkflow.participants.length, recommendations: input.recommendations },
      });
      return { item: updatedWorkflow, agents, audit };
    },
  };
}