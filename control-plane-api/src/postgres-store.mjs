import { randomUUID } from 'node:crypto';

import { analyticsData, overviewData } from './data/platform-data.mjs';
import { HttpError } from './http.mjs';
import {
  canMoveToStage,
  getInvalidTransitionMessage,
  getNextDependencyState,
} from './orchestration.mjs';
import { createControlPlaneDb } from './postgres.mjs';
import { publishControlPlaneDomainEvent } from './domain-events.mjs';
import { applyKnowledgeGraphQuery } from './knowledge-graph.mjs';
import {
  enrichObservabilityServices,
  loadPrometheusServiceMetrics,
} from './prometheus-observability.mjs';
import { applyObservabilityAlertThresholds } from './observability-alert-thresholds.mjs';

function clone(value) {
  return structuredClone(value);
}

function filterScopedTenants(items, filters = {}) {
  return filters.tenantId ? items.filter((tenant) => tenant.id === filters.tenantId) : items;
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
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
}

function buildUniqueId(prefix, name, existingIds) {
  const base = slugify(name) || randomUUID().slice(0, 8);
  const used = new Set(existingIds);
  let candidate = `${prefix}${base}`;
  let index = 2;

  while (used.has(candidate)) {
    candidate = `${prefix}${base}_${index}`;
    index += 1;
  }

  return candidate;
}

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

function buildScopedWhere(filters = {}, firstParameter = 1, columns = { tenant: 'tenant_id', app: 'app_id' }) {
  const clauses = [];
  const values = [];

  if (filters.tenantId) {
    clauses.push(`${columns.tenant} = $${firstParameter + values.length}`);
    values.push(filters.tenantId);
  }
  if (filters.appId) {
    clauses.push(`${columns.app} = $${firstParameter + values.length}`);
    values.push(filters.appId);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

function mapTenant(row) {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier,
    status: row.status,
    region: row.region,
    apps: row.apps,
    users: row.users,
    monthlySpendUsd: row.monthly_spend_usd,
    eventQuotaDaily: row.event_quota_daily,
  };
}

function mapApp(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    runtime: row.runtime,
    environment: row.environment,
    status: row.status,
    region: row.region,
    agentsAttached: row.agents_attached,
  };
}

function mapUser(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    name: row.name,
    role: row.role,
    status: row.status,
    lastSeenAt: row.last_seen_at?.toISOString() ?? new Date(0).toISOString(),
  };
}

function mapAgent(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    name: row.name,
    state: row.state,
    queue: row.queue,
    queueDepth: row.queue_depth,
    budgetUsd: row.budget_usd,
    budgetUtilizationPercent: row.budget_utilization_percent,
    avgLatencyMs: row.avg_latency_ms,
    tokenUsage1h: row.token_usage_1h,
    decisionsToday: row.decisions_today,
    workflowVersion: row.workflow_version,
    lastTask: row.last_task,
    lastHeartbeatAt: row.last_heartbeat_at.toISOString(),
    orchestration: row.orchestration_json,
    tasks: row.tasks_json,
    decisions: row.decisions_json,
    logs: row.logs_json,
    executionHistory: row.execution_history_json,
  };
}

function mapTool(row) {
  return {
    name: row.name,
    description: row.description,
    schema: row.schema_json,
    permissions: row.permissions_json,
    riskLevel: row.risk_level,
    executionMode: row.execution_mode,
    safetyGuards: row.safety_guards_json,
    usageToday: row.usage_today,
    p95Ms: row.p95_ms,
    errorRate: row.error_rate,
  };
}

function mapOrchestratorWorkflow(row) {
  return row.metadata_json?.workflow ?? null;
}

function mapResearchRun(row) {
  return row.metadata_json?.run ?? null;
}

function mapResearchSchedule(row) {
  return row.metadata_json?.schedule ?? null;
}

function mapResearchAgentRun(row) {
  return row.metadata_json?.run ?? null;
}

function mapResearchAgentTrigger(row) {
  return row.metadata_json?.trigger ?? null;
}

function mapInsightAgentRun(row) {
  return row.metadata_json?.run ?? null;
}

function mapMarketSignal(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    signalType: row.signal_type,
    subject: row.subject,
    direction: row.direction,
    strength: Number(row.strength ?? 0),
    confidence: Number(row.confidence ?? 0),
    summary: row.summary,
    metadata: row.metadata_json ?? {},
    detectedAt: row.detected_at instanceof Date ? row.detected_at.toISOString() : row.detected_at,
  };
}

function mapRecommendation(row) {
  return row.payload_json?.recommendation ?? null;
}

function mapAgentOutcome(row) {
  return row.payload_json?.outcome ?? null;
}

function mapAgentPerformance(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    evaluationWindow: row.evaluation_window,
    successRate: Number(row.success_rate ?? 0),
    avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    avgCostUsd: Number(row.avg_cost_usd ?? 0),
    taskCount: Number(row.task_count ?? 0),
    feedbackScore: Number(row.feedback_score ?? 0),
    improvementDelta: Number(row.metadata_json?.improvementDelta ?? 0),
    trend: row.metadata_json?.trend ?? 'flat',
    metadata: row.metadata_json ?? {},
    recordedAt: row.recorded_at?.toISOString?.() ?? row.recorded_at,
  };
}

function mapModel(row) {
  return {
    key: row.key,
    service: row.service,
    activeModel: row.active_model,
    fallbackModel: row.fallback_model,
    provider: row.provider,
    latencyMs: row.latency_ms,
    tokenUsage1h: row.token_usage_1h,
    errorRate: row.error_rate,
    candidates: row.candidates_json,
  };
}

function mapMemory(row) {
  return {
    id: row.id,
    scope: row.scope,
    tenantId: row.tenant_id,
    appId: row.app_id,
    records: row.records_count,
    vectorCount: row.vector_count,
    lastCompactionAt: row.last_compaction_at?.toISOString() ?? null,
  };
}

function mapUsagePattern(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    scope: row.scope,
    signalKey: row.signal_key,
    signalValue: row.signal_value,
    sampleCount: row.sample_count,
    metadata: row.metadata_json ?? {},
    windowStartedAt: row.window_started_at?.toISOString() ?? new Date(0).toISOString(),
    windowEndedAt: row.window_ended_at?.toISOString() ?? new Date(0).toISOString(),
    createdAt: row.created_at?.toISOString() ?? new Date(0).toISOString(),
  };
}

function vectorToPgLiteral(vector) {
  return `[${vector.join(',')}]`;
}

function mapGraphNode(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    metadata: row.metadata,
    description: row.description,
    tags: row.tags_json,
    score: row.score,
    health: row.health,
    tenantId: row.tenant_id ?? undefined,
    appId: row.app_id ?? undefined,
  };
}

function mapGraphEdge(row) {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    label: row.label,
    category: row.category,
    strength: row.strength,
    evidenceCount: row.evidence_count,
  };
}

function mapObservability(row) {
  return {
    name: row.name,
    layer: row.layer,
    status: row.status,
    cpuPercent: row.cpu_percent,
    memoryPercent: row.memory_percent,
    restarts24h: row.restarts_24h,
    endpoint: row.endpoint,
  };
}

