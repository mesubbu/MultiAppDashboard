import {
  analyticsData,
  appsData,
  agentsData,
  eventsData,
  graphEdgesData,
  graphNodesData,
  memoryData,
  modelsData,
  observabilityData,
  overviewData,
  systemData,
  tenantsData,
  toolsData,
  usersData,
} from './data/platform-data.mjs';
import { HttpError } from './http.mjs';
import {
  canMoveToStage,
  getNextDependencyState,
  getInvalidTransitionMessage,
} from './orchestration.mjs';
import {
  enrichObservabilityServices,
  loadPrometheusServiceMetrics,
} from './prometheus-observability.mjs';
import { applyObservabilityAlertThresholds } from './observability-alert-thresholds.mjs';
import { applyKnowledgeGraphQuery } from './knowledge-graph.mjs';
import { publishControlPlaneDomainEvent } from './domain-events.mjs';

function buildAgentActionSummary(action, details = {}) {
  const stageSuffix = details.stage ? ` to ${details.stage}` : '';
  const laneSuffix = details.lane ? ` · ${details.lane}` : '';

  switch (action) {
    case 'move_stage':
      return `Moved stage${stageSuffix}${laneSuffix}`;
    case 'retry_queue':
      return 'Retried queue execution';
    case 'unblock':
      return 'Cleared active blockers';
    case 'reroute':
      return `Rerouted agent${stageSuffix}${laneSuffix}`;
    case 'pause':
      return 'Paused agent execution';
    case 'restart':
      return 'Restarted agent execution';
    case 'update_budget':
      return 'Updated agent budget';
    case 'update_workflow':
      return 'Updated workflow version';
    default:
      return `Completed ${action.replaceAll('_', ' ')}`;
  }
}

function clone(value) {
  return structuredClone(value);
}

function cosineSimilarity(left = [], right = []) {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function updateToolTelemetry(tool, execution) {
  const priorUsage = Math.max(tool.usageToday ?? 0, 0);
  const failureRate = execution.status === 'failed' ? 100 : 0;
  tool.usageToday = priorUsage + 1;
  tool.p95Ms = priorUsage === 0 ? execution.durationMs : Math.max(tool.p95Ms ?? 0, execution.durationMs);
  tool.errorRate = Number((((tool.errorRate ?? 0) * priorUsage) + failureRate) / Math.max(tool.usageToday, 1)).toFixed(2);
}

function filterScopedItems(items, filters = {}) {
  return items.filter((item) => {
    if (filters.tenantId && item.tenantId && item.tenantId !== filters.tenantId) {
      return false;
    }

    if (filters.appId && item.appId && item.appId !== filters.appId) {
      return false;
    }

    return true;
  });
}

function filterScopedTenants(items, filters = {}) {
  return filters.tenantId ? items.filter((tenant) => tenant.id === filters.tenantId) : items;
}

function filterScopedApps(items, filters = {}) {
  return items.filter((app) => {
    if (filters.tenantId && app.tenantId !== filters.tenantId) {
      return false;
    }

    if (filters.appId && app.id !== filters.appId) {
      return false;
    }

    return true;
  });
}

function canAccessAllTenants(roles = []) {
  return roles.some((role) => ['platform_owner', 'platform_admin', 'ops_admin'].includes(role));
}

function ensureTenantWritable(adminContext, tenantId) {
  if (!canAccessAllTenants(adminContext.roles) && adminContext.tenantId !== tenantId) {
    throw new HttpError(403, 'INVALID_SCOPE', 'You can only manage resources within your tenant scope.');
  }
}

function ensureAssignableRole(adminContext, role) {
  if (adminContext.roles.includes('platform_owner')) {
    return;
  }

  if (adminContext.roles.includes('tenant_admin') && ['tenant_admin', 'analyst', 'viewer'].includes(role)) {
    return;
  }

  throw new HttpError(403, 'INVALID_ROLE', 'You cannot assign the requested platform role.');
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function buildUniqueId(prefix, name, existingIds) {
  const base = slugify(name) || crypto.randomUUID().slice(0, 8);
  const used = new Set(existingIds);
  let candidate = `${prefix}${base}`;
  let index = 2;

  while (used.has(candidate)) {
    candidate = `${prefix}${base}_${index}`;
    index += 1;
  }

  return candidate;
}

function findTenant(state, tenantId) {
  const tenant = state.tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    throw new HttpError(404, 'TENANT_NOT_FOUND', `No tenant found for ${tenantId}.`);
  }
  return tenant;
}

function findApp(state, appId) {
  const app = state.apps.find((item) => item.id === appId);
  if (!app) {
    throw new HttpError(404, 'APP_NOT_FOUND', `No app found for ${appId}.`);
  }
  return app;
}

function findUser(state, userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    throw new HttpError(404, 'USER_NOT_FOUND', `No user found for ${userId}.`);
  }
  return user;
}

