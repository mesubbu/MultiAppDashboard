import pg from 'pg';

import {
  agentsData,
  appsData,
  eventsData,
  graphEdgesData,
  graphNodesData,
  memoryData,
  modelsData,
  observabilityData,
  systemData,
  tenantsData,
  toolsData,
  usersData,
} from '../control-plane-api/src/data/platform-data.mjs';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run db:seed');
}

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query('BEGIN');
  await client.query(`
    TRUNCATE TABLE
      knowledge_events,
      market_signals,
      usage_patterns,
      agent_performance,
      agent_tasks,
      vector_index_map,
      embeddings,
      documents,
      entity_attributes,
      relationships,
      entities,
      login_audits,
      auth_sessions,
      audit_logs,
      events_outbox,
      graph_edges,
      graph_nodes,
      ai_memory,
      observability_services,
      system_settings,
      model_registry,
      tool_registry,
      agents,
      users,
      tenant_apps,
      tenants
    RESTART IDENTITY CASCADE
  `);

  for (const tenant of tenantsData) {
    await client.query(
      `INSERT INTO tenants (id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [tenant.id, tenant.name, tenant.tier, tenant.status, tenant.region, tenant.apps, tenant.users, tenant.monthlySpendUsd, tenant.eventQuotaDaily],
    );
  }

  for (const app of appsData) {
    await client.query(
      `INSERT INTO tenant_apps (id, tenant_id, name, runtime, environment, status, region, agents_attached)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [app.id, app.tenantId, app.name, app.runtime, app.environment, app.status, app.region, app.agentsAttached],
    );
  }

  for (const user of usersData) {
    await client.query(
      `INSERT INTO users (id, tenant_id, app_id, email, name, role, status, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [user.id, user.tenantId, user.appId, '', user.name, user.role, user.status, user.lastSeenAt],
    );
  }

  for (const agent of agentsData) {
    await client.query(
      `INSERT INTO agents (
        id, tenant_id, app_id, name, state, queue, queue_depth, budget_usd,
        budget_utilization_percent, avg_latency_ms, token_usage_1h, decisions_today,
        workflow_version, last_task, last_heartbeat_at, orchestration_json,
        tasks_json, decisions_json, logs_json, execution_history_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        agent.id,
        agent.tenantId,
        agent.appId,
        agent.name,
        agent.state,
        agent.queue,
        agent.queueDepth,
        agent.budgetUsd,
        agent.budgetUtilizationPercent,
        agent.avgLatencyMs,
        agent.tokenUsage1h,
        agent.decisionsToday,
        agent.workflowVersion,
        agent.lastTask,
        agent.lastHeartbeatAt,
        JSON.stringify(agent.orchestration),
        JSON.stringify(agent.tasks),
        JSON.stringify(agent.decisions),
        JSON.stringify(agent.logs),
        JSON.stringify(agent.executionHistory),
      ],
    );
  }

  for (const tool of toolsData) {
    await client.query(
      `INSERT INTO tool_registry (name, schema_json, permissions_json, risk_level, usage_today, p95_ms, error_rate)
       VALUES ($1,$2::jsonb,$3::jsonb,$4,$5,$6,$7)`,
      [tool.name, JSON.stringify(tool.schema), JSON.stringify(tool.permissions), tool.riskLevel, tool.usageToday, tool.p95Ms, tool.errorRate],
    );
  }

  for (const model of modelsData) {
    await client.query(
      `INSERT INTO model_registry (key, service, active_model, fallback_model, provider, latency_ms, token_usage_1h, error_rate, candidates_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
      [model.key, model.service, model.activeModel, model.fallbackModel, model.provider, model.latencyMs, model.tokenUsage1h, model.errorRate, JSON.stringify(model.candidates)],
    );
  }

  for (const record of memoryData) {
    await client.query(
      `INSERT INTO ai_memory (id, tenant_id, app_id, scope, records_count, vector_count, last_compaction_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.tenantId, record.appId, record.scope, record.records, record.vectorCount, record.lastCompactionAt],
    );
  }

  for (const node of graphNodesData) {
    await client.query(
      `INSERT INTO graph_nodes (id, type, label, metadata, description, tags_json, score, health, tenant_id, app_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
      [node.id, node.type, node.label, node.metadata, node.description, JSON.stringify(node.tags), node.score, node.health, node.tenantId ?? null, node.appId ?? null],
    );
  }

  for (const edge of graphEdgesData) {
    await client.query(
      `INSERT INTO graph_edges (id, source, target, label, category, strength, evidence_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [edge.id, edge.source, edge.target, edge.label, edge.category, edge.strength, edge.evidenceCount],
    );
  }

  for (const event of eventsData) {
    await client.query(
      `INSERT INTO events_outbox (id, tenant_id, app_id, event_type, actor, payload_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [event.id, event.tenantId, event.appId, event.type, event.actor, JSON.stringify(event), event.timestamp],
    );
  }

  for (const section of systemData) {
    for (const item of section.items) {
      await client.query(
        `INSERT INTO system_settings (section_title, key, value, description, scope)
         VALUES ($1,$2,$3,$4,$5)`,
        [section.title, item.key, item.value, item.description, 'platform'],
      );
    }
  }

  for (const service of observabilityData) {
    await client.query(
      `INSERT INTO observability_services (name, layer, status, cpu_percent, memory_percent, restarts_24h, endpoint)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [service.name, service.layer, service.status, service.cpuPercent, service.memoryPercent, service.restarts24h, service.endpoint],
    );
  }

  await client.query('COMMIT');
  console.log('[db:seed] seeded platform control-plane data');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
