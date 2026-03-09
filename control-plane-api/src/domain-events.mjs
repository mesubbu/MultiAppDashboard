import { randomUUID } from 'node:crypto';

import { z } from 'zod';

const domainEventTypeSchema = z.enum([
  'listing_created', 'order_placed', 'message_sent', 'agent_triggered',
  'tenant_created', 'tenant_updated', 'app_created', 'app_updated',
  'user_created', 'user_updated', 'agent_action_requested', 'model_switched',
  'agent_task_scheduled', 'agent_run_updated', 'workflow_aggregated',
  'research_collected', 'research_schedule_triggered',
  'research_requested', 'analysis_completed', 'signal_detected', 'recommendation_created', 'agent_outcome_recorded', 'search_performed',
]);

const domainEventSchema = z.object({
  id: z.string(),
  type: domainEventTypeSchema,
  tenantId: z.string(),
  appId: z.string(),
  actor: z.string(),
  actorDisplay: z.string().optional(),
  source: z.string().min(1),
  resourceType: z.enum(['tenant', 'app', 'user', 'agent', 'model', 'search', 'signal', 'knowledge', 'system', 'workflow', 'research', 'recommendation']),
  resourceId: z.string(),
  summary: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const analyticsEventTypes = new Set([
  'tenant_created', 'tenant_updated', 'app_created', 'app_updated', 'user_created', 'user_updated',
  'agent_action_requested', 'agent_task_scheduled', 'agent_run_updated', 'workflow_aggregated',
  'model_switched', 'research_collected', 'research_schedule_triggered', 'research_requested', 'analysis_completed',
  'signal_detected', 'recommendation_created', 'agent_outcome_recorded', 'search_performed',
]);

function createDomainEvent(input) {
  return domainEventSchema.parse({ id: input.id ?? `evt_${randomUUID()}`, timestamp: input.timestamp ?? new Date().toISOString(), ...input, metadata: input.metadata ?? {} });
}

function toPlatformEvent(event) {
  return {
    id: event.id,
    tenantId: event.tenantId,
    appId: event.appId,
    type: event.type,
    actor: event.actorDisplay ?? event.actor,
    summary: event.summary,
    timestamp: event.timestamp,
  };
}

function startOfUtcDay(timestamp) {
  const day = new Date(timestamp);
  day.setUTCHours(0, 0, 0, 0);
  return day.toISOString();
}

function sanitizeScopePart(value) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'scope';
}

function createAgentWorkflowSubscriber(persist) {
  return async (event) => {
    if (!['agent_action_requested', 'agent_task_scheduled'].includes(event.type) || event.resourceType !== 'agent') return;
    await persist(event);
  };
}

function createAnalyticsSubscriber(persist) {
  return async (event) => {
    if (!analyticsEventTypes.has(event.type)) return;
    await persist(event);
  };
}

async function persistDomainEventToDb(db, event) {
  await db.query(
    `INSERT INTO knowledge_events (id, tenant_id, app_id, event_type, source_service, source_ref, payload_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [event.id, event.tenantId, event.appId, event.type, event.source, `${event.resourceType}:${event.resourceId}`, JSON.stringify({ actor: event.actor, actorDisplay: event.actorDisplay, summary: event.summary, metadata: event.metadata }), event.timestamp],
  );

  await db.query(
    `INSERT INTO events_outbox (id, tenant_id, app_id, event_type, actor, payload_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [event.id, event.tenantId, event.appId, event.type, event.actor, JSON.stringify(toPlatformEvent(event)), event.timestamp],
  );
}

async function persistAgentWorkflowProjectionToDb(db, event) {
  await db.query(
    `INSERT INTO agent_tasks (id, agent_id, task_type, status, priority, input_json, output_summary, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8) ON CONFLICT (id) DO NOTHING`,
    [
      typeof event.metadata.taskId === 'string' ? event.metadata.taskId : `task_${event.id}`,
      event.resourceId,
      typeof event.metadata.action === 'string' ? event.metadata.action : event.type,
      typeof event.metadata.taskStatus === 'string' ? event.metadata.taskStatus : 'queued',
      typeof event.metadata.priority === 'number' ? event.metadata.priority : 0,
      JSON.stringify(event.metadata),
      event.summary,
      event.timestamp,
    ],
  );
}

async function persistAnalyticsProjectionToDb(db, event) {
  const windowStartedAt = startOfUtcDay(event.timestamp);
  const usageId = `usage_${sanitizeScopePart(event.tenantId)}_${sanitizeScopePart(event.appId)}_${event.type}_${windowStartedAt.slice(0, 10)}`;
  await db.query(
    `INSERT INTO usage_patterns (id, tenant_id, app_id, scope, signal_key, signal_value, sample_count, metadata_json, window_started_at, window_ended_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       sample_count = usage_patterns.sample_count + 1,
       metadata_json = COALESCE(usage_patterns.metadata_json, '{}'::jsonb) || EXCLUDED.metadata_json,
       window_ended_at = EXCLUDED.window_ended_at`,
    [usageId, event.tenantId, event.appId, 'operator', 'domain_event', event.type, 1, JSON.stringify({ lastActor: event.actor, lastResourceType: event.resourceType, lastSource: event.source }), windowStartedAt, event.timestamp, event.timestamp],
  );
}

export async function publishControlPlaneDomainEvent(input, { db, state } = {}) {
  const event = createDomainEvent(input);
  const subscribers = [
    createAgentWorkflowSubscriber(async (agentEvent) => {
      if (!db) return;
      await persistAgentWorkflowProjectionToDb(db, agentEvent);
    }),
    createAnalyticsSubscriber(async (analyticsEvent) => {
      if (!db) return;
      await persistAnalyticsProjectionToDb(db, analyticsEvent);
    }),
  ];

  if (db) {
    await persistDomainEventToDb(db, event);
  } else if (state) {
    state.events.unshift(toPlatformEvent(event));
  }

  await Promise.all(subscribers.map((subscriber) => subscriber(event)));
  return event;
}