export function createInitialControlPlaneState() {
  return {
    overview: clone(overviewData),
    tenants: clone(tenantsData),
    apps: clone(appsData),
    users: clone(usersData),
    agents: clone(agentsData),
    tools: clone(toolsData),
    models: clone(modelsData),
    memory: clone(memoryData),
    graphNodes: clone(graphNodesData),
    graphEdges: clone(graphEdgesData),
    documents: [],
    embeddings: [],
    usagePatterns: [],
    toolExecutions: [],
    orchestratorWorkflows: [],
    researchRuns: [],
    researchSchedules: [],
    researchAgentRuns: [],
    researchAgentTriggers: [],
    insightAgentRuns: [],
    recommendationAgentRuns: [],
    agentPerformance: [],
    marketSignals: [],
    knowledgeEvents: [],
    events: clone(eventsData),
    analytics: clone(analyticsData),
    observability: clone(observabilityData),
    system: clone(systemData),
    auditLogs: [],
  };
}

export function createControlPlaneStore(options = {}) {
  const localState = createInitialControlPlaneState();

  function getState() {
    return options.repository?.getState() ?? localState;
  }

  async function persistState() {
    await options.repository?.persist();
  }

  function upsertMemoryRecord(state, tenantId, appId, documentsCreated, embeddingsCreated) {
    if (!tenantId || !appId) {
      return;
    }

    const existing = state.memory.find((item) => item.tenantId === tenantId && item.appId === appId && item.scope === 'app');
    if (existing) {
      existing.records += documentsCreated;
      existing.vectorCount += embeddingsCreated;
      return;
    }

    state.memory.unshift({
      id: `mem_embed_${tenantId}_${appId}`,
      scope: 'app',
      tenantId,
      appId,
      records: documentsCreated,
      vectorCount: embeddingsCreated,
      lastCompactionAt: new Date().toISOString(),
    });
  }

  return {
    getHealth() {
      const state = getState();
      return {
        status: 'ok',
        services: state.observability.length,
        timestamp: new Date().toISOString(),
      };
    },
    getOverview(filters = {}) {
      const state = getState();
      const scopedTenants = filterScopedTenants(state.tenants, filters);
      const scopedAgents = filterScopedItems(state.agents, filters);
      const scopedEvents = filterScopedItems(state.events, filters);
      const runningAgents = scopedAgents.filter((agent) => agent.state === 'running').length;
      const queueBacklog = scopedAgents.reduce((sum, agent) => sum + agent.queueDepth, 0);
      const healthyServices = state.observability.filter(
        (service) => service.status === 'healthy',
      ).length;
      const base = clone(state.overview);
      base.metrics = [
        { ...base.metrics[0], value: `${scopedTenants.length}` },
        { ...base.metrics[1], value: `${runningAgents}` },
        { ...base.metrics[2], value: `${queueBacklog}` },
        base.metrics[3],
      ];
      base.runningAgents = runningAgents;
      base.queueBacklog = queueBacklog;
      base.healthyServices = healthyServices;
      base.liveEventsPerMinute = scopedEvents.length * 12;
      return base;
    },
    listTenants(filters = {}) {
      const state = getState();
      return clone(filterScopedTenants(state.tenants, filters));
    },
    async createTenant(payload, adminContext) {
      const state = getState();
      const timestamp = new Date().toISOString();
      const tenant = {
        id: buildUniqueId('tenant_', payload.name, state.tenants.map((item) => item.id)),
        name: payload.name,
        tier: payload.tier,
        status: payload.status,
        region: payload.region,
        apps: 0,
        users: 0,
        monthlySpendUsd: payload.monthlySpendUsd,
        eventQuotaDaily: payload.eventQuotaDaily,
      };

      state.tenants.unshift(tenant);
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'tenant_create',
        resourceType: 'tenant',
        resourceId: tenant.id,
        tenantId: tenant.id,
        timestamp,
        summary: `Created tenant ${tenant.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: adminContext.tenantId || 'platform-root',
        appId: adminContext.appId || 'control-dashboard',
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'tenant_created',
        source: 'control_plane_api',
        resourceType: 'tenant',
        resourceId: tenant.id,
        summary: `Created tenant ${tenant.name}`,
        timestamp,
        metadata: { targetTenantId: tenant.id, status: tenant.status, tier: tenant.tier },
      }, { state });
      await persistState();
      return clone(tenant);
    },
    async updateTenant(tenantId, payload, adminContext) {
      const state = getState();
      const tenant = findTenant(state, tenantId);
      ensureTenantWritable(adminContext, tenant.id);
      Object.assign(tenant, payload);
      const timestamp = new Date().toISOString();
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'tenant_update',
        resourceType: 'tenant',
        resourceId: tenant.id,
        tenantId: tenant.id,
        timestamp,
        summary: `Updated tenant ${tenant.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: adminContext.tenantId || 'platform-root',
        appId: adminContext.appId || 'control-dashboard',
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'tenant_updated',
        source: 'control_plane_api',
        resourceType: 'tenant',
        resourceId: tenant.id,
        summary: `Updated tenant ${tenant.name}`,
        timestamp,
        metadata: { targetTenantId: tenant.id, changes: payload },
      }, { state });
      await persistState();
      return clone(tenant);
    },
    listApps(filters = {}) {
      const state = getState();
      return clone(filterScopedApps(state.apps, filters));
    },
    async createApp(payload, adminContext) {
      const state = getState();
      const timestamp = new Date().toISOString();
      ensureTenantWritable(adminContext, payload.tenantId);
      const tenant = findTenant(state, payload.tenantId);
      const app = {
        id: buildUniqueId('app_', payload.name, state.apps.map((item) => item.id)),
        ...payload,
      };

      state.apps.unshift(app);
      tenant.apps += 1;
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'app_create',
        resourceType: 'app',
        resourceId: app.id,
        tenantId: app.tenantId,
        appId: app.id,
        timestamp,
        summary: `Created app ${app.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: app.tenantId,
        appId: app.id,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'app_created',
        source: 'control_plane_api',
        resourceType: 'app',
        resourceId: app.id,
        summary: `Created app ${app.name}`,
        timestamp,
        metadata: { runtime: app.runtime, environment: app.environment, status: app.status },
      }, { state });
      await persistState();
      return clone(app);
    },
    async updateApp(appId, payload, adminContext) {
      const state = getState();
      const app = findApp(state, appId);
      ensureTenantWritable(adminContext, app.tenantId);
      Object.assign(app, payload);
      const timestamp = new Date().toISOString();
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'app_update',
        resourceType: 'app',
        resourceId: app.id,
        tenantId: app.tenantId,
        appId: app.id,
        timestamp,
        summary: `Updated app ${app.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: app.tenantId,
        appId: app.id,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'app_updated',
        source: 'control_plane_api',
        resourceType: 'app',
        resourceId: app.id,
        summary: `Updated app ${app.name}`,
        timestamp,
        metadata: { changes: payload },
      }, { state });
      await persistState();
      return clone(app);
    },
    listUsers(filters = {}) {
      const state = getState();
      return clone(filterScopedItems(state.users, filters));
    },
    async createUser(payload, adminContext) {
      const state = getState();
      const timestamp = new Date().toISOString();
      ensureTenantWritable(adminContext, payload.tenantId);
      ensureAssignableRole(adminContext, payload.role);
      const tenant = findTenant(state, payload.tenantId);
      const app = findApp(state, payload.appId);
      if (app.tenantId !== payload.tenantId) {
        throw new HttpError(400, 'INVALID_APP_SCOPE', 'The selected app does not belong to the selected tenant.');
      }

      const user = {
        id: buildUniqueId('usr_', payload.name, state.users.map((item) => item.id)),
        ...payload,
        lastSeenAt: new Date().toISOString(),
      };

      state.users.unshift(user);
      tenant.users += 1;
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'user_create',
        resourceType: 'user',
        resourceId: user.id,
        tenantId: user.tenantId,
        appId: user.appId,
        timestamp,
        summary: `Created user ${user.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: user.tenantId,
        appId: user.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'user_created',
        source: 'control_plane_api',
        resourceType: 'user',
        resourceId: user.id,
        summary: `Created user ${user.name}`,
        timestamp,
        metadata: { role: user.role, status: user.status },
      }, { state });
      await persistState();
      return clone(user);
    },
    async updateUser(userId, payload, adminContext) {
      const state = getState();
      const user = findUser(state, userId);
      ensureTenantWritable(adminContext, user.tenantId);
      if (payload.role) {
        ensureAssignableRole(adminContext, payload.role);
      }
      if (payload.appId) {
        const app = findApp(state, payload.appId);
        if (app.tenantId !== user.tenantId) {
          throw new HttpError(400, 'INVALID_APP_SCOPE', 'The selected app must belong to the user tenant.');
        }
      }

      Object.assign(user, payload);
      const timestamp = new Date().toISOString();
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        action: 'user_update',
        resourceType: 'user',
        resourceId: user.id,
        tenantId: user.tenantId,
        appId: user.appId,
        timestamp,
        summary: `Updated user ${user.name}`,
      });
      await publishControlPlaneDomainEvent({
        tenantId: user.tenantId,
        appId: user.appId,
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'user_updated',
        source: 'control_plane_api',
        resourceType: 'user',
        resourceId: user.id,
        summary: `Updated user ${user.name}`,
        timestamp,
        metadata: { changes: payload },
      }, { state });
      await persistState();
      return clone(user);
    },
    listAgents(filters = {}) {
      const state = getState();
      return clone(filterScopedItems(state.agents, filters));
    },
    async saveAgent(agent) {
      const state = getState();
      const index = state.agents.findIndex((item) => item.id === agent.id);
      if (index === -1) {
        throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agent.id}.`);
      }
      state.agents[index] = clone(agent);
      await persistState();
      return clone(state.agents[index]);
    },
    async updateAgent(agentId, payload, actor, filters = {}) {
      const state = getState();
      const agent = state.agents.find((item) => item.id === agentId);
      if (!agent) {
        throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
      }
      if (!filterScopedItems([agent], filters).length) {
        throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
      }

      const now = new Date().toISOString();
      if (payload.action === 'pause') {
        agent.state = 'paused';
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'warn',
          source: 'control-plane-api',
          message: `Agent paused by ${actor}.`,
          timestamp: now,
        });
      }

      if (payload.action === 'restart') {
        agent.state = 'running';
        agent.lastHeartbeatAt = now;
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Agent restart requested by ${actor}.`,
          timestamp: now,
        });
        agent.executionHistory.unshift({
          id: `run_${Date.now()}`,
          workflowVersion: agent.workflowVersion,
          status: 'running',
          startedAt: now,
          endedAt: now,
          costUsd: 0,
          outputSummary: 'Restart initiated from control plane API.',
        });
      }

      if (payload.action === 'update_budget') {
        agent.budgetUsd = payload.budgetUsd ?? agent.budgetUsd;
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Budget updated to $${agent.budgetUsd} by ${actor}.`,
          timestamp: now,
        });
      }

      if (payload.action === 'update_workflow') {
        agent.workflowVersion = payload.workflowVersion ?? agent.workflowVersion;
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Workflow changed to ${agent.workflowVersion} by ${actor}.`,
          timestamp: now,
        });
      }

      if (payload.action === 'move_stage') {
        const transitionContext = {
          currentStage: agent.orchestration.stage,
          dependencyState: agent.orchestration.dependencyState,
        };
        if (!payload.stage) {
          throw new HttpError(
            400,
            'INVALID_STAGE_MOVE_REQUEST',
            'Stage is required when moving an agent between orchestration lanes.',
          );
        }
        if (!canMoveToStage(transitionContext, payload.stage)) {
          throw new HttpError(
            409,
            'INVALID_STAGE_TRANSITION',
            getInvalidTransitionMessage(transitionContext, payload.stage),
          );
        }
        if (payload.stage) {
          agent.orchestration.stage = payload.stage;
        }
        if (payload.lane) {
          agent.orchestration.lane = payload.lane;
        }
        agent.orchestration.stageEnteredAt = now;
        agent.orchestration.dependencyState = getNextDependencyState(
          agent.orchestration.stage,
          agent.orchestration.blockers.length,
        );
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Stage moved to ${agent.orchestration.stage} by ${actor}.`,
          timestamp: now,
        });
      }

      if (payload.action === 'retry_queue') {
        if (agent.orchestration.dependencyState === 'blocked' || agent.orchestration.blockers.length) {
          throw new HttpError(
            409,
            'AGENT_BLOCKED',
            'Blocked agents must be unblocked before retrying the queue.',
          );
        }

        agent.state = 'running';
        agent.lastHeartbeatAt = now;
        agent.queueDepth = Math.max(agent.queueDepth, 1);
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Queue retry requested by ${actor}.`,
          timestamp: now,
        });
        agent.executionHistory.unshift({
          id: `run_${Date.now()}`,
          workflowVersion: agent.workflowVersion,
          status: 'running',
          startedAt: now,
          endedAt: now,
          costUsd: 0,
          outputSummary: 'Queue retry initiated from orchestration board.',
        });
      }

      if (payload.action === 'unblock') {
        agent.orchestration.blockers = [];
        agent.orchestration.dependencyState = getNextDependencyState(
          agent.orchestration.stage,
          0,
        );
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Blockers cleared by ${actor}.`,
          timestamp: now,
        });
      }

      if (payload.action === 'reroute') {
        const transitionContext = {
          currentStage: agent.orchestration.stage,
          dependencyState: agent.orchestration.dependencyState,
        };
        if (!payload.stage) {
          throw new HttpError(
            400,
            'INVALID_STAGE_MOVE_REQUEST',
            'Target stage is required when rerouting an agent.',
          );
        }
        if (!canMoveToStage(transitionContext, payload.stage)) {
          throw new HttpError(
            409,
            'INVALID_STAGE_TRANSITION',
            getInvalidTransitionMessage(transitionContext, payload.stage),
          );
        }

        agent.orchestration.stage = payload.stage;
        if (payload.lane) {
          agent.orchestration.lane = payload.lane;
        }
        agent.orchestration.stageEnteredAt = now;
        agent.orchestration.dependencyState = getNextDependencyState(
          agent.orchestration.stage,
          agent.orchestration.blockers.length,
        );
        agent.logs.unshift({
          id: `log_${Date.now()}`,
          level: 'info',
          source: 'control-plane-api',
          message: `Agent rerouted to ${agent.orchestration.stage} by ${actor}.`,
          timestamp: now,
        });
      }

      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action: payload.action,
        resourceType: 'agent',
        resourceId: agentId,
        tenantId: agent.tenantId,
        appId: agent.appId,
        timestamp: now,
        summary: buildAgentActionSummary(payload.action, {
          stage: payload.stage,
          lane: payload.lane,
        }),
      };
      state.auditLogs.unshift(audit);
      await publishControlPlaneDomainEvent({
        tenantId: agent.tenantId,
        appId: agent.appId,
        actor,
        actorDisplay: actor,
        type: 'agent_action_requested',
        source: 'control_plane_api',
        resourceType: 'agent',
        resourceId: agentId,
        summary: audit.summary,
        timestamp: now,
        metadata: { action: payload.action, stage: payload.stage, lane: payload.lane, queueDepth: agent.queueDepth },
      }, { state });
      await persistState();
      return { agent: clone(agent), audit };
    },
    async recordOrchestratorWorkflow(workflow, action, actor) {
      const state = getState();
      state.orchestratorWorkflows ??= [];
      state.auditLogs ??= [];
      const index = state.orchestratorWorkflows.findIndex((item) => item.id === workflow.id);
      if (index === -1) {
        state.orchestratorWorkflows.unshift(clone(workflow));
      } else {
        state.orchestratorWorkflows[index] = clone(workflow);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'workflow',
        resourceId: workflow.id,
        tenantId: workflow.tenantId,
        appId: workflow.appId,
        timestamp: workflow.updatedAt,
        summary: workflow.aggregationSummary ?? workflow.summary,
        metadata: {
          workflow,
          status: workflow.status,
          participantCount: workflow.participants.length,
        },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async recordResearchRun(run, action, actor) {
      const state = getState();
      state.researchRuns ??= [];
      state.auditLogs ??= [];
      const index = state.researchRuns.findIndex((item) => item.id === run.id);
      if (index === -1) {
        state.researchRuns.unshift(clone(run));
      } else {
        state.researchRuns[index] = clone(run);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'research',
        resourceId: run.id,
        tenantId: run.tenantId,
        appId: run.appId,
        timestamp: run.createdAt,
        summary: run.summary,
        metadata: { run },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async saveResearchSchedule(schedule, action, actor) {
      const state = getState();
      state.researchSchedules ??= [];
      state.auditLogs ??= [];
      const index = state.researchSchedules.findIndex((item) => item.id === schedule.id);
      if (index === -1) {
        state.researchSchedules.unshift(clone(schedule));
      } else {
        state.researchSchedules[index] = clone(schedule);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'research',
        resourceId: schedule.id,
        tenantId: schedule.tenantId,
        appId: schedule.appId,
        timestamp: schedule.updatedAt,
        summary: `${schedule.name} · ${schedule.source}`,
        metadata: { schedule },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async recordResearchAgentRun(run, action, actor) {
      const state = getState();
      state.researchAgentRuns ??= [];
      state.auditLogs ??= [];
      const index = state.researchAgentRuns.findIndex((item) => item.id === run.id);
      if (index === -1) {
        state.researchAgentRuns.unshift(clone(run));
      } else {
        state.researchAgentRuns[index] = clone(run);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'research',
        resourceId: run.id,
        tenantId: run.tenantId,
        appId: run.appId,
        timestamp: run.createdAt,
        summary: run.summary,
        metadata: { run },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async saveResearchAgentTrigger(trigger, action, actor) {
      const state = getState();
      state.researchAgentTriggers ??= [];
      state.auditLogs ??= [];
      const index = state.researchAgentTriggers.findIndex((item) => item.id === trigger.id);
      if (index === -1) {
        state.researchAgentTriggers.unshift(clone(trigger));
      } else {
        state.researchAgentTriggers[index] = clone(trigger);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'research',
        resourceId: trigger.id,
        tenantId: trigger.tenantId,
        appId: trigger.appId,
        timestamp: trigger.updatedAt,
        summary: `${trigger.name} · ${trigger.triggerType}`,
        metadata: { trigger },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async recordInsightAgentRun(run, action, actor) {
      const state = getState();
      state.insightAgentRuns ??= [];
      state.auditLogs ??= [];
      const index = state.insightAgentRuns.findIndex((item) => item.id === run.id);
      if (index === -1) {
        state.insightAgentRuns.unshift(clone(run));
      } else {
        state.insightAgentRuns[index] = clone(run);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'agent',
        resourceId: run.agentId,
        tenantId: run.tenantId,
        appId: run.appId,
        timestamp: run.createdAt,
        summary: run.summary,
        metadata: { run },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async recordRecommendationAgentRun(run, action, actor) {
      const state = getState();
      state.recommendationAgentRuns ??= [];
      state.auditLogs ??= [];
      const index = state.recommendationAgentRuns.findIndex((item) => item.id === run.id);
      if (index === -1) {
        state.recommendationAgentRuns.unshift(clone(run));
      } else {
        state.recommendationAgentRuns[index] = clone(run);
      }
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'recommendation',
        resourceId: run.id,
        tenantId: run.tenantId,
        appId: run.appId,
        timestamp: run.createdAt,
        summary: run.summary,
        metadata: { run },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async recordAgentOutcome(outcome, action, actor) {
      const state = getState();
      state.auditLogs ??= [];
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action,
        resourceType: 'agent',
        resourceId: outcome.agentId,
        tenantId: outcome.tenantId,
        appId: outcome.appId,
        timestamp: outcome.createdAt,
        summary: outcome.summary,
        metadata: { outcome },
      };
      state.auditLogs.unshift(audit);
      await persistState();
      return clone(audit);
    },
    async saveAgentPerformance(entry) {
      const state = getState();
      state.agentPerformance ??= [];
      const index = state.agentPerformance.findIndex((item) => item.id === entry.id);
      if (index === -1) {
        state.agentPerformance.unshift(clone(entry));
      } else {
        state.agentPerformance[index] = clone(entry);
      }
      await persistState();
      return clone(entry);
    },
    async saveMarketSignal(signal) {
      const state = getState();
      state.marketSignals ??= [];
      const index = state.marketSignals.findIndex((item) => item.id === signal.id);
      if (index === -1) {
        state.marketSignals.unshift(clone(signal));
      } else {
        state.marketSignals[index] = clone(signal);
      }
      await persistState();
      return clone(signal);
    },
    listMarketSignals(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.marketSignals ?? [], filters)
        .filter((item) => !filters.signalType || item.signalType === filters.signalType)
        .filter((item) => !filters.direction || item.direction === filters.direction)
        .sort((left, right) => new Date(right.detectedAt).getTime() - new Date(left.detectedAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    async saveKnowledgeEvent(entry) {
      const state = getState();
      state.knowledgeEvents ??= [];
      state.knowledgeEvents.unshift(clone(entry));
      await persistState();
      return clone(entry);
    },
    listKnowledgeEvents(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.knowledgeEvents ?? [], filters)
        .filter((item) => !filters.eventType || item.eventType === filters.eventType)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listResearchRuns(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.researchRuns ?? [], filters)
        .filter((item) => !filters.source || item.source === filters.source)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.scheduleId || item.scheduleId === filters.scheduleId)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listResearchSchedules(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.researchSchedules ?? [], filters)
        .filter((item) => !filters.source || item.source === filters.source)
        .filter((item) => !filters.status || item.status === filters.status)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    getResearchSchedule(scheduleId, filters = {}) {
      const state = getState();
      const item = filterScopedItems(state.researchSchedules ?? [], filters).find((schedule) => schedule.id === scheduleId);
      return item ? clone(item) : null;
    },
    listResearchAgentRuns(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.researchAgentRuns ?? [], filters)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.trigger || item.trigger === filters.trigger)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listResearchAgentTriggers(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.researchAgentTriggers ?? [], filters)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.triggerType || item.triggerType === filters.triggerType)
        .filter((item) => !filters.status || item.status === filters.status)
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    getResearchAgentTrigger(triggerId, filters = {}) {
      const state = getState();
      const item = filterScopedItems(state.researchAgentTriggers ?? [], filters).find((trigger) => trigger.id === triggerId);
      return item ? clone(item) : null;
    },
    listInsightAgentRuns(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.insightAgentRuns ?? [], filters)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.trigger || item.trigger === filters.trigger)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listRecommendationAgentRuns(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.recommendationAgentRuns ?? [], filters)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listRecommendations(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.knowledgeEvents ?? [], filters)
        .filter((item) => item.eventType === 'recommendation_created')
        .map((item) => item.payload?.recommendation)
        .filter(Boolean)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.category || item.category === filters.category)
        .filter((item) => !filters.priority || item.priority === filters.priority)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listAgentOutcomes(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.knowledgeEvents ?? [], filters)
        .filter((item) => item.eventType === 'agent_outcome_recorded')
        .map((item) => item.payload?.outcome)
        .filter(Boolean)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listAgentPerformance(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.agentPerformance ?? [], filters)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());
      return clone(typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items);
    },
    listOrchestratorWorkflows(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.orchestratorWorkflows ?? [], filters)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.agentId || item.participants.some((participant) => participant.agentId === filters.agentId))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
      if (typeof filters.limit === 'number') {
        return clone(items.slice(0, filters.limit));
      }
      return clone(items);
    },
    getOrchestratorWorkflow(workflowId, filters = {}) {
      const state = getState();
      const item = filterScopedItems(state.orchestratorWorkflows ?? [], filters).find((workflow) => workflow.id === workflowId);
      return item ? clone(item) : null;
    },
    listTools() {
      const state = getState();
      return clone(state.tools);
    },
    async recordToolExecution(entry) {
      const state = getState();
      state.toolExecutions ??= [];
      state.auditLogs ??= [];
      let tool = state.tools.find((item) => item.name === entry.tool);
      if (!tool) {
        tool = {
          name: entry.tool,
          description: `Runtime telemetry for ${entry.tool}`,
          schema: clone(entry.schema ?? []),
          permissions: clone(entry.permissions ?? []),
          riskLevel: entry.riskLevel,
          executionMode: entry.executionMode,
          safetyGuards: clone(entry.safetyGuards ?? []),
          usageToday: 0,
          p95Ms: 0,
          errorRate: 0,
        };
        state.tools.push(tool);
      }
      updateToolTelemetry(tool, entry);

      const execution = {
        id: entry.id,
        tool: entry.tool,
        actor: entry.actor,
        tenantId: entry.tenantId ?? null,
        appId: entry.appId ?? null,
        status: entry.status,
        riskLevel: entry.riskLevel,
        executionMode: entry.executionMode,
        permissions: clone(entry.permissions ?? []),
        safetyGuards: clone(entry.safetyGuards ?? []),
        durationMs: entry.durationMs,
        summary: entry.summary,
        inputPreview: entry.inputPreview,
        outputPreview: entry.outputPreview,
        errorMessage: entry.errorMessage,
        createdAt: entry.createdAt ?? new Date().toISOString(),
      };
      state.toolExecutions.unshift(execution);
      state.auditLogs.unshift({
        id: `audit_${state.auditLogs.length + 1}`,
        actor: entry.actor,
        actorDisplay: entry.actor,
        action: 'tool_execute',
        resourceType: 'tool',
        resourceId: entry.tool,
        timestamp: execution.createdAt,
        tenantId: entry.tenantId ?? null,
        appId: entry.appId ?? null,
        summary: entry.summary,
        metadata: {
          status: entry.status,
          durationMs: entry.durationMs,
          riskLevel: entry.riskLevel,
          executionMode: entry.executionMode,
        },
      });
      await persistState();
      return clone(execution);
    },
    listModels() {
      const state = getState();
      return clone(state.models);
    },
    async switchModel(payload, actor) {
      const state = getState();
      const model = state.models.find((item) => item.key === payload.key);
      if (!model) {
        throw new HttpError(404, 'MODEL_NOT_FOUND', `No model found for ${payload.key}.`);
      }
      model.activeModel = payload.targetModel;
      const audit = {
        id: `audit_${state.auditLogs.length + 1}`,
        actor,
        actorDisplay: actor,
        action: 'switch_model',
        resourceType: 'model',
        resourceId: payload.key,
        timestamp: new Date().toISOString(),
        summary: `Switched model to ${payload.targetModel}`,
      };
      state.auditLogs.unshift(audit);
      await publishControlPlaneDomainEvent({
        tenantId: 'platform-root',
        appId: 'control-dashboard',
        actor,
        actorDisplay: actor,
        type: 'model_switched',
        source: 'control_plane_api',
        resourceType: 'model',
        resourceId: payload.key,
        summary: audit.summary,
        timestamp: audit.timestamp,
        metadata: { targetModel: payload.targetModel },
      }, { state });
      await persistState();
      return { model: clone(model), audit };
    },
    listMemory(filters = {}) {
      const state = getState();
      return clone(filterScopedItems(state.memory, filters));
    },
    listAuditLogs(filters = {}) {
      const state = getState();
      return clone(filterScopedItems(state.auditLogs, filters));
    },
    listToolExecutions(filters = {}) {
      const state = getState();
      const items = filterScopedItems(state.toolExecutions ?? [], filters)
        .filter((item) => !filters.tool || item.tool === filters.tool)
        .filter((item) => !filters.status || item.status === filters.status)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      if (typeof filters.limit === 'number') {
        return clone(items.slice(0, filters.limit));
      }
      return clone(items);
    },
    getKnowledgeGraph(filters = {}) {
      const state = getState();
      const nodes = filterScopedItems(state.graphNodes, filters);
      const visibleIds = new Set(nodes.map((node) => node.id));
      const edges = state.graphEdges.filter(
        (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
      );
      return applyKnowledgeGraphQuery({ nodes: clone(nodes), edges: clone(edges) }, filters);
    },
    listEvents(filters = {}) {
      const state = getState();
      const items = state.events
        .filter((event) => !filters.tenantId || event.tenantId === filters.tenantId)
        .filter((event) => !filters.appId || event.appId === filters.appId)
        .filter((event) => !filters.eventType || event.type === filters.eventType)
        .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

      if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
        return clone(items.slice(0, filters.limit));
      }
      return clone(items);
    },
    getAnalytics(filters = {}) {
      const state = getState();
      if (!filters.tenantId && !filters.appId) {
        return clone(state.analytics);
      }

      const scopedTenants = filterScopedTenants(state.tenants, filters);
      const scopedApps = filterScopedApps(state.apps, filters);
      const scopedAgents = filterScopedItems(state.agents, filters);

      return {
        ...clone(state.analytics),
        kpis: [
          { label: 'Scoped tenants', value: `${scopedTenants.length}`, change: 'context aware' },
          { label: 'Scoped apps', value: `${scopedApps.length}`, change: 'context aware' },
          {
            label: 'Scoped agent decisions',
            value: `${scopedAgents.reduce((sum, agent) => sum + agent.decisionsToday, 0)}`,
            change: 'context aware',
          },
        ],
        tenantGrowth: scopedTenants.map((tenant) => ({ label: tenant.name, value: tenant.apps })),
      };
    },
    async getObservability() {
      const state = getState();
      const metrics = await loadPrometheusServiceMetrics(options.prometheus ?? {});
      return applyObservabilityAlertThresholds(
        enrichObservabilityServices(clone(state.observability), metrics),
        options.prometheus?.observabilityServiceAlertThresholdsJson,
      );
    },
    listClientErrors() {
      return [];
    },
    getSystem() {
      const state = getState();
      return clone(state.system);
    },
    async saveEmbeddings(input) {
      const state = getState();
      const documents = input.documents.map((item) => clone(item));
      const embeddings = input.embeddings.map((item) => clone(item));
      state.documents.unshift(...documents.map((item) => ({ ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })));
      state.embeddings.unshift(...embeddings.map((item) => ({ ...item, createdAt: new Date().toISOString() })));
      upsertMemoryRecord(state, input.tenantId, input.appId, documents.length, embeddings.length);
      await persistState();
      return { documents, embeddings };
    },
    async saveUsagePattern(input) {
      const state = getState();
      const existing = state.usagePatterns.find((item) => item.id === input.id);
      if (existing) {
        existing.signalValue = input.signalValue;
        existing.sampleCount += input.sampleCount ?? 1;
        existing.metadata = clone(input.metadata ?? {});
        existing.windowStartedAt = input.windowStartedAt ?? existing.windowStartedAt;
        existing.windowEndedAt = input.windowEndedAt ?? new Date().toISOString();
        existing.createdAt = existing.createdAt ?? new Date().toISOString();
        await persistState();
        return clone(existing);
      }

      const created = {
        id: input.id,
        tenantId: input.tenantId ?? null,
        appId: input.appId ?? null,
        scope: input.scope,
        signalKey: input.signalKey,
        signalValue: input.signalValue,
        sampleCount: input.sampleCount ?? 1,
        metadata: clone(input.metadata ?? {}),
        windowStartedAt: input.windowStartedAt ?? new Date().toISOString(),
        windowEndedAt: input.windowEndedAt ?? new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      state.usagePatterns.unshift(created);
      await persistState();
      return clone(created);
    },
    listUsagePatterns(filters = {}) {
      const state = getState();
      const items = state.usagePatterns
        .filter((item) => !filters.tenantId || item.tenantId === filters.tenantId)
        .filter((item) => !filters.appId || item.appId === filters.appId)
        .filter((item) => !filters.scope || item.scope === filters.scope)
        .filter((item) => !filters.signalKeyPrefix || item.signalKey.startsWith(filters.signalKeyPrefix))
        .filter((item) => !filters.userId || item.metadata?.userId === filters.userId)
        .filter((item) => !filters.agentId || item.metadata?.agentId === filters.agentId)
        .sort((left, right) => new Date(right.windowEndedAt ?? right.createdAt).getTime() - new Date(left.windowEndedAt ?? left.createdAt).getTime());
      if (typeof filters.limit === 'number') {
        return clone(items.slice(0, filters.limit));
      }
      return clone(items);
    },
    listConversationTurns(filters = {}) {
      const state = getState();
      const items = state.documents
        .filter((item) => item.sourceType === 'query')
        .filter((item) => item.metadata?.memoryKind === 'conversation_turn')
        .filter((item) => !filters.tenantId || item.tenantId === filters.tenantId)
        .filter((item) => !filters.appId || item.appId === filters.appId)
        .filter((item) => !filters.userId || item.metadata?.userId === filters.userId)
        .filter((item) => !filters.sessionId || item.metadata?.sessionId === filters.sessionId)
        .sort((left, right) => new Date(right.metadata?.turnCreatedAt ?? right.createdAt).getTime() - new Date(left.metadata?.turnCreatedAt ?? left.createdAt).getTime())
        .map((item) => ({
          id: item.metadata?.turnId ?? item.id,
          documentId: item.id,
          sessionId: item.metadata?.sessionId ?? '',
          tenantId: item.tenantId ?? null,
          appId: item.appId ?? null,
          userId: item.metadata?.userId ?? '',
          pathname: item.metadata?.pathname,
          userMessage: item.metadata?.userMessage ?? '',
          assistantMessage: item.metadata?.assistantMessage ?? '',
          toolCalls: item.metadata?.toolCalls ?? [],
          createdAt: item.metadata?.turnCreatedAt ?? item.createdAt,
        }));
      if (typeof filters.limit === 'number') {
        return clone(items.slice(0, filters.limit));
      }
      return clone(items);
    },
    searchEmbeddings(filters = {}) {
      const state = getState();
      const items = state.embeddings
        .map((embedding) => {
          const document = state.documents.find((item) => item.id === embedding.documentId);
          if (!document) return null;
          return {
            id: embedding.id,
            documentId: embedding.documentId,
            sourceType: document.sourceType,
            title: document.title,
            snippet: embedding.chunkText,
            score: cosineSimilarity(filters.vector ?? [], embedding.embeddingVector ?? []),
            metadata: { ...(document.metadata ?? {}), embeddingMetadata: embedding.metadata ?? {} },
            createdAt: document.createdAt,
            tenantId: document.tenantId ?? null,
            appId: document.appId ?? null,
          };
        })
        .filter(Boolean)
        .filter((item) => !filters.tenantId || item.tenantId === filters.tenantId)
        .filter((item) => !filters.appId || item.appId === filters.appId)
        .filter((item) => !filters.sourceTypes?.length || filters.sourceTypes.includes(item.sourceType))
        .sort((left, right) => right.score - left.score);
      const limited = typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
      return clone(limited);
    },
    async publishDomainEvent(input) {
      return publishControlPlaneDomainEvent(input, { state: getState() });
    },
  };
}
