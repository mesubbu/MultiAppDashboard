import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tier: text('tier').notNull(),
  status: text('status').notNull(),
  region: text('region').notNull(),
  apps: integer('apps').notNull().default(0),
  users: integer('users').notNull().default(0),
  monthlySpendUsd: doublePrecision('monthly_spend_usd').notNull().default(0),
  eventQuotaDaily: integer('event_quota_daily').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tenantApps = pgTable('tenant_apps', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  runtime: text('runtime').notNull(),
  environment: text('environment').notNull(),
  status: text('status').notNull(),
  region: text('region').notNull(),
  agentsAttached: integer('agents_attached').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('tenant_apps_tenant_idx').on(table.tenantId)]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').notNull().references(() => tenantApps.id, { onDelete: 'cascade' }),
  email: text('email').notNull().default(''),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('users_tenant_idx').on(table.tenantId), index('users_app_idx').on(table.appId)]);

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').notNull().references(() => tenantApps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  state: text('state').notNull(),
  queue: text('queue').notNull(),
  queueDepth: integer('queue_depth').notNull().default(0),
  budgetUsd: doublePrecision('budget_usd').notNull().default(0),
  budgetUtilizationPercent: integer('budget_utilization_percent').notNull().default(0),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  tokenUsage1h: integer('token_usage_1h').notNull().default(0),
  decisionsToday: integer('decisions_today').notNull().default(0),
  workflowVersion: text('workflow_version').notNull(),
  lastTask: text('last_task').notNull().default(''),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }).notNull().defaultNow(),
  orchestrationJson: jsonb('orchestration_json').notNull().default({}),
  tasksJson: jsonb('tasks_json').notNull().default([]),
  decisionsJson: jsonb('decisions_json').notNull().default([]),
  logsJson: jsonb('logs_json').notNull().default([]),
  executionHistoryJson: jsonb('execution_history_json').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('agents_scope_idx').on(table.tenantId, table.appId)]);

export const toolRegistry = pgTable('tool_registry', {
  name: text('name').primaryKey(),
  schemaJson: jsonb('schema_json').notNull().default([]),
  permissionsJson: jsonb('permissions_json').notNull().default([]),
  riskLevel: text('risk_level').notNull(),
  usageToday: integer('usage_today').notNull().default(0),
  p95Ms: integer('p95_ms').notNull().default(0),
  errorRate: doublePrecision('error_rate').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelRegistry = pgTable('model_registry', {
  key: text('key').primaryKey(),
  service: text('service').notNull(),
  activeModel: text('active_model').notNull(),
  fallbackModel: text('fallback_model').notNull(),
  provider: text('provider').notNull(),
  latencyMs: integer('latency_ms').notNull().default(0),
  tokenUsage1h: integer('token_usage_1h').notNull().default(0),
  errorRate: doublePrecision('error_rate').notNull().default(0),
  candidatesJson: jsonb('candidates_json').notNull().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const aiMemory = pgTable('ai_memory', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').notNull().references(() => tenantApps.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(),
  recordsCount: integer('records_count').notNull(),
  vectorCount: integer('vector_count').notNull(),
  lastCompactionAt: timestamp('last_compaction_at', { withTimezone: true }),
});

export const graphNodes = pgTable('graph_nodes', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  metadata: text('metadata').notNull().default(''),
  description: text('description').notNull().default(''),
  tagsJson: jsonb('tags_json').notNull().default([]),
  score: doublePrecision('score').notNull().default(0),
  health: text('health').notNull().default('healthy'),
  tenantId: text('tenant_id'),
  appId: text('app_id'),
});

export const graphEdges = pgTable('graph_edges', {
  id: text('id').primaryKey(),
  source: text('source').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  target: text('target').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  category: text('category').notNull(),
  strength: doublePrecision('strength').notNull().default(0),
  evidenceCount: integer('evidence_count').notNull().default(0),
});

export const knowledgeEntities = pgTable('entities', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').references(() => tenantApps.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  externalKey: text('external_key').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  source: text('source').notNull().default('manual'),
  confidence: doublePrecision('confidence').notNull().default(0),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('entities_scope_idx').on(table.tenantId, table.appId, table.entityType),
  index('entities_external_key_idx').on(table.externalKey),
]);

export const knowledgeRelationships = pgTable('relationships', {
  id: text('id').primaryKey(),
  fromEntityId: text('from_entity_id').notNull().references(() => knowledgeEntities.id, { onDelete: 'cascade' }),
  toEntityId: text('to_entity_id').notNull().references(() => knowledgeEntities.id, { onDelete: 'cascade' }),
  relationshipType: text('relationship_type').notNull(),
  direction: text('direction').notNull().default('directed'),
  weight: doublePrecision('weight').notNull().default(0),
  evidenceJson: jsonb('evidence_json').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('relationships_from_idx').on(table.fromEntityId),
  index('relationships_to_idx').on(table.toEntityId),
]);

export const knowledgeEntityAttributes = pgTable('entity_attributes', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull().references(() => knowledgeEntities.id, { onDelete: 'cascade' }),
  attributeKey: text('attribute_key').notNull(),
  valueText: text('value_text'),
  valueJson: jsonb('value_json'),
  source: text('source').notNull().default('manual'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('entity_attributes_entity_idx').on(table.entityId, table.attributeKey),
]);

export const knowledgeDocuments = pgTable('documents', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').references(() => tenantApps.id, { onDelete: 'cascade' }),
  sourceType: text('source_type').notNull(),
  sourceUri: text('source_uri').notNull().default(''),
  title: text('title').notNull(),
  contentText: text('content_text').notNull(),
  checksum: text('checksum').notNull().default(''),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('documents_scope_idx').on(table.tenantId, table.appId, table.createdAt),
  index('documents_source_idx').on(table.sourceType),
]);

