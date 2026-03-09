import { describe, expect, it } from 'vitest';

import { agentsData } from './data/platform-data.mjs';
import { createAgentOrchestratorService } from './agent-orchestrator.mjs';
import { createControlPlaneStore } from './store.mjs';

const ownerContext = {
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

function createRepositoryState() {
  const primary = structuredClone(agentsData.find((agent) => agent.id === 'agent_growth_01'));
  const secondary = structuredClone(primary);
  primary.tasks = [];
  primary.executionHistory = [];
  primary.logs = [];
  primary.queueDepth = 0;
  primary.lastTask = 'Idle';
  primary.orchestration = { ...primary.orchestration, blockers: [], dependencyState: 'ready', stage: 'reason', lane: 'Demand reasoning' };
  secondary.id = 'agent_growth_02';
  secondary.name = 'Growth Agent Twin';
  secondary.tasks = [];
  secondary.executionHistory = [];
  secondary.logs = [];
  secondary.queueDepth = 0;
  secondary.lastTask = 'Idle';
  secondary.orchestration = { ...secondary.orchestration, blockers: [], dependencyState: 'ready', stage: 'reason', lane: 'Demand reasoning' };
  return {
    agents: [primary, secondary],
    auditLogs: [],
    orchestratorWorkflows: [],
    events: [],
  };
}

describe('agent orchestrator service', () => {
  it('schedules a workflow across multiple same-scope agents', async () => {
    const state = createRepositoryState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const service = createAgentOrchestratorService({ store });

    const response = await service.scheduleWorkflow({
      title: 'Coordinate demand expansion',
      summary: 'Split demand reasoning across growth agents.',
      agentIds: ['agent_growth_01', 'agent_growth_02'],
      priority: 'high',
      metadata: { source: 'test' },
    }, ownerContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(response.item.participants).toHaveLength(2);
    expect(response.item.status).toBe('running');
    expect(response.audit.action).toBe('orchestrator_schedule');
    expect(store.listOrchestratorWorkflows({ tenantId: 'tenant_acme', appId: 'app_market_web' })).toEqual([
      expect.objectContaining({ id: response.item.id, participants: expect.any(Array) }),
    ]);
    expect(state.events.filter((item) => item.type === 'agent_task_scheduled')).toHaveLength(2);
  });

  it('updates lifecycle state and aggregates workflow output', async () => {
    const state = createRepositoryState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const service = createAgentOrchestratorService({ store });

    const scheduled = await service.scheduleWorkflow({
      title: 'Review supply memo',
      summary: 'Prepare memo and await review.',
      agentIds: ['agent_growth_01'],
      priority: 'medium',
      metadata: {},
    }, ownerContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    const review = await service.updateWorkflowLifecycle(scheduled.item.id, {
      agentId: 'agent_growth_01',
      taskStatus: 'waiting_review',
      blocker: 'Need operator sign-off',
      outputSummary: 'Draft memo prepared.',
    }, ownerContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(review.item.status).toBe('waiting_review');
    expect(review.agents[0]?.state).toBe('throttled');
    expect(review.agents[0]?.orchestration.blockers).toContain('Need operator sign-off');

    const completed = await service.updateWorkflowLifecycle(scheduled.item.id, {
      agentId: 'agent_growth_01',
      taskStatus: 'completed',
      outputSummary: 'Final memo delivered.',
      costUsd: 1.82,
    }, ownerContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(completed.item.status).toBe('completed');
    expect(completed.agents[0]?.queueDepth).toBe(0);
    expect(completed.agents[0]?.executionHistory[0]?.status).toBe('success');

    const aggregated = await service.aggregateWorkflow(scheduled.item.id, {
      outcome: 'success',
      summary: 'Workflow outputs merged into a single supply memo.',
      recommendations: ['Route memo to planning dashboard'],
    }, ownerContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(aggregated.item.outcome).toBe('success');
    expect(aggregated.item.aggregationSummary).toContain('merged');
    expect(state.events[0]?.type).toBe('workflow_aggregated');
  });
});