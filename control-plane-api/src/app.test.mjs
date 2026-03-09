import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startControlPlaneServer } from './app.mjs';

const adminHeaders = {
  authorization: 'Bearer test-token',
  'x-tenant-id': 'platform-root',
  'x-app-id': 'control-dashboard',
  'x-user-id': 'usr_platform_admin',
  'x-user-roles': 'platform_owner',
};

function buildAdminHeaders(role = 'platform_owner') {
  return {
    ...adminHeaders,
    'x-user-id': `usr_${role}`,
    'x-user-roles': role,
  };
}

describe('control plane api server', () => {
  let instance;

  beforeEach(async () => {
    instance = await startControlPlaneServer({
      host: '127.0.0.1',
      port: 0,
      token: 'test-token',
      allowedOrigin: 'http://localhost:3000',
      environment: 'test',
    });
  });

  afterEach(async () => {
    await instance.close();
  });

  it('serves health without authentication', async () => {
    const response = await fetch(`${instance.url}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('control-plane-api');
    expect(body.status).toBe('ok');
  });

  it('rejects protected routes without admin headers', async () => {
    const response = await fetch(`${instance.url}/admin/tenants`);
    expect(response.status).toBe(401);
  });

  it('returns rich tenant and agent data with valid admin context', async () => {
    const tenantsResponse = await fetch(`${instance.url}/admin/tenants`, {
      headers: adminHeaders,
    });
    expect(tenantsResponse.status).toBe(200);
    const tenantsBody = await tenantsResponse.json();
    expect(tenantsBody.items).toHaveLength(3);

    const agentsResponse = await fetch(`${instance.url}/admin/agents`, {
      headers: adminHeaders,
    });
    const agentsBody = await agentsResponse.json();
    expect(agentsBody.items[0].tasks.length).toBeGreaterThan(0);
    expect(agentsBody.items[0].orchestration.stage).toBe('reason');
  });

  it('supports shortest-path knowledge graph queries', async () => {
    const response = await fetch(
      `${instance.url}/admin/knowledge-graph?path_from=user:anaya&path_to=location:mumbai`,
      {
        headers: {
          ...adminHeaders,
          'x-tenant-id': 'tenant_acme',
          'x-app-id': 'app_market_web',
        },
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nodes.map((node) => node.id)).toEqual([
      'user:anaya',
      'listing:tractor301',
      'location:mumbai',
    ]);
    expect(body.edges.map((edge) => edge.id)).toEqual(['edge-3', 'edge-6']);
  });

  it('returns a 400 for incomplete knowledge graph path queries', async () => {
    const response = await fetch(`${instance.url}/admin/knowledge-graph?path_from=user:anaya`, {
      headers: adminHeaders,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_KNOWLEDGE_GRAPH_QUERY',
      },
    });
  });

  it('applies agent mutations', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_growth_01/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'pause' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent.state).toBe('paused');
  });

  it('lists the tool registry and executes safe tools with execution logs', async () => {
    const toolsResponse = await fetch(`${instance.url}/admin/tools`, { headers: adminHeaders });
    expect(toolsResponse.status).toBe(200);
    const toolsBody = await toolsResponse.json();
    expect(toolsBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'database.query.records', executionMode: 'read' }),
      expect.objectContaining({ name: 'analysis.summarize.signals', riskLevel: 'high' }),
    ]));

    const executeResponse = await fetch(`${instance.url}/admin/tools/execute`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'statistics.calculate.summary',
        input: { values: [12, 18, 21, 34], label: 'queue_depth' },
      }),
    });
    expect(executeResponse.status).toBe(200);
    const executeBody = await executeResponse.json();
    expect(executeBody.item.status).toBe('completed');
    expect(executeBody.result.payload.mean).toBe(21.25);

    const executionLogResponse = await fetch(`${instance.url}/admin/tools/executions?tool=statistics.calculate.summary&limit=5`, {
      headers: adminHeaders,
    });
    expect(executionLogResponse.status).toBe(200);
    const executionLogBody = await executionLogResponse.json();
    expect(executionLogBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'statistics.calculate.summary', status: 'completed' }),
    ]));
  });

  it('blocks tool execution when a caller lacks tool-specific permissions', async () => {
    const response = await fetch(`${instance.url}/admin/tools/execute`, {
      method: 'POST',
      headers: {
        ...buildAdminHeaders('viewer'),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'market.lookup.price',
        input: { category: 'Farm Equipment', location: 'Mumbai' },
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.item.status).toBe('blocked');
    expect(body.item.errorMessage).toContain('graph:read');
    expect(body.result).toBeNull();
  });

  it('moves an agent across orchestration stages', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_growth_01/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'move_stage',
        stage: 'act',
        lane: 'Tool execution',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent.orchestration.stage).toBe('act');
    expect(body.agent.orchestration.lane).toBe('Tool execution');
    expect(body.audit.summary).toBe('Moved stage to act · Tool execution');
  });

  it('retries a queue from the orchestration board', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_finance_03/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'retry_queue' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent.state).toBe('running');
    expect(body.agent.executionHistory[0].status).toBe('running');
    expect(body.audit.summary).toBe('Retried queue execution');
  });

  it('unblocks an agent from review', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_moderation_02/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'unblock' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent.orchestration.blockers).toHaveLength(0);
    expect(body.agent.orchestration.dependencyState).toBe('waiting');
    expect(body.audit.summary).toBe('Cleared active blockers');
  });

  it('reroutes an agent to another valid stage', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_growth_01/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'reroute',
        stage: 'review',
        lane: 'Human and policy review',
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.agent.orchestration.stage).toBe('review');
    expect(body.agent.orchestration.dependencyState).toBe('waiting');
    expect(body.audit.summary).toBe('Rerouted agent to review · Human and policy review');
  });

  it('rejects invalid dependency-aware stage moves', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_moderation_02/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'move_stage',
        stage: 'act',
        lane: 'Tool execution',
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('INVALID_STAGE_TRANSITION');
  });

  it('rejects queue retry while an agent remains blocked', async () => {
    const response = await fetch(`${instance.url}/admin/agents/agent_moderation_02/actions`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'retry_queue' }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('AGENT_BLOCKED');
  });

  it('schedules, updates, lists, and aggregates orchestrator workflows', async () => {
    const scheduleResponse = await fetch(`${instance.url}/admin/orchestrator/workflows`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Coordinate finance workflow',
        summary: 'Schedule a finance analysis workflow.',
        agentIds: ['agent_finance_03'],
        priority: 'high',
      }),
    });

    expect(scheduleResponse.status).toBe(200);
    const scheduledBody = await scheduleResponse.json();
    expect(scheduledBody.item.id).toMatch(/^workflow_/);
    expect(scheduledBody.audit.action).toBe('orchestrator_schedule');

    const listResponse = await fetch(`${instance.url}/admin/orchestrator/workflows?agent_id=agent_finance_03`, {
      headers: adminHeaders,
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: scheduledBody.item.id }),
    ]));

    const lifecycleResponse = await fetch(`${instance.url}/admin/orchestrator/workflows/${scheduledBody.item.id}/lifecycle`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        agentId: 'agent_finance_03',
        taskStatus: 'completed',
        outputSummary: 'Finance analysis packaged for review.',
        costUsd: 2.14,
      }),
    });

    expect(lifecycleResponse.status).toBe(200);
    const lifecycleBody = await lifecycleResponse.json();
    expect(lifecycleBody.item.status).toBe('completed');
    expect(lifecycleBody.audit.action).toBe('orchestrator_update');

    const aggregateResponse = await fetch(`${instance.url}/admin/orchestrator/workflows/${scheduledBody.item.id}/aggregate`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        outcome: 'success',
        summary: 'Finance workflow outputs merged into a decision memo.',
        recommendations: ['Publish memo to ops review'],
      }),
    });

    expect(aggregateResponse.status).toBe(200);
    const aggregateBody = await aggregateResponse.json();
    expect(aggregateBody.item.outcome).toBe('success');
    expect(aggregateBody.item.aggregationSummary).toContain('decision memo');
    expect(aggregateBody.audit.action).toBe('orchestrator_aggregate');
  });

  it('collects research, lists runs, and creates schedules', async () => {
    const collectResponse = await fetch(`${instance.url}/admin/research/collect`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
      body: JSON.stringify({
        source: 'market_api',
        query: 'NVDA AMD',
        limit: 2,
      }),
    });

    expect(collectResponse.status).toBe(200);
    const collectBody = await collectResponse.json();
    expect(collectBody.item.id).toMatch(/^research_run_/);
    expect(collectBody.item.documentsCreated).toBeGreaterThan(0);
    expect(collectBody.audit.action).toBe('research_collect');

    const runsResponse = await fetch(`${instance.url}/admin/research/runs?source=market_api`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    expect(runsResponse.status).toBe(200);
    const runsBody = await runsResponse.json();
    expect(runsBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: collectBody.item.id }),
    ]));

    const scheduleResponse = await fetch(`${instance.url}/admin/research/schedules`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
      body: JSON.stringify({
        name: 'Daily finance scan',
        source: 'rss',
        query: 'finance',
        intervalMinutes: 30,
        limit: 2,
      }),
    });

    expect(scheduleResponse.status).toBe(200);
    const scheduleBody = await scheduleResponse.json();
    expect(scheduleBody.item.id).toMatch(/^research_schedule_/);
    expect(scheduleBody.audit.action).toBe('research_schedule_create');

    const schedulesResponse = await fetch(`${instance.url}/admin/research/schedules`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    expect(schedulesResponse.status).toBe(200);
    const schedulesBody = await schedulesResponse.json();
    expect(schedulesBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: scheduleBody.item.id }),
    ]));

    const runDueResponse = await fetch(`${instance.url}/admin/research/schedules/run-due`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    expect(runDueResponse.status).toBe(200);
    const runDueBody = await runDueResponse.json();
    expect(Array.isArray(runDueBody.items)).toBe(true);
  });

  it('executes research agents and processes event triggers', async () => {
    const executeResponse = await fetch(`${instance.url}/admin/research-agent/execute`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
      body: JSON.stringify({
        agentId: 'agent_growth_01',
        source: 'market_api',
        query: 'NVDA AMD',
        limit: 2,
      }),
    });

    expect(executeResponse.status).toBe(200);
    const executeBody = await executeResponse.json();
    expect(executeBody.item.id).toMatch(/^research_agent_run_/);
    expect(executeBody.researchRun.id).toMatch(/^research_run_/);
    expect(executeBody.agent.tasks[0].title).toContain('Research');

    const runListResponse = await fetch(`${instance.url}/admin/research-agent/runs?agent_id=agent_growth_01`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    expect(runListResponse.status).toBe(200);
    const runListBody = await runListResponse.json();
    expect(runListBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: executeBody.item.id }),
    ]));

    const triggerResponse = await fetch(`${instance.url}/admin/research-agent/triggers`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
      body: JSON.stringify({
        agentId: 'agent_growth_01',
        name: 'Listing follow-up',
        triggerType: 'event',
        source: 'platform_activity',
        query: 'listing demand follow-up',
        eventTypes: ['listing_created'],
        limit: 1,
      }),
    });

    expect(triggerResponse.status).toBe(200);
    const triggerBody = await triggerResponse.json();
    expect(triggerBody.item.id).toMatch(/^research_agent_trigger_/);

    const processResponse = await fetch(`${instance.url}/admin/research-agent/triggers/process-events`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });

    expect(processResponse.status).toBe(200);
    const processBody = await processResponse.json();
    expect(processBody.items.length).toBeGreaterThan(0);
    expect(processBody.items[0].trigger).toBe('event');

    const triggerListResponse = await fetch(`${instance.url}/admin/research-agent/triggers?agent_id=agent_growth_01`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    expect(triggerListResponse.status).toBe(200);
    const triggerListBody = await triggerListResponse.json();
    expect(triggerListBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: triggerBody.item.id }),
    ]));
  });

  it('executes insight agents, lists runs, and emits market signals from platform events', async () => {
    const executeResponse = await fetch(`${instance.url}/admin/insight-agent/execute`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
      body: JSON.stringify({
        agentId: 'agent_finance_03',
        eventTypes: ['order_placed'],
        eventLimit: 10,
        usageLimit: 5,
        researchLimit: 3,
        signalLimit: 3,
      }),
    });

    expect(executeResponse.status).toBe(200);
    const executeBody = await executeResponse.json();
    expect(executeBody.item.id).toMatch(/^insight_run_/);
    expect(executeBody.item.signalCount).toBeGreaterThan(0);
    expect(executeBody.signals.length).toBeGreaterThan(0);
    expect(executeBody.audit.action).toBe('insight_agent_execute');

    const runsResponse = await fetch(`${instance.url}/admin/insight-agent/runs?agent_id=agent_finance_03`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
    });
    expect(runsResponse.status).toBe(200);
    const runsBody = await runsResponse.json();
    expect(runsBody.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: executeBody.item.id }),
    ]));

    const signalsResponse = await fetch(`${instance.url}/admin/market-signals?limit=5`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
    });
    expect(signalsResponse.status).toBe(200);
    const signalsBody = await signalsResponse.json();
    expect(signalsBody.items.length).toBeGreaterThan(0);

    const processResponse = await fetch(`${instance.url}/admin/insight-agent/process-events`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
      body: JSON.stringify({
        agentId: 'agent_finance_03',
        eventTypes: ['order_placed'],
        eventLimit: 10,
        usageLimit: 5,
        researchLimit: 3,
        signalLimit: 3,
      }),
    });
    expect(processResponse.status).toBe(200);
    const processBody = await processResponse.json();
    expect(processBody.items.length).toBeGreaterThan(0);
    expect(processBody.items[0].trigger).toBe('event');
  });

  it('executes recommendation agents, records outcomes, exposes performance, and accepts AI commands', async () => {
    const executeResponse = await fetch(`${instance.url}/admin/recommendation-agent/execute`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
      body: JSON.stringify({
        agentId: 'agent_finance_03',
        signalLimit: 5,
        behaviorLimit: 6,
        documentLimit: 4,
        maxRecommendations: 4,
      }),
    });
    expect(executeResponse.status).toBe(200);
    const executeBody = await executeResponse.json();
    expect(executeBody.item.id).toMatch(/^recommendation_run_/);
    expect(executeBody.recommendations.length).toBeGreaterThan(0);

    const recommendationsResponse = await fetch(`${instance.url}/admin/recommendations?agent_id=agent_finance_03`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
    });
    expect(recommendationsResponse.status).toBe(200);
    const recommendationsBody = await recommendationsResponse.json();
    expect(recommendationsBody.items.length).toBeGreaterThan(0);

    const outcomeResponse = await fetch(`${instance.url}/admin/agent-feedback/outcomes`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
      body: JSON.stringify({
        agentId: 'agent_finance_03',
        source: 'recommendation',
        status: 'success',
        score: 0.88,
        summary: 'Operator accepted the premium inventory recommendation.',
        relatedRecommendationId: executeBody.recommendations[0].id,
      }),
    });
    expect(outcomeResponse.status).toBe(200);
    const outcomeBody = await outcomeResponse.json();
    expect(outcomeBody.performance.feedbackScore).toBeGreaterThan(0);

    const performanceResponse = await fetch(`${instance.url}/admin/agent-performance?agent_id=agent_finance_03`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
    });
    expect(performanceResponse.status).toBe(200);
    const performanceBody = await performanceResponse.json();
    expect(performanceBody.items.length).toBeGreaterThan(0);
    expect(performanceBody.summary.totalOutcomes).toBeGreaterThan(0);

    const aiRecommendResponse = await fetch(`${instance.url}/ai/recommend`, {
      method: 'POST',
      headers: { ...adminHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Prioritize next actions for this tenant', history: [], pathname: '/agents' }),
    });
    expect(aiRecommendResponse.status).toBe(200);
    const aiRecommendBody = await aiRecommendResponse.json();
    expect(aiRecommendBody.route).toBe('recommend');
    expect(aiRecommendBody.message.toolCalls.some((call) => call.tool === 'control.read.recommendations')).toBe(true);

    const commandResponse = await fetch(`${instance.url}/ai/command`, {
      method: 'POST',
      headers: { ...adminHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Run recommendation agent for Finance Copilot', history: [], pathname: '/agents' }),
    });
    expect(commandResponse.status).toBe(200);
    const commandBody = await commandResponse.json();
    expect(commandBody.route).toBe('command');
    expect(commandBody.command.executedActions).toContain('control.run.recommendation-agent');
  });

  it('supports event filtering', async () => {
    const response = await fetch(
      `${instance.url}/admin/events?tenant_id=tenant_acme&event_type=agent_triggered`,
      { headers: adminHeaders },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].type).toBe('agent_triggered');
  });

  it('supports paginated and filtered catalog list responses', async () => {
    const response = await fetch(
      `${instance.url}/admin/apps?page=1&page_size=1&status=healthy&environment=production&q=vendor`,
      { headers: adminHeaders },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('app_vendor_flutter');
    expect(body.pageInfo.page).toBe(1);
    expect(body.pageInfo.pageSize).toBe(1);
    expect(body.pageInfo.totalItems).toBe(1);
  });

  it('streams scoped live events over SSE', async () => {
    const controller = new AbortController();
    const response = await fetch(
      `${instance.url}/admin/events/stream?event_type=agent_triggered`,
      {
        headers: {
          ...adminHeaders,
          'x-tenant-id': 'tenant_acme',
        },
        signal: controller.signal,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const reader = response.body.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    const payloadLine = chunk
      .split('\n')
      .find((line) => line.startsWith('data: '));

    expect(payloadLine).toBeDefined();
    const payload = JSON.parse(payloadLine.slice(6));
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].tenantId).toBe('tenant_acme');
    expect(payload.items[0].type).toBe('agent_triggered');

    await reader.cancel();
    controller.abort();
  });

  it('defaults list responses to the tenant/app scope in admin headers', async () => {
    const response = await fetch(`${instance.url}/admin/apps`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_vendor_flutter',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('app_vendor_flutter');
  });

  it('scopes overview metrics to the active tenant/app header context', async () => {
    const response = await fetch(`${instance.url}/admin/overview`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runningAgents).toBe(0);
    expect(body.queueBacklog).toBe(8);
    expect(body.metrics[0].value).toBe('1');
  });

  it('scopes observability client errors to the active tenant/app header context', async () => {
    const response = await fetch(`${instance.url}/admin/observability`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_vendor_flutter',
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(Array.isArray(body.clientErrors)).toBe(true);
  });

  it('applies rate limits and returns standard rate-limit headers on protected routes', async () => {
    const first = await fetch(`${instance.url}/admin/overview`, {
      headers: adminHeaders,
    });

    expect(first.status).toBe(200);
    expect(first.headers.get('x-ratelimit-limit')).toBe('120');
    expect(first.headers.get('x-ratelimit-remaining')).toBeTruthy();
    expect(first.headers.get('x-ratelimit-reset')).toBeTruthy();

    let lastResponse = first;
    for (let index = 0; index < 120; index += 1) {
      lastResponse = await fetch(`${instance.url}/admin/overview`, {
        headers: adminHeaders,
      });
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.headers.get('retry-after')).toBeTruthy();
    await expect(lastResponse.json()).resolves.toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });

  it('rejects requests from roles without the required permission', async () => {
    const response = await fetch(`${instance.url}/admin/system`, {
      headers: buildAdminHeaders('viewer'),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('allows permissioned roles through RBAC-protected endpoints', async () => {
    const response = await fetch(`${instance.url}/admin/analytics`, {
      headers: buildAdminHeaders('analyst'),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kpis.length).toBeGreaterThan(0);
  });

  it('creates and updates catalog records through protected admin endpoints', async () => {
    const tenantResponse = await fetch(`${instance.url}/admin/tenants`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Orion Labs',
        tier: 'growth',
        status: 'healthy',
        region: 'eu-west-1',
        monthlySpendUsd: 0,
        eventQuotaDaily: 10000,
      }),
    });

    expect(tenantResponse.status).toBe(200);
    const tenantBody = await tenantResponse.json();
    expect(tenantBody.item.id).toMatch(/^tenant_/);

    const appResponse = await fetch(`${instance.url}/admin/apps`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: 'tenant_acme',
        name: 'Acme Insights',
        runtime: 'admin',
        environment: 'staging',
        status: 'healthy',
        region: 'us-east-1',
        agentsAttached: 0,
      }),
    });

    expect(appResponse.status).toBe(200);
    const appBody = await appResponse.json();

    const userResponse = await fetch(`${instance.url}/admin/users`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: 'tenant_acme',
        appId: appBody.item.id,
        name: 'Taylor Analyst',
        role: 'analyst',
        status: 'invited',
      }),
    });

    expect(userResponse.status).toBe(200);
    const userBody = await userResponse.json();

    const patchResponse = await fetch(`${instance.url}/admin/users/${userBody.item.id}`, {
      method: 'PATCH',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'active', role: 'viewer', appId: appBody.item.id }),
    });

    expect(patchResponse.status).toBe(200);
    const patchBody = await patchResponse.json();
    expect(patchBody.item.status).toBe('active');
    expect(patchBody.item.role).toBe('viewer');

    const appEventsResponse = await fetch(`${instance.url}/admin/events?event_type=app_created`, {
      headers: adminHeaders,
    });
    expect(appEventsResponse.status).toBe(200);
    const appEventsBody = await appEventsResponse.json();
    expect(appEventsBody.items.some((event) => event.appId === appBody.item.id && event.type === 'app_created')).toBe(true);

    const userEventsResponse = await fetch(`${instance.url}/admin/events?event_type=user_updated`, {
      headers: adminHeaders,
    });
    expect(userEventsResponse.status).toBe(200);
    const userEventsBody = await userEventsResponse.json();
    expect(userEventsBody.items.some((event) => event.summary.includes('Updated user Taylor Analyst'))).toBe(true);
  });

  it('publishes model switch events through the admin event stream', async () => {
    const response = await fetch(`${instance.url}/admin/models/switch`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ key: 'planner', targetModel: 'gpt-4.1-mini' }),
    });

    expect(response.status).toBe(200);

    const eventsResponse = await fetch(`${instance.url}/admin/events?event_type=model_switched`, {
      headers: adminHeaders,
    });
    expect(eventsResponse.status).toBe(200);
    const eventsBody = await eventsResponse.json();
    expect(eventsBody.items[0]).toMatchObject({ type: 'model_switched', summary: 'Switched model to gpt-4.1-mini' });
  });

  it('serves AI Gateway analyze, research, and recommend workflows', async () => {
    const analyzeResponse = await fetch(`${instance.url}/ai/analyze`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'Summarize service health', history: [], pathname: '/observability' }),
    });

    expect(analyzeResponse.status).toBe(200);
    const analyzeBody = await analyzeResponse.json();
    expect(analyzeBody.route).toBe('analyze');
    expect(analyzeBody.promptTemplate).toBe('control_plane_analysis_v1');
    expect(analyzeBody.message.content).toContain('Summary for: Summarize service health');
    expect(analyzeBody.reasoning).toMatchObject({ mode: 'summarize', intent: 'observability' });

    const researchResponse = await fetch(`${instance.url}/ai/research`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'Show supply gaps', history: [], pathname: '/knowledge-graph' }),
    });

    expect(researchResponse.status).toBe(200);
    const researchBody = await researchResponse.json();
    expect(researchBody.route).toBe('research');
    expect(researchBody.reasoning).toMatchObject({ mode: 'summarize', intent: 'supply_gaps' });
    expect(researchBody.message.toolCalls.map((tool) => tool.tool)).toEqual([
      'control.read.knowledge-graph',
      'control.read.agents',
      'control.read.events',
      'control.read.market-signals',
      'control.read.recommendations',
    ]);

    const recommendResponse = await fetch(`${instance.url}/ai/recommend`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'What should I prioritize next?', history: [], pathname: '/analytics', maxRecommendations: 2 }),
    });

    expect(recommendResponse.status).toBe(200);
    const recommendBody = await recommendResponse.json();
    expect(recommendBody.route).toBe('recommend');
    expect(recommendBody.message.content).toContain('Decision:');
    expect(recommendBody.reasoning).toMatchObject({ mode: 'decide' });
    expect(recommendBody.guardrails.concurrency.limit).toBe(2);

    const eventsResponse = await fetch(`${instance.url}/admin/events?event_type=research_requested`, {
      headers: adminHeaders,
    });
    expect(eventsResponse.status).toBe(200);
    const eventsBody = await eventsResponse.json();
    expect(eventsBody.items.some((event) => event.type === 'research_requested')).toBe(true);
  });

  it('rejects over-budget AI Gateway requests', async () => {
    const response = await fetch(`${instance.url}/ai/analyze`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'A'.repeat(200),
        history: Array.from({ length: 20 }, (_, index) => ({
          id: `msg_${index}`,
          role: index % 2 === 0 ? 'user' : 'assistant',
          content: 'B'.repeat(300),
          createdAt: '2026-03-09T10:00:00.000Z',
          toolCalls: [],
        })),
        pathname: '/analytics',
      }),
    });

    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error.code).toBe('AI_GATEWAY_BUDGET_EXCEEDED');
  });

  it('embeds and persists batched documents through /embed', async () => {
    const beforeMemoryResponse = await fetch(`${instance.url}/admin/memory`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    const beforeMemoryBody = await beforeMemoryResponse.json();
    const beforeTotals = beforeMemoryBody.items
      .filter((item) => item.tenantId === 'tenant_acme' && item.appId === 'app_market_web')
      .reduce((totals, item) => ({ records: totals.records + item.records, vectorCount: totals.vectorCount + item.vectorCount }), { records: 0, vectorCount: 0 });

    const response = await fetch(`${instance.url}/embed`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          { text: 'Demand signals remain elevated in Mumbai for premium tractor listings.'.repeat(12), title: 'Mumbai demand memo', sourceType: 'research_note' },
          { text: 'Vendor response time is lagging for the same category and location.'.repeat(10), sourceType: 'event' },
        ],
        persist: true,
        chunkSize: 180,
        overlap: 30,
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.provider.model).toBe('bge-small-en-v1.5');
    expect(body.documents).toHaveLength(2);
    expect(body.embeddings.length).toBeGreaterThan(2);
    expect(body.persisted).toBe(true);

    const afterMemoryResponse = await fetch(`${instance.url}/admin/memory`, {
      headers: {
        ...adminHeaders,
        'x-tenant-id': 'tenant_acme',
        'x-app-id': 'app_market_web',
      },
    });
    const afterMemoryBody = await afterMemoryResponse.json();
    const afterTotals = afterMemoryBody.items
      .filter((item) => item.tenantId === 'tenant_acme' && item.appId === 'app_market_web')
      .reduce((totals, item) => ({ records: totals.records + item.records, vectorCount: totals.vectorCount + item.vectorCount }), { records: 0, vectorCount: 0 });

    expect(afterTotals.records).toBeGreaterThanOrEqual(beforeTotals.records + 2);
    expect(afterTotals.vectorCount).toBeGreaterThan(beforeTotals.vectorCount);
  });

  it('stores and retrieves conversation memory, preferences, and agent experience', async () => {
    const scopedHeaders = {
      ...adminHeaders,
      'x-tenant-id': 'tenant_acme',
      'x-app-id': 'app_market_web',
      'x-user-id': 'usr_platform_owner',
      'content-type': 'application/json',
    };

    const preferencesResponse = await fetch(`${instance.url}/memory/preferences`, {
      method: 'POST',
      headers: scopedHeaders,
      body: JSON.stringify({ items: [{ key: 'response_style', value: 'concise' }, { key: 'response_format', value: 'bullets' }] }),
    });
    expect(preferencesResponse.status).toBe(200);

    const experienceResponse = await fetch(`${instance.url}/memory/experience`, {
      method: 'POST',
      headers: scopedHeaders,
      body: JSON.stringify({ agentId: 'agent_growth_01', outcome: 'success', summary: 'Escalated the previous Mumbai demand spike quickly.' }),
    });
    expect(experienceResponse.status).toBe(200);

    const conversationResponse = await fetch(`${instance.url}/memory/conversations`, {
      method: 'POST',
      headers: scopedHeaders,
      body: JSON.stringify({
        sessionId: 'assistant-history:usr_platform_owner:tenant_acme:app_market_web',
        pathname: '/knowledge-graph',
        userMessage: 'Show supply gaps in Mumbai',
        assistantMessage: 'The strongest gap remains premium tractor supply in Mumbai.',
        toolCalls: [],
      }),
    });
    expect(conversationResponse.status).toBe(200);

    const listResponse = await fetch(`${instance.url}/memory/conversations?session_id=assistant-history:usr_platform_owner:tenant_acme:app_market_web&limit=5`, {
      headers: {
        authorization: scopedHeaders.authorization,
        'x-tenant-id': scopedHeaders['x-tenant-id'],
        'x-app-id': scopedHeaders['x-app-id'],
        'x-user-id': scopedHeaders['x-user-id'],
        'x-user-roles': scopedHeaders['x-user-roles'],
      },
    });
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items).toHaveLength(1);

    const retrieveResponse = await fetch(`${instance.url}/memory/retrieve`, {
      method: 'POST',
      headers: scopedHeaders,
      body: JSON.stringify({
        query: 'What did we say about the Mumbai supply gap?',
        sessionId: 'assistant-history:usr_platform_owner:tenant_acme:app_market_web',
        limit: 4,
        conversationLimit: 3,
      }),
    });
    expect(retrieveResponse.status).toBe(200);
    const retrieveBody = await retrieveResponse.json();
    expect(retrieveBody.preferences).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'response_style', value: 'concise' })]));
    expect(retrieveBody.conversation).toEqual(expect.arrayContaining([expect.objectContaining({ userMessage: 'Show supply gaps in Mumbai' })]));
    expect(retrieveBody.agentExperiences).toEqual(expect.arrayContaining([expect.objectContaining({ agentId: 'agent_growth_01', outcome: 'success' })]));
    expect(retrieveBody.items.length).toBeGreaterThan(0);
  });

  it('enforces tenant scope and role assignment rules on catalog mutations', async () => {
    const outOfScopeApp = await fetch(`${instance.url}/admin/apps`, {
      method: 'POST',
      headers: {
        ...buildAdminHeaders('tenant_admin'),
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: 'tenant_acme',
        name: 'Forbidden App',
        runtime: 'pwa',
        environment: 'development',
        status: 'healthy',
        region: 'us-east-1',
        agentsAttached: 0,
      }),
    });

    expect(outOfScopeApp.status).toBe(403);

    const invalidRoleUser = await fetch(`${instance.url}/admin/users`, {
      method: 'POST',
      headers: {
        ...buildAdminHeaders('tenant_admin'),
        'x-tenant-id': 'tenant_nova',
        'x-app-id': 'app_admin',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        name: 'Escalation Attempt',
        role: 'platform_admin',
        status: 'invited',
      }),
    });

    expect(invalidRoleUser.status).toBe(403);
    const body = await invalidRoleUser.json();
    expect(body.error.code).toBe('INVALID_ROLE');
  });

  it('persists control-plane mutations across restarts when CONTROL_PLANE_STATE_FILE is configured', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'control-plane-state-'));
    const stateFile = join(tempDir, 'state.json');

    try {
      await instance.close();
      instance = await startControlPlaneServer({
        host: '127.0.0.1',
        port: 0,
        token: 'test-token',
        allowedOrigin: 'http://localhost:3000',
        environment: 'test',
        stateFile,
      });

      const mutationResponse = await fetch(`${instance.url}/admin/agents/agent_growth_01/actions`, {
        method: 'POST',
        headers: {
          ...adminHeaders,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'pause' }),
      });

      expect(mutationResponse.status).toBe(200);
      await instance.close();

      instance = await startControlPlaneServer({
        host: '127.0.0.1',
        port: 0,
        token: 'test-token',
        allowedOrigin: 'http://localhost:3000',
        environment: 'test',
        stateFile,
      });

      const agentsResponse = await fetch(`${instance.url}/admin/agents`, {
        headers: adminHeaders,
      });

      expect(agentsResponse.status).toBe(200);
      const body = await agentsResponse.json();
      const agent = body.items.find((item) => item.id === 'agent_growth_01');
      expect(agent?.state).toBe('paused');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