export const knowledgeEmbeddings = pgTable('embeddings', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => knowledgeDocuments.id, { onDelete: 'cascade' }),
  embeddingModel: text('embedding_model').notNull(),
  chunkIndex: integer('chunk_index').notNull().default(0),
  chunkText: text('chunk_text').notNull(),
  embeddingDimensions: integer('embedding_dimensions').notNull().default(1536),
  embeddingVector: vector('embedding_vector', { dimensions: 1536 }).notNull(),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('embeddings_document_idx').on(table.documentId, table.chunkIndex),
  index('embeddings_vector_cosine_idx').using('hnsw', table.embeddingVector.op('vector_cosine_ops')),
]);

export const vectorIndexMap = pgTable('vector_index_map', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  vectorTable: text('vector_table').notNull().default('embeddings'),
  indexName: text('index_name').notNull(),
  distanceMetric: text('distance_metric').notNull().default('cosine'),
  dimensions: integer('dimensions').notNull().default(1536),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  lastReindexedAt: timestamp('last_reindexed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('vector_index_map_name_idx').on(table.indexName)]);

export const agentTasks = pgTable('agent_tasks', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  taskType: text('task_type').notNull(),
  status: text('status').notNull(),
  priority: integer('priority').notNull().default(0),
  inputJson: jsonb('input_json').notNull().default({}),
  outputSummary: text('output_summary').notNull().default(''),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('agent_tasks_agent_idx').on(table.agentId, table.status, table.createdAt),
]);

export const agentPerformance = pgTable('agent_performance', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  evaluationWindow: text('evaluation_window').notNull(),
  successRate: doublePrecision('success_rate').notNull().default(0),
  avgLatencyMs: integer('avg_latency_ms').notNull().default(0),
  avgCostUsd: doublePrecision('avg_cost_usd').notNull().default(0),
  taskCount: integer('task_count').notNull().default(0),
  feedbackScore: doublePrecision('feedback_score').notNull().default(0),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('agent_performance_agent_idx').on(table.agentId, table.recordedAt),
]);

export const usagePatterns = pgTable('usage_patterns', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').references(() => tenantApps.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull().default('operator'),
  signalKey: text('signal_key').notNull(),
  signalValue: text('signal_value').notNull(),
  sampleCount: integer('sample_count').notNull().default(0),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }),
  windowEndedAt: timestamp('window_ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('usage_patterns_scope_idx').on(table.tenantId, table.appId, table.signalKey),
]);

export const marketSignals = pgTable('market_signals', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').references(() => tenantApps.id, { onDelete: 'cascade' }),
  signalType: text('signal_type').notNull(),
  subject: text('subject').notNull(),
  direction: text('direction').notNull().default('neutral'),
  strength: doublePrecision('strength').notNull().default(0),
  confidence: doublePrecision('confidence').notNull().default(0),
  summary: text('summary').notNull().default(''),
  metadataJson: jsonb('metadata_json').notNull().default({}),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('market_signals_detected_idx').on(table.detectedAt),
  index('market_signals_subject_idx').on(table.subject),
]);

export const knowledgeEvents = pgTable('knowledge_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').references(() => tenantApps.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  sourceService: text('source_service').notNull(),
  sourceRef: text('source_ref').notNull().default(''),
  entityId: text('entity_id').references(() => knowledgeEntities.id, { onDelete: 'set null' }),
  documentId: text('document_id').references(() => knowledgeDocuments.id, { onDelete: 'set null' }),
  payloadJson: jsonb('payload_json').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('knowledge_events_created_idx').on(table.createdAt),
  index('knowledge_events_type_idx').on(table.eventType),
]);

export const eventsOutbox = pgTable('events_outbox', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  appId: text('app_id').notNull().references(() => tenantApps.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  actor: text('actor'),
  payloadJson: jsonb('payload_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('events_scope_idx').on(table.tenantId, table.appId, table.createdAt)]);

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id'),
  appId: text('app_id'),
  userId: text('user_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  summary: text('summary'),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('audit_created_idx').on(table.createdAt)]);

export const systemSettings = pgTable('system_settings', {
  sectionTitle: text('section_title').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  description: text('description').notNull(),
  scope: text('scope').notNull().default('platform'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.sectionTitle, table.key] })]);

export const observabilityServices = pgTable('observability_services', {
  name: text('name').primaryKey(),
  layer: text('layer').notNull(),
  status: text('status').notNull(),
  cpuPercent: integer('cpu_percent').notNull().default(0),
  memoryPercent: integer('memory_percent').notNull().default(0),
  restarts24h: integer('restarts_24h').notNull().default(0),
  endpoint: text('endpoint').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  sessionId: text('session_id').primaryKey(),
  userJson: jsonb('user_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
});

export const loginAudits = pgTable('login_audits', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  userId: text('user_id'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent').notNull(),
  outcome: text('outcome').notNull(),
  reason: text('reason'),
}, (table) => [index('login_audits_timestamp_idx').on(table.timestamp)]);