function mapClientError(row) {
  const metadata = row.metadata_json ?? {};
  return {
    id: row.id,
    kind: metadata.kind ?? 'window-error',
    source: metadata.source ?? 'unknown',
    message: metadata.message ?? row.summary ?? 'Unknown client error',
    name: metadata.name ?? 'ClientError',
    pathname: metadata.pathname ?? null,
    digest: metadata.digest ?? null,
    occurredAt: new Date(row.created_at).toISOString(),
    tenantId: row.tenant_id ?? null,
    appId: row.app_id ?? null,
    userId: row.user_id ?? null,
  };
}

function mapAuditRecord(row) {
  return {
    id: row.id,
    actor: row.user_id,
    actorDisplay: row.user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    timestamp: new Date(row.created_at).toISOString(),
    tenantId: row.tenant_id ?? null,
    appId: row.app_id ?? null,
    summary: row.summary ?? undefined,
    metadata: row.metadata_json ?? undefined,
  };
}

function mapToolExecution(row) {
  return {
    id: row.id,
    tool: row.resource_id,
    actor: row.user_id,
    tenantId: row.tenant_id ?? null,
    appId: row.app_id ?? null,
    status: row.metadata_json?.status ?? 'completed',
    riskLevel: row.metadata_json?.riskLevel ?? 'low',
    executionMode: row.metadata_json?.executionMode ?? 'read',
    permissions: row.metadata_json?.permissions ?? [],
    safetyGuards: row.metadata_json?.safetyGuards ?? [],
    durationMs: row.metadata_json?.durationMs ?? 0,
    summary: row.summary ?? '',
    inputPreview: row.metadata_json?.inputPreview ?? '',
    outputPreview: row.metadata_json?.outputPreview ?? '',
    errorMessage: row.metadata_json?.errorMessage,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapEvent(row) {
  return row.payload_json;
}

async function insertAudit(db, audit) {
  await db.query(
    `INSERT INTO audit_logs (id, tenant_id, app_id, user_id, action, resource_type, resource_id, summary, metadata_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
    [
      audit.id,
      audit.tenantId ?? null,
      audit.appId ?? null,
      audit.actor,
      audit.action,
      audit.resourceType,
      audit.resourceId,
      audit.summary,
      JSON.stringify(audit.metadata ?? {}),
      audit.timestamp,
    ],
  );
}

export function createPostgresControlPlaneStore(config) {
  const db = createControlPlaneDb(config);

  return {
    async close() {
      await db.close();
    },
    async getHealth() {
      const result = await db.query('SELECT COUNT(*)::int AS services FROM observability_services');
      return { status: 'ok', services: result.rows[0]?.services ?? 0, timestamp: new Date().toISOString() };
    },
    async getOverview(filters = {}) {
      const [tenants, agents, events, observability] = await Promise.all([
        this.listTenants(filters),
        this.listAgents(filters),
        this.listEvents({ ...filters, limit: 120 }),
        this.getObservability(),
      ]);
      const runningAgents = agents.filter((agent) => agent.state === 'running').length;
      const queueBacklog = agents.reduce((sum, agent) => sum + agent.queueDepth, 0);
      const healthyServices = observability.filter((service) => service.status === 'healthy').length;
      const base = clone(overviewData);
      base.metrics = [
        { ...base.metrics[0], value: `${tenants.length}` },
        { ...base.metrics[1], value: `${runningAgents}` },
        { ...base.metrics[2], value: `${queueBacklog}` },
        base.metrics[3],
      ];
      base.runningAgents = runningAgents;
      base.queueBacklog = queueBacklog;
      base.healthyServices = healthyServices;
      base.liveEventsPerMinute = events.length * 12;
      return base;
    },
    async listTenants(filters = {}) {
      const where = filters.tenantId ? 'WHERE id = $1' : '';
      const result = await db.query(
        `SELECT id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily
         FROM tenants ${where}
         ORDER BY name ASC`,
        filters.tenantId ? [filters.tenantId] : [],
      );
      return result.rows.map(mapTenant);
    },
    async createTenant(payload, adminContext) {
      const existingIds = (await db.query('SELECT id FROM tenants')).rows.map((row) => row.id);
      const timestamp = new Date().toISOString();
      const tenant = {
        id: buildUniqueId('tenant_', payload.name, existingIds),
        name: payload.name,
        tier: payload.tier,
        status: payload.status,
        region: payload.region,
        apps: 0,
        users: 0,
        monthlySpendUsd: payload.monthlySpendUsd,
        eventQuotaDaily: payload.eventQuotaDaily,
      };
      await db.query(
        `INSERT INTO tenants (id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [tenant.id, tenant.name, tenant.tier, tenant.status, tenant.region, tenant.apps, tenant.users, tenant.monthlySpendUsd, tenant.eventQuotaDaily],
      );
      await insertAudit(db, {
        id: `audit_${randomUUID()}`,
        actor: adminContext.userId,
        action: 'tenant_create',
        resourceType: 'tenant',
        resourceId: tenant.id,
        summary: `Created tenant ${tenant.name}`,
        timestamp,
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
      }, { db });
      return clone(tenant);
    },
    async updateTenant(tenantId, payload, adminContext) {
      ensureTenantWritable(adminContext, tenantId);
      const result = await db.query(
        `SELECT id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily
         FROM tenants WHERE id = $1`,
        [tenantId],
      );
      const tenant = result.rows[0];
      if (!tenant) {
        throw new HttpError(404, 'TENANT_NOT_FOUND', `No tenant found for ${tenantId}.`);
      }
      const next = { ...mapTenant(tenant), ...payload };
      const timestamp = new Date().toISOString();
      await db.query(
        `UPDATE tenants SET name = $2, tier = $3, status = $4, region = $5, monthly_spend_usd = $6, event_quota_daily = $7 WHERE id = $1`,
        [tenantId, next.name, next.tier, next.status, next.region, next.monthlySpendUsd, next.eventQuotaDaily],
      );
      await insertAudit(db, {
        id: `audit_${randomUUID()}`,
        actor: adminContext.userId,
        action: 'tenant_update',
        resourceType: 'tenant',
        resourceId: tenantId,
        summary: `Updated tenant ${next.name}`,
        timestamp,
      });
      await publishControlPlaneDomainEvent({
        tenantId: adminContext.tenantId || 'platform-root',
        appId: adminContext.appId || 'control-dashboard',
        actor: adminContext.userId,
        actorDisplay: adminContext.userId,
        type: 'tenant_updated',
        source: 'control_plane_api',
        resourceType: 'tenant',
        resourceId: tenantId,
        summary: `Updated tenant ${next.name}`,
        timestamp,
        metadata: { targetTenantId: tenantId, changes: payload },
      }, { db });
      return next;
    },
    async listApps(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(
        `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
         FROM tenant_apps ${scoped.sql}
         ORDER BY name ASC`,
        scoped.values,
      );
      return result.rows.map(mapApp);
    },
    async createApp(payload, adminContext) {
      ensureTenantWritable(adminContext, payload.tenantId);
      const tenant = await db.query('SELECT id FROM tenants WHERE id = $1', [payload.tenantId]);
      if (!tenant.rows[0]) {
        throw new HttpError(404, 'TENANT_NOT_FOUND', `No tenant found for ${payload.tenantId}.`);
      }
      const existingIds = (await db.query('SELECT id FROM tenant_apps')).rows.map((row) => row.id);
      const app = { id: buildUniqueId('app_', payload.name, existingIds), ...payload };
      const timestamp = new Date().toISOString();
      await db.query(
        `INSERT INTO tenant_apps (id, tenant_id, name, runtime, environment, status, region, agents_attached)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [app.id, app.tenantId, app.name, app.runtime, app.environment, app.status, app.region, app.agentsAttached],
      );
      await db.query('UPDATE tenants SET apps = apps + 1 WHERE id = $1', [payload.tenantId]);
      await insertAudit(db, { id: `audit_${randomUUID()}`, actor: adminContext.userId, action: 'app_create', resourceType: 'app', resourceId: app.id, tenantId: app.tenantId, appId: app.id, summary: `Created app ${app.name}`, timestamp });
      await publishControlPlaneDomainEvent({ tenantId: app.tenantId, appId: app.id, actor: adminContext.userId, actorDisplay: adminContext.userId, type: 'app_created', source: 'control_plane_api', resourceType: 'app', resourceId: app.id, summary: `Created app ${app.name}`, timestamp, metadata: { runtime: app.runtime, environment: app.environment, status: app.status } }, { db });
      return clone(app);
    },
    async updateApp(appId, payload, adminContext) {
      const result = await db.query(
        `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
         FROM tenant_apps WHERE id = $1`,
        [appId],
      );
      const app = result.rows[0];
      if (!app) {
        throw new HttpError(404, 'APP_NOT_FOUND', `No app found for ${appId}.`);
      }
      ensureTenantWritable(adminContext, app.tenant_id);
      const next = { ...mapApp(app), ...payload };
      const timestamp = new Date().toISOString();
      await db.query(
        `UPDATE tenant_apps SET name = $2, runtime = $3, environment = $4, status = $5, region = $6, agents_attached = $7 WHERE id = $1`,
        [appId, next.name, next.runtime, next.environment, next.status, next.region, next.agentsAttached],
      );
      await insertAudit(db, { id: `audit_${randomUUID()}`, actor: adminContext.userId, action: 'app_update', resourceType: 'app', resourceId: appId, tenantId: next.tenantId, appId, summary: `Updated app ${next.name}`, timestamp });
      await publishControlPlaneDomainEvent({ tenantId: next.tenantId, appId, actor: adminContext.userId, actorDisplay: adminContext.userId, type: 'app_updated', source: 'control_plane_api', resourceType: 'app', resourceId: appId, summary: `Updated app ${next.name}`, timestamp, metadata: { changes: payload } }, { db });
      return next;
    },
    async listUsers(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(
        `SELECT id, tenant_id, app_id, name, role, status, last_seen_at
         FROM users ${scoped.sql}
         ORDER BY name ASC`,
        scoped.values,
      );
      return result.rows.map(mapUser);
    },
    async createUser(payload, adminContext) {
      ensureTenantWritable(adminContext, payload.tenantId);
      ensureAssignableRole(adminContext, payload.role);
      const appResult = await db.query('SELECT id, tenant_id FROM tenant_apps WHERE id = $1', [payload.appId]);
      if (!appResult.rows[0]) {
        throw new HttpError(404, 'APP_NOT_FOUND', `No app found for ${payload.appId}.`);
      }
      if (appResult.rows[0].tenant_id !== payload.tenantId) {
        throw new HttpError(400, 'INVALID_APP_SCOPE', 'The selected app does not belong to the selected tenant.');
      }
      const existingIds = (await db.query('SELECT id FROM users')).rows.map((row) => row.id);
      const user = { id: buildUniqueId('usr_', payload.name, existingIds), ...payload, lastSeenAt: new Date().toISOString() };
      const timestamp = new Date().toISOString();
      await db.query(
        `INSERT INTO users (id, tenant_id, app_id, email, name, role, status, last_seen_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user.id, user.tenantId, user.appId, '', user.name, user.role, user.status, user.lastSeenAt],
      );
      await db.query('UPDATE tenants SET users = users + 1 WHERE id = $1', [payload.tenantId]);
      await insertAudit(db, { id: `audit_${randomUUID()}`, actor: adminContext.userId, action: 'user_create', resourceType: 'user', resourceId: user.id, tenantId: user.tenantId, appId: user.appId, summary: `Created user ${user.name}`, timestamp });
      await publishControlPlaneDomainEvent({ tenantId: user.tenantId, appId: user.appId, actor: adminContext.userId, actorDisplay: adminContext.userId, type: 'user_created', source: 'control_plane_api', resourceType: 'user', resourceId: user.id, summary: `Created user ${user.name}`, timestamp, metadata: { role: user.role, status: user.status } }, { db });
      return clone(user);
    },
    async updateUser(userId, payload, adminContext) {
      const result = await db.query(
        `SELECT id, tenant_id, app_id, name, role, status, last_seen_at
         FROM users WHERE id = $1`,
        [userId],
      );
      const user = result.rows[0];
      if (!user) {
        throw new HttpError(404, 'USER_NOT_FOUND', `No user found for ${userId}.`);
      }
      ensureTenantWritable(adminContext, user.tenant_id);
      if (payload.role) {
        ensureAssignableRole(adminContext, payload.role);
      }
      if (payload.appId) {
        const app = await db.query('SELECT tenant_id FROM tenant_apps WHERE id = $1', [payload.appId]);
        if (app.rows[0]?.tenant_id !== user.tenant_id) {
          throw new HttpError(400, 'INVALID_APP_SCOPE', 'The selected app must belong to the user tenant.');
        }
      }
      const next = { ...mapUser(user), ...payload };
      const timestamp = new Date().toISOString();
      await db.query(`UPDATE users SET app_id = $2, name = $3, role = $4, status = $5 WHERE id = $1`, [userId, next.appId, next.name, next.role, next.status]);
      await insertAudit(db, { id: `audit_${randomUUID()}`, actor: adminContext.userId, action: 'user_update', resourceType: 'user', resourceId: userId, tenantId: next.tenantId, appId: next.appId, summary: `Updated user ${next.name}`, timestamp });
      await publishControlPlaneDomainEvent({ tenantId: next.tenantId, appId: next.appId, actor: adminContext.userId, actorDisplay: adminContext.userId, type: 'user_updated', source: 'control_plane_api', resourceType: 'user', resourceId: userId, summary: `Updated user ${next.name}`, timestamp, metadata: { changes: payload } }, { db });
      return next;
    },
    async listAgents(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(
        `SELECT id, tenant_id, app_id, name, state, queue, queue_depth, budget_usd, budget_utilization_percent,
                avg_latency_ms, token_usage_1h, decisions_today, workflow_version, last_task,
                last_heartbeat_at, orchestration_json, tasks_json, decisions_json, logs_json, execution_history_json
         FROM agents ${scoped.sql}
         ORDER BY name ASC`,
        scoped.values,
      );
      return result.rows.map(mapAgent);
    },
    async saveAgent(agent) {
      const now = new Date().toISOString();
      await db.query(
        `UPDATE agents SET state = $2, queue_depth = $3, budget_usd = $4, workflow_version = $5, last_task = $6,
                last_heartbeat_at = $7, orchestration_json = $8::jsonb, tasks_json = $9::jsonb, decisions_json = $10::jsonb,
                logs_json = $11::jsonb, execution_history_json = $12::jsonb, updated_at = $13 WHERE id = $1`,
        [agent.id, agent.state, agent.queueDepth, agent.budgetUsd, agent.workflowVersion, agent.lastTask, agent.lastHeartbeatAt, JSON.stringify(agent.orchestration), JSON.stringify(agent.tasks), JSON.stringify(agent.decisions), JSON.stringify(agent.logs), JSON.stringify(agent.executionHistory), now],
      );
      return clone(agent);
    },
    async updateAgent(agentId, payload, actor, filters = {}) {
      const scoped = buildScopedWhere(filters, 2);
      const result = await db.query(
        `SELECT id, tenant_id, app_id, name, state, queue, queue_depth, budget_usd, budget_utilization_percent,
                avg_latency_ms, token_usage_1h, decisions_today, workflow_version, last_task,
                last_heartbeat_at, orchestration_json, tasks_json, decisions_json, logs_json, execution_history_json
         FROM agents WHERE id = $1 ${scoped.sql ? `AND ${scoped.sql.replace(/^WHERE /, '')}` : ''}`,
        [agentId, ...scoped.values],
      );
      const row = result.rows[0];
      if (!row) {
        throw new HttpError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
      }
      const agent = mapAgent(row);
      const now = new Date().toISOString();
      if (payload.action === 'pause') {
        agent.state = 'paused';
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'warn', source: 'control-plane-api', message: `Agent paused by ${actor}.`, timestamp: now });
      }
      if (payload.action === 'restart') {
        agent.state = 'running';
        agent.lastHeartbeatAt = now;
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `Agent restart requested by ${actor}.`, timestamp: now });
        agent.executionHistory.unshift({ id: `run_${Date.now()}`, workflowVersion: agent.workflowVersion, status: 'running', startedAt: now, endedAt: now, costUsd: 0, outputSummary: 'Restart initiated from control plane API.' });
      }
      if (payload.action === 'update_budget') {
        agent.budgetUsd = payload.budgetUsd ?? agent.budgetUsd;
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `Budget updated to $${agent.budgetUsd} by ${actor}.`, timestamp: now });
      }
      if (payload.action === 'update_workflow') {
        agent.workflowVersion = payload.workflowVersion ?? agent.workflowVersion;
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `Workflow changed to ${agent.workflowVersion} by ${actor}.`, timestamp: now });
      }
      if (payload.action === 'move_stage' || payload.action === 'reroute') {
        const transitionContext = { currentStage: agent.orchestration.stage, dependencyState: agent.orchestration.dependencyState };
        if (!payload.stage) {
          throw new HttpError(400, 'INVALID_STAGE_MOVE_REQUEST', payload.action === 'reroute' ? 'Target stage is required when rerouting an agent.' : 'Stage is required when moving an agent between orchestration lanes.');
        }
        if (!canMoveToStage(transitionContext, payload.stage)) {
          throw new HttpError(409, 'INVALID_STAGE_TRANSITION', getInvalidTransitionMessage(transitionContext, payload.stage));
        }
        agent.orchestration.stage = payload.stage;
        if (payload.lane) {
          agent.orchestration.lane = payload.lane;
        }
        agent.orchestration.stageEnteredAt = now;
        agent.orchestration.dependencyState = getNextDependencyState(agent.orchestration.stage, agent.orchestration.blockers.length);
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `${payload.action === 'reroute' ? 'Agent rerouted' : 'Stage moved'} to ${agent.orchestration.stage} by ${actor}.`, timestamp: now });
      }
      if (payload.action === 'retry_queue') {
        if (agent.orchestration.dependencyState === 'blocked' || agent.orchestration.blockers.length) {
          throw new HttpError(409, 'AGENT_BLOCKED', 'Blocked agents must be unblocked before retrying the queue.');
        }
        agent.state = 'running';
        agent.lastHeartbeatAt = now;
        agent.queueDepth = Math.max(agent.queueDepth, 1);
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `Queue retry requested by ${actor}.`, timestamp: now });
        agent.executionHistory.unshift({ id: `run_${Date.now()}`, workflowVersion: agent.workflowVersion, status: 'running', startedAt: now, endedAt: now, costUsd: 0, outputSummary: 'Queue retry initiated from orchestration board.' });
      }
      if (payload.action === 'unblock') {
        agent.orchestration.blockers = [];
        agent.orchestration.dependencyState = getNextDependencyState(agent.orchestration.stage, 0);
        agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-plane-api', message: `Blockers cleared by ${actor}.`, timestamp: now });
      }
      await db.query(
        `UPDATE agents SET state = $2, queue_depth = $3, budget_usd = $4, workflow_version = $5, last_heartbeat_at = $6,
                orchestration_json = $7::jsonb, tasks_json = $8::jsonb, decisions_json = $9::jsonb,
                logs_json = $10::jsonb, execution_history_json = $11::jsonb, updated_at = $12 WHERE id = $1`,
        [agent.id, agent.state, agent.queueDepth, agent.budgetUsd, agent.workflowVersion, agent.lastHeartbeatAt, JSON.stringify(agent.orchestration), JSON.stringify(agent.tasks), JSON.stringify(agent.decisions), JSON.stringify(agent.logs), JSON.stringify(agent.executionHistory), now],
      );
      const audit = { id: `audit_${randomUUID()}`, actor, actorDisplay: actor, action: payload.action, resourceType: 'agent', resourceId: agentId, tenantId: agent.tenantId, appId: agent.appId, timestamp: now, summary: buildAgentActionSummary(payload.action, { stage: payload.stage, lane: payload.lane }) };
      await insertAudit(db, audit);
      await publishControlPlaneDomainEvent({ tenantId: agent.tenantId, appId: agent.appId, actor, actorDisplay: actor, type: 'agent_action_requested', source: 'control_plane_api', resourceType: 'agent', resourceId: agentId, summary: audit.summary, timestamp: now, metadata: { action: payload.action, stage: payload.stage, lane: payload.lane, queueDepth: agent.queueDepth } }, { db });
      return { agent: clone(agent), audit };
    },
    async listTools() {
      const result = await db.query(`SELECT name, schema_json, permissions_json, risk_level, usage_today, p95_ms, error_rate FROM tool_registry ORDER BY name ASC`);
      return result.rows.map(mapTool);
    },
    async recordOrchestratorWorkflow(workflow, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: workflow.tenantId,
        appId: workflow.appId,
        actor,
        action,
        resourceType: 'workflow',
        resourceId: workflow.id,
        summary: workflow.aggregationSummary ?? workflow.summary,
        metadata: {
          workflow,
          status: workflow.status,
          participantCount: workflow.participants.length,
        },
        timestamp: workflow.updatedAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async recordResearchRun(run, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: run.tenantId,
        appId: run.appId,
        actor,
        action,
        resourceType: 'research',
        resourceId: run.id,
        summary: run.summary,
        metadata: { run },
        timestamp: run.createdAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async saveResearchSchedule(schedule, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: schedule.tenantId,
        appId: schedule.appId,
        actor,
        action,
        resourceType: 'research',
        resourceId: schedule.id,
        summary: `${schedule.name} · ${schedule.source}`,
        metadata: { schedule },
        timestamp: schedule.updatedAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async recordResearchAgentRun(run, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: run.tenantId,
        appId: run.appId,
        actor,
        action,
        resourceType: 'research',
        resourceId: run.id,
        summary: run.summary,
        metadata: { run },
        timestamp: run.createdAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async saveResearchAgentTrigger(trigger, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: trigger.tenantId,
        appId: trigger.appId,
        actor,
        action,
        resourceType: 'research',
        resourceId: trigger.id,
        summary: `${trigger.name} · ${trigger.triggerType}`,
        metadata: { trigger },
        timestamp: trigger.updatedAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async recordInsightAgentRun(run, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: run.tenantId,
        appId: run.appId,
        actor,
        action,
        resourceType: 'agent',
        resourceId: run.agentId,
        summary: run.summary,
        metadata: { run },
        timestamp: run.createdAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async recordRecommendationAgentRun(run, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: run.tenantId,
        appId: run.appId,
        actor,
        action,
        resourceType: 'recommendation',
        resourceId: run.id,
        summary: run.summary,
        metadata: { run },
        timestamp: run.createdAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async recordAgentOutcome(outcome, action, actor) {
      const audit = {
        id: `audit_${randomUUID()}`,
        tenantId: outcome.tenantId,
        appId: outcome.appId,
        actor,
        action,
        resourceType: 'agent',
        resourceId: outcome.agentId,
        summary: outcome.summary,
        metadata: { outcome },
        timestamp: outcome.createdAt,
      };
      await insertAudit(db, audit);
      return clone(audit);
    },
    async saveAgentPerformance(entry) {
      await db.query(
        `INSERT INTO agent_performance (id, agent_id, evaluation_window, success_rate, avg_latency_ms, avg_cost_usd, task_count, feedback_score, metadata_json, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         ON CONFLICT (id) DO UPDATE SET
           evaluation_window = EXCLUDED.evaluation_window,
           success_rate = EXCLUDED.success_rate,
           avg_latency_ms = EXCLUDED.avg_latency_ms,
           avg_cost_usd = EXCLUDED.avg_cost_usd,
           task_count = EXCLUDED.task_count,
           feedback_score = EXCLUDED.feedback_score,
           metadata_json = EXCLUDED.metadata_json,
           recorded_at = EXCLUDED.recorded_at`,
        [
          entry.id,
          entry.agentId,
          entry.evaluationWindow,
          entry.successRate,
          entry.avgLatencyMs,
          entry.avgCostUsd,
          entry.taskCount,
          entry.feedbackScore,
          JSON.stringify({ ...entry.metadata, improvementDelta: entry.improvementDelta, trend: entry.trend, tenantId: entry.tenantId, appId: entry.appId }),
          entry.recordedAt,
        ],
      );
      return clone(entry);
    },
    async saveMarketSignal(signal) {
      await db.query(
        `INSERT INTO market_signals (id, tenant_id, app_id, signal_type, subject, direction, strength, confidence, summary, metadata_json, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
         ON CONFLICT (id) DO UPDATE SET
           signal_type = EXCLUDED.signal_type,
           subject = EXCLUDED.subject,
           direction = EXCLUDED.direction,
           strength = EXCLUDED.strength,
           confidence = EXCLUDED.confidence,
           summary = EXCLUDED.summary,
           metadata_json = EXCLUDED.metadata_json,
           detected_at = EXCLUDED.detected_at`,
        [
          signal.id,
          signal.tenantId,
          signal.appId,
          signal.signalType,
          signal.subject,
          signal.direction,
          signal.strength,
          signal.confidence,
          signal.summary,
          JSON.stringify(signal.metadata ?? {}),
          signal.detectedAt,
        ],
      );
      return clone(signal);
    },
    async listMarketSignals(filters = {}) {
      const values = [];
      const clauses = ['1 = 1'];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      if (filters.signalType) {
        values.push(filters.signalType);
        clauses.push(`signal_type = $${values.length}`);
      }
      if (filters.direction) {
        values.push(filters.direction);
        clauses.push(`direction = $${values.length}`);
      }
      values.push(filters.limit ?? 20);
      const result = await db.query(
        `SELECT id, tenant_id, app_id, signal_type, subject, direction, strength, confidence, summary, metadata_json, detected_at
         FROM market_signals WHERE ${clauses.join(' AND ')} ORDER BY detected_at DESC LIMIT $${values.length}`,
        values,
      );
      return result.rows.map(mapMarketSignal);
    },
    async saveKnowledgeEvent(entry) {
      await db.query(
        `INSERT INTO knowledge_events (id, tenant_id, app_id, event_type, source_service, source_ref, entity_id, document_id, payload_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          entry.id,
          entry.tenantId,
          entry.appId,
          entry.eventType,
          entry.sourceService,
          entry.sourceRef,
          entry.entityId ?? null,
          entry.documentId ?? null,
          JSON.stringify(entry.payload ?? {}),
          entry.createdAt,
        ],
      );
      return clone(entry);
    },
    async listResearchRuns(filters = {}) {
      const values = [['research_collect']];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const items = result.rows.map(mapResearchRun).filter(Boolean)
        .filter((item) => !filters.source || item.source === filters.source)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.scheduleId || item.scheduleId === filters.scheduleId);
      return typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
    },
    async listResearchSchedules(filters = {}) {
      const values = [['research_schedule_create', 'research_schedule_run']];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT resource_id, metadata_json, created_at FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const items = [];
      const seen = new Set();
      for (const row of result.rows) {
        if (seen.has(row.resource_id)) continue;
        const schedule = mapResearchSchedule(row);
        if (!schedule) continue;
        seen.add(row.resource_id);
        items.push(schedule);
      }
      const filtered = items
        .filter((item) => !filters.source || item.source === filters.source)
        .filter((item) => !filters.status || item.status === filters.status);
      return typeof filters.limit === 'number' ? filtered.slice(0, filters.limit) : filtered;
    },
    async getResearchSchedule(scheduleId, filters = {}) {
      const values = [['research_schedule_create', 'research_schedule_run'], scheduleId];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`, `resource_id = $2`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
        values,
      );
      return result.rows[0] ? mapResearchSchedule(result.rows[0]) ?? null : null;
    },
    async listResearchAgentRuns(filters = {}) {
      const values = [['research_agent_execute']];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const items = result.rows.map(mapResearchAgentRun).filter(Boolean)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.trigger || item.trigger === filters.trigger);
      return typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
    },
    async listResearchAgentTriggers(filters = {}) {
      const values = [['research_agent_trigger_create', 'research_agent_trigger_run']];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT resource_id, metadata_json, created_at FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const items = [];
      const seen = new Set();
      for (const row of result.rows) {
        if (seen.has(row.resource_id)) continue;
        const trigger = mapResearchAgentTrigger(row);
        if (!trigger) continue;
        seen.add(row.resource_id);
        items.push(trigger);
      }
      const filtered = items
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.triggerType || item.triggerType === filters.triggerType)
        .filter((item) => !filters.status || item.status === filters.status);
      return typeof filters.limit === 'number' ? filtered.slice(0, filters.limit) : filtered;
    },
    async getResearchAgentTrigger(triggerId, filters = {}) {
      const values = [['research_agent_trigger_create', 'research_agent_trigger_run'], triggerId];
      const clauses = [`resource_type = 'research'`, `action = ANY($1::text[])`, `resource_id = $2`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
        values,
      );
      return result.rows[0] ? mapResearchAgentTrigger(result.rows[0]) ?? null : null;
    },
    async listInsightAgentRuns(filters = {}) {
      const values = [['insight_agent_execute', 'insight_agent_process_events']];
      const clauses = [`resource_type = 'agent'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const items = result.rows.map(mapInsightAgentRun).filter(Boolean)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.trigger || item.trigger === filters.trigger);
      return typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
    },
    async listRecommendationAgentRuns(filters = {}) {
      const values = [['recommendation_agent_execute']];
      const clauses = [`resource_type = 'recommendation'`, `action = ANY($1::text[])`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(`SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`, values);
      const items = result.rows.map((row) => row.metadata_json?.run ?? null).filter(Boolean)
        .filter((item) => !filters.agentId || item.agentId === filters.agentId)
        .filter((item) => !filters.status || item.status === filters.status);
      return typeof filters.limit === 'number' ? items.slice(0, filters.limit) : items;
    },
    async listRecommendations(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const values = [...scoped.values];
      const conditions = scoped.sql ? [scoped.sql.replace(/^WHERE /, '')] : [];
      conditions.push(`event_type = 'recommendation_created'`);
      if (filters.agentId) {
        values.push(filters.agentId);
        conditions.push(`payload_json->'recommendation'->>'agentId' = $${values.length}`);
      }
      if (filters.category) {
        values.push(filters.category);
        conditions.push(`payload_json->'recommendation'->>'category' = $${values.length}`);
      }
      if (filters.priority) {
        values.push(filters.priority);
        conditions.push(`payload_json->'recommendation'->>'priority' = $${values.length}`);
      }
      let sql = `SELECT payload_json FROM knowledge_events ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC`;
      if (typeof filters.limit === 'number') sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      const result = await db.query(sql, values);
      return result.rows.map(mapRecommendation).filter(Boolean);
    },
    async listAgentOutcomes(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const values = [...scoped.values];
      const conditions = scoped.sql ? [scoped.sql.replace(/^WHERE /, '')] : [];
      conditions.push(`event_type = 'agent_outcome_recorded'`);
      if (filters.agentId) {
        values.push(filters.agentId);
        conditions.push(`payload_json->'outcome'->>'agentId' = $${values.length}`);
      }
      if (filters.status) {
        values.push(filters.status);
        conditions.push(`payload_json->'outcome'->>'status' = $${values.length}`);
      }
      let sql = `SELECT payload_json FROM knowledge_events ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC`;
      if (typeof filters.limit === 'number') sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      const result = await db.query(sql, values);
      return result.rows.map(mapAgentOutcome).filter(Boolean);
    },
    async listAgentPerformance(filters = {}) {
      const values = [];
      const conditions = [];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        conditions.push(`a.tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        conditions.push(`a.app_id = $${values.length}`);
      }
      if (filters.agentId) {
        values.push(filters.agentId);
        conditions.push(`ap.agent_id = $${values.length}`);
      }
      let sql = `SELECT ap.id, ap.agent_id, ap.evaluation_window, ap.success_rate, ap.avg_latency_ms, ap.avg_cost_usd, ap.task_count, ap.feedback_score, ap.metadata_json, ap.recorded_at, a.tenant_id, a.app_id
        FROM agent_performance ap INNER JOIN agents a ON a.id = ap.agent_id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY ap.recorded_at DESC`;
      if (typeof filters.limit === 'number') sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      const result = await db.query(sql, values);
      return result.rows.map(mapAgentPerformance);
    },
    async listOrchestratorWorkflows(filters = {}) {
      const values = [];
      const clauses = [`resource_type = 'workflow'`, `action = ANY($1::text[])`];
      values.push(['orchestrator_schedule', 'orchestrator_update', 'orchestrator_aggregate']);
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT resource_id, metadata_json, created_at
         FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 250`,
        values,
      );
      const latest = [];
      const seen = new Set();
      for (const row of result.rows) {
        if (seen.has(row.resource_id)) continue;
        const workflow = mapOrchestratorWorkflow(row);
        if (!workflow) continue;
        seen.add(row.resource_id);
        latest.push(workflow);
      }
      const filtered = latest
        .filter((item) => !filters.status || item.status === filters.status)
        .filter((item) => !filters.agentId || item.participants.some((participant) => participant.agentId === filters.agentId));
      return typeof filters.limit === 'number' ? filtered.slice(0, filters.limit) : filtered;
    },
    async getOrchestratorWorkflow(workflowId, filters = {}) {
      const values = [[ 'orchestrator_schedule', 'orchestrator_update', 'orchestrator_aggregate' ], workflowId];
      const clauses = [`resource_type = 'workflow'`, `action = ANY($1::text[])`, `resource_id = $2`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      const result = await db.query(
        `SELECT metadata_json FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 1`,
        values,
      );
      return result.rows[0] ? mapOrchestratorWorkflow(result.rows[0]) ?? null : null;
    },
    async recordToolExecution(entry) {
      await insertAudit(db, {
        id: entry.id,
        tenantId: entry.tenantId ?? null,
        appId: entry.appId ?? null,
        actor: entry.actor,
        action: 'tool_execute',
        resourceType: 'tool',
        resourceId: entry.tool,
        summary: entry.summary,
        metadata: {
          status: entry.status,
          riskLevel: entry.riskLevel,
          executionMode: entry.executionMode,
          permissions: entry.permissions ?? [],
          safetyGuards: entry.safetyGuards ?? [],
          durationMs: entry.durationMs,
          inputPreview: entry.inputPreview,
          outputPreview: entry.outputPreview,
          errorMessage: entry.errorMessage,
        },
        timestamp: entry.createdAt ?? new Date().toISOString(),
      });

      const failureRate = entry.status === 'failed' ? 100 : 0;
      await db.query(
        `INSERT INTO tool_registry (name, schema_json, permissions_json, risk_level, usage_today, p95_ms, error_rate, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, 1, $5, $6, $7)
         ON CONFLICT (name) DO UPDATE SET
           schema_json = EXCLUDED.schema_json,
           permissions_json = EXCLUDED.permissions_json,
           risk_level = EXCLUDED.risk_level,
           usage_today = tool_registry.usage_today + 1,
           p95_ms = GREATEST(tool_registry.p95_ms, EXCLUDED.p95_ms),
           error_rate = ROUND((((tool_registry.error_rate * tool_registry.usage_today) + $6) / NULLIF(tool_registry.usage_today + 1, 0))::numeric, 2),
           updated_at = EXCLUDED.updated_at`,
        [
          entry.tool,
          JSON.stringify(entry.schema ?? []),
          JSON.stringify(entry.permissions ?? []),
          entry.riskLevel,
          entry.durationMs,
          failureRate,
          entry.createdAt ?? new Date().toISOString(),
        ],
      );

      return {
        id: entry.id,
        tool: entry.tool,
        actor: entry.actor,
        tenantId: entry.tenantId ?? null,
        appId: entry.appId ?? null,
        status: entry.status,
        riskLevel: entry.riskLevel,
        executionMode: entry.executionMode,
        permissions: entry.permissions ?? [],
        safetyGuards: entry.safetyGuards ?? [],
        durationMs: entry.durationMs,
        summary: entry.summary,
        inputPreview: entry.inputPreview,
        outputPreview: entry.outputPreview,
        errorMessage: entry.errorMessage,
        createdAt: entry.createdAt ?? new Date().toISOString(),
      };
    },
    async listModels() {
      const result = await db.query(`SELECT key, service, active_model, fallback_model, provider, latency_ms, token_usage_1h, error_rate, candidates_json FROM model_registry ORDER BY key ASC`);
      return result.rows.map(mapModel);
    },
    async switchModel(payload, actor) {
      const timestamp = new Date().toISOString();
      const result = await db.query(`SELECT key, service, active_model, fallback_model, provider, latency_ms, token_usage_1h, error_rate, candidates_json FROM model_registry WHERE key = $1`, [payload.key]);
      const row = result.rows[0];
      if (!row) {
        throw new HttpError(404, 'MODEL_NOT_FOUND', `No model found for ${payload.key}.`);
      }
      await db.query('UPDATE model_registry SET active_model = $2, updated_at = $3 WHERE key = $1', [payload.key, payload.targetModel, timestamp]);
      const model = { ...mapModel(row), activeModel: payload.targetModel };
      const audit = { id: `audit_${randomUUID()}`, actor, actorDisplay: actor, action: 'switch_model', resourceType: 'model', resourceId: payload.key, timestamp, summary: `Switched model to ${payload.targetModel}` };
      await insertAudit(db, audit);
      await publishControlPlaneDomainEvent({ tenantId: 'platform-root', appId: 'control-dashboard', actor, actorDisplay: actor, type: 'model_switched', source: 'control_plane_api', resourceType: 'model', resourceId: payload.key, summary: audit.summary, timestamp, metadata: { targetModel: payload.targetModel } }, { db });
      return { model, audit };
    },
    async listMemory(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(`SELECT id, tenant_id, app_id, scope, records_count, vector_count, last_compaction_at FROM ai_memory ${scoped.sql} ORDER BY id ASC`, scoped.values);
      return result.rows.map(mapMemory);
    },
    async listAuditLogs(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(
        `SELECT id, tenant_id, app_id, user_id, action, resource_type, resource_id, summary, metadata_json, created_at
         FROM audit_logs ${scoped.sql} ORDER BY created_at DESC`,
        scoped.values,
      );
      return result.rows.map(mapAuditRecord);
    },
    async listToolExecutions(filters = {}) {
      const values = [];
      const clauses = [`action = 'tool_execute'`, `resource_type = 'tool'`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        clauses.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        clauses.push(`app_id = $${values.length}`);
      }
      if (filters.tool) {
        values.push(filters.tool);
        clauses.push(`resource_id = $${values.length}`);
      }
      if (filters.status) {
        values.push(filters.status);
        clauses.push(`metadata_json->>'status' = $${values.length}`);
      }
      let sql = `SELECT id, tenant_id, app_id, user_id, resource_id, summary, metadata_json, created_at FROM audit_logs WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`;
      if (typeof filters.limit === 'number') {
        sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      }
      const result = await db.query(sql, values);
      return result.rows.map(mapToolExecution);
    },
    async getKnowledgeGraph(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const result = await db.query(
        `SELECT id, type, label, metadata, description, tags_json, score, health, tenant_id, app_id
         FROM graph_nodes ${scoped.sql}
         ORDER BY label ASC`,
        scoped.values,
      );
      const nodes = result.rows.map(mapGraphNode);
      if (!nodes.length) {
        return { nodes: [], edges: [] };
      }
      const edges = await db.query(`SELECT id, source, target, label, category, strength, evidence_count FROM graph_edges WHERE source = ANY($1::text[]) AND target = ANY($1::text[])`, [nodes.map((node) => node.id)]);
      return applyKnowledgeGraphQuery({ nodes: clone(nodes), edges: edges.rows.map(mapGraphEdge) }, filters);
    },
    async listEvents(filters = {}) {
      const scoped = buildScopedWhere(filters);
      const values = [...scoped.values];
      const conditions = scoped.sql ? [scoped.sql.replace(/^WHERE /, '')] : [];
      if (filters.eventType) {
        conditions.push(`event_type = $${values.length + 1}`);
        values.push(filters.eventType);
      }
      let sql = `SELECT payload_json FROM events_outbox ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC`;
      if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
        sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      }
      const result = await db.query(sql, values);
      return result.rows.map(mapEvent);
    },
    async getAnalytics(filters = {}) {
      if (!filters.tenantId && !filters.appId) {
        return clone(analyticsData);
      }
      const [tenants, apps, agents] = await Promise.all([this.listTenants(filters), this.listApps(filters), this.listAgents(filters)]);
      return {
        ...clone(analyticsData),
        kpis: [
          { label: 'Scoped tenants', value: `${tenants.length}`, change: 'context aware' },
          { label: 'Scoped apps', value: `${apps.length}`, change: 'context aware' },
          { label: 'Scoped agent decisions', value: `${agents.reduce((sum, agent) => sum + agent.decisionsToday, 0)}`, change: 'context aware' },
        ],
        tenantGrowth: filterScopedTenants(tenants, filters).map((tenant) => ({ label: tenant.name, value: tenant.apps })),
      };
    },
    async getObservability() {
      const result = await db.query(`SELECT name, layer, status, cpu_percent, memory_percent, restarts_24h, endpoint FROM observability_services ORDER BY name ASC`);
      const metrics = await loadPrometheusServiceMetrics(config);
      return applyObservabilityAlertThresholds(
        enrichObservabilityServices(result.rows.map(mapObservability), metrics),
        config.observabilityServiceAlertThresholdsJson,
      );
    },
    async listClientErrors(filters = {}) {
      const conditions = [`action = 'client_error'`];
      const values = [];

      if (filters.tenantId) {
        values.push(filters.tenantId);
        conditions.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        conditions.push(`app_id = $${values.length}`);
      }

      const result = await db.query(
        `SELECT id, tenant_id, app_id, user_id, summary, metadata_json, created_at
         FROM audit_logs
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT 25`,
        values,
      );
      return result.rows.map(mapClientError);
    },
    async getSystem() {
      const result = await db.query(`SELECT section_title, key, value, description, scope FROM system_settings ORDER BY section_title ASC, key ASC`);
      const sections = new Map();
      for (const row of result.rows) {
        const current = sections.get(row.section_title) ?? { title: row.section_title, items: [] };
        current.items.push({ key: row.key, value: row.value, description: row.description, scope: row.scope });
        sections.set(row.section_title, current);
      }
      return [...sections.values()];
    },
    async saveEmbeddings(input) {
      return db.transaction(async (tx) => {
        for (const document of input.documents) {
          await tx.query(
            `INSERT INTO documents (id, tenant_id, app_id, source_type, source_uri, title, content_text, checksum, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
            [
              document.id,
              document.tenantId,
              document.appId,
              document.sourceType,
              document.sourceUri,
              document.title,
              document.contentText,
              document.checksum,
              JSON.stringify(document.metadata ?? {}),
            ],
          );
        }

        for (const embedding of input.embeddings) {
          await tx.query(
            `INSERT INTO embeddings (id, document_id, embedding_model, chunk_index, chunk_text, embedding_dimensions, embedding_vector, metadata_json)
             VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8::jsonb)`,
            [
              embedding.id,
              embedding.documentId,
              embedding.embeddingModel,
              embedding.chunkIndex,
              embedding.chunkText,
              embedding.embeddingDimensions,
              vectorToPgLiteral(embedding.embeddingVector),
              JSON.stringify(embedding.metadata ?? {}),
            ],
          );
        }

        if (input.tenantId && input.appId) {
          await tx.query(
            `INSERT INTO ai_memory (id, tenant_id, app_id, scope, records_count, vector_count, last_compaction_at)
             VALUES ($1, $2, $3, 'app', $4, $5, NOW())
             ON CONFLICT (id) DO UPDATE SET
               records_count = ai_memory.records_count + EXCLUDED.records_count,
               vector_count = ai_memory.vector_count + EXCLUDED.vector_count,
               last_compaction_at = NOW()`,
            [`mem_embed_${input.tenantId}_${input.appId}`, input.tenantId, input.appId, input.documents.length, input.embeddings.length],
          );
        }

        return {
          documents: input.documents.map((item) => ({
            id: item.id,
            tenantId: item.tenantId,
            appId: item.appId,
            sourceType: item.sourceType,
            sourceUri: item.sourceUri,
            title: item.title,
            checksum: item.checksum,
            chunkCount: item.chunkCount,
            metadata: item.metadata,
          })),
          embeddings: input.embeddings,
        };
      });
    },
    async saveUsagePattern(input) {
      const result = await db.query(
        `INSERT INTO usage_patterns (id, tenant_id, app_id, scope, signal_key, signal_value, sample_count, metadata_json, window_started_at, window_ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           signal_value = EXCLUDED.signal_value,
           sample_count = usage_patterns.sample_count + EXCLUDED.sample_count,
           metadata_json = EXCLUDED.metadata_json,
           window_started_at = LEAST(usage_patterns.window_started_at, EXCLUDED.window_started_at),
           window_ended_at = GREATEST(usage_patterns.window_ended_at, EXCLUDED.window_ended_at)
         RETURNING id, tenant_id, app_id, scope, signal_key, signal_value, sample_count, metadata_json, window_started_at, window_ended_at, created_at`,
        [
          input.id,
          input.tenantId ?? null,
          input.appId ?? null,
          input.scope,
          input.signalKey,
          input.signalValue,
          input.sampleCount ?? 1,
          JSON.stringify(input.metadata ?? {}),
          input.windowStartedAt ?? new Date().toISOString(),
          input.windowEndedAt ?? new Date().toISOString(),
        ],
      );
      return mapUsagePattern(result.rows[0]);
    },
    async listUsagePatterns(filters = {}) {
      const values = [];
      const conditions = [];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        conditions.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        conditions.push(`app_id = $${values.length}`);
      }
      if (filters.scope) {
        values.push(filters.scope);
        conditions.push(`scope = $${values.length}`);
      }
      if (filters.signalKeyPrefix) {
        values.push(`${filters.signalKeyPrefix}%`);
        conditions.push(`signal_key LIKE $${values.length}`);
      }
      if (filters.userId) {
        values.push(filters.userId);
        conditions.push(`metadata_json->>'userId' = $${values.length}`);
      }
      if (filters.agentId) {
        values.push(filters.agentId);
        conditions.push(`metadata_json->>'agentId' = $${values.length}`);
      }
      let sql = `SELECT id, tenant_id, app_id, scope, signal_key, signal_value, sample_count, metadata_json, window_started_at, window_ended_at, created_at FROM usage_patterns ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY window_ended_at DESC, created_at DESC`;
      if (typeof filters.limit === 'number') {
        sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      }
      const result = await db.query(sql, values);
      return result.rows.map(mapUsagePattern);
    },
    async listConversationTurns(filters = {}) {
      const values = [];
      const conditions = [`source_type = 'query'`, `metadata_json->>'memoryKind' = 'conversation_turn'`];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        conditions.push(`tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        conditions.push(`app_id = $${values.length}`);
      }
      if (filters.userId) {
        values.push(filters.userId);
        conditions.push(`metadata_json->>'userId' = $${values.length}`);
      }
      if (filters.sessionId) {
        values.push(filters.sessionId);
        conditions.push(`metadata_json->>'sessionId' = $${values.length}`);
      }
      let sql = `SELECT id, tenant_id, app_id, title, content_text, metadata_json, created_at FROM documents WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
      if (typeof filters.limit === 'number') {
        sql += ` LIMIT ${Math.max(1, Math.floor(filters.limit))}`;
      }
      const result = await db.query(sql, values);
      return result.rows.map((row) => ({
        id: row.metadata_json?.turnId ?? row.id,
        documentId: row.id,
        sessionId: row.metadata_json?.sessionId ?? '',
        tenantId: row.tenant_id,
        appId: row.app_id,
        userId: row.metadata_json?.userId ?? '',
        pathname: row.metadata_json?.pathname,
        userMessage: row.metadata_json?.userMessage ?? '',
        assistantMessage: row.metadata_json?.assistantMessage ?? '',
        toolCalls: row.metadata_json?.toolCalls ?? [],
        createdAt: row.metadata_json?.turnCreatedAt ?? row.created_at?.toISOString() ?? new Date(0).toISOString(),
      }));
    },
    async searchEmbeddings(filters = {}) {
      const values = [vectorToPgLiteral(filters.vector ?? [])];
      const conditions = [];
      if (filters.tenantId) {
        values.push(filters.tenantId);
        conditions.push(`d.tenant_id = $${values.length}`);
      }
      if (filters.appId) {
        values.push(filters.appId);
        conditions.push(`d.app_id = $${values.length}`);
      }
      if (filters.sourceTypes?.length) {
        values.push(filters.sourceTypes);
        conditions.push(`d.source_type = ANY($${values.length}::text[])`);
      }
      const sql = `SELECT e.id, e.document_id, e.chunk_text, d.source_type, d.title, d.metadata_json, d.created_at,
          1 - (e.embedding_vector <=> $1::vector) AS score
        FROM embeddings e
        INNER JOIN documents d ON d.id = e.document_id
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ORDER BY e.embedding_vector <=> $1::vector ASC
        LIMIT ${Math.max(1, Math.floor(filters.limit ?? 4))}`;
      const result = await db.query(sql, values);
      return result.rows.map((row) => ({
        id: row.id,
        documentId: row.document_id,
        sourceType: row.source_type,
        title: row.title,
        snippet: row.chunk_text,
        score: row.score,
        metadata: row.metadata_json ?? {},
        createdAt: row.created_at?.toISOString() ?? new Date(0).toISOString(),
      }));
    },
    async publishDomainEvent(input) {
      return publishControlPlaneDomainEvent(input, { db });
    },
  };
}