import { z } from 'zod';

export const roleSchema = z.enum([
  'platform_owner',
  'platform_admin',
  'tenant_admin',
  'ops_admin',
  'analyst',
  'viewer',
]);

export const permissionSchema = z.enum([
  'tenants:read',
  'tenants:write',
  'apps:read',
  'apps:write',
  'users:read',
  'users:write',
  'agents:read',
  'agents:operate',
  'tools:read',
  'models:read',
  'models:switch',
  'research:read',
  'research:operate',
  'memory:read',
  'graph:read',
  'events:read',
  'analytics:read',
  'observability:read',
  'audit:read',
  'system:write',
]);

export const statusSchema = z.enum(['healthy', 'degraded', 'critical']);
export const assistantToolNameSchema = z.enum([
  'control.read.overview',
  'control.read.analytics',
  'control.read.agents',
  'control.read.tools',
  'control.read.knowledge-graph',
  'control.read.events',
  'control.read.observability',
  'control.read.memory',
  'control.read.models',
  'control.read.market-signals',
  'control.read.recommendations',
  'control.read.agent-performance',
  'control.run.research-agent',
  'control.run.insight-agent',
  'control.run.recommendation-agent',
  'control.write.feedback',
]);
const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const agentStateSchema = z.enum(['running', 'paused', 'throttled', 'error']);
const agentTaskStatusSchema = z.enum([
  'queued',
  'running',
  'waiting_review',
  'completed',
  'failed',
]);
const agentDecisionOutcomeSchema = z.enum([
  'approved',
  'blocked',
  'rerouted',
  'flagged',
]);
const agentActionSchema = z.enum([
  'pause',
  'restart',
  'update_budget',
  'update_workflow',
  'move_stage',
  'retry_queue',
  'unblock',
  'reroute',
]);
const agentLogLevelSchema = z.enum(['info', 'warn', 'error']);
const agentExecutionStatusSchema = z.enum(['running', 'success', 'warning', 'failed']);
const agentOrchestrationStageSchema = z.enum([
  'intake',
  'reason',
  'review',
  'act',
  'observe',
]);
const agentDependencyStateSchema = z.enum(['ready', 'waiting', 'blocked']);
const agentAutonomyLevelSchema = z.enum(['autonomous', 'supervised', 'human_in_loop']);
const eventTypeSchema = z.enum([
  'listing_created',
  'order_placed',
  'message_sent',
  'agent_triggered',
  'tenant_created',
  'tenant_updated',
  'app_created',
  'app_updated',
  'user_created',
  'user_updated',
  'agent_action_requested',
  'model_switched',
  'agent_task_scheduled',
  'agent_run_updated',
  'workflow_aggregated',
  'research_collected',
  'research_schedule_triggered',
  'research_requested',
  'analysis_completed',
  'signal_detected',
  'recommendation_created',
  'agent_outcome_recorded',
  'search_performed',
]);
const graphNodeTypeSchema = z.enum([
  'user',
  'vendor',
  'category',
  'listing',
  'agent',
  'skill',
  'location',
]);
const graphEdgeCategorySchema = z.enum([
  'behavior',
  'supply',
  'location',
  'intelligence',
]);

const agentTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  status: agentTaskStatusSchema,
  priority: z.enum(['low', 'medium', 'high']),
  owner: z.string(),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  startedAt: z.string(),
  updatedAt: z.string(),
});

const agentDecisionSchema = z.object({
  id: z.string(),
  summary: z.string(),
  rationale: z.string(),
  confidence: z.number(),
  outcome: agentDecisionOutcomeSchema,
  timestamp: z.string(),
});

const agentLogSchema = z.object({
  id: z.string(),
  level: agentLogLevelSchema,
  source: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

const agentExecutionSchema = z.object({
  id: z.string(),
  workflowVersion: z.string(),
  status: agentExecutionStatusSchema,
  workflowId: z.string().optional(),
  taskId: z.string().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  costUsd: z.number(),
  outputSummary: z.string(),
});

const agentOrchestrationSchema = z.object({
  stage: agentOrchestrationStageSchema,
  lane: z.string(),
  dependencyState: agentDependencyStateSchema,
  priority: z.enum(['low', 'medium', 'high']),
  autonomyLevel: agentAutonomyLevelSchema,
  blockers: z.array(z.string()),
  upstreamAgentIds: z.array(z.string()),
  downstreamAgentIds: z.array(z.string()),
  stageEnteredAt: z.string(),
});

export const auditRecordSchema = z.object({
  id: z.string(),
  actor: z.string(),
  actorDisplay: z.string().optional(),
  action: z.union([
    agentActionSchema,
    z.literal('switch_model'),
    z.literal('tenant_create'),
    z.literal('tenant_update'),
    z.literal('app_create'),
    z.literal('app_update'),
    z.literal('user_create'),
    z.literal('user_update'),
    z.literal('client_error'),
    z.literal('tool_execute'),
    z.literal('orchestrator_schedule'),
    z.literal('orchestrator_update'),
    z.literal('orchestrator_aggregate'),
    z.literal('research_collect'),
    z.literal('research_schedule_create'),
    z.literal('research_schedule_run'),
    z.literal('research_agent_execute'),
    z.literal('research_agent_trigger_create'),
    z.literal('research_agent_trigger_run'),
    z.literal('insight_agent_execute'),
    z.literal('insight_agent_process_events'),
    z.literal('recommendation_agent_execute'),
    z.literal('agent_outcome_recorded'),
  ]),
  resourceType: z.enum(['agent', 'model', 'tenant', 'app', 'user', 'system', 'tool', 'workflow', 'research', 'signal', 'recommendation']),
  resourceId: z.string(),
  timestamp: z.string(),
  tenantId: z.string().nullable().optional(),
  appId: z.string().nullable().optional(),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const adminHeadersSchema = z.object({
  authorization: z.string().min(1),
  'x-tenant-id': z.string().min(1),
  'x-app-id': z.string().min(1),
  'x-user-id': z.string().min(1),
  'x-user-roles': z.string().min(1),
});

export const overviewResponseSchema = z.object({
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string(),
      trend: z.enum(['up', 'down', 'flat']),
      description: z.string(),
    }),
  ),
  alerts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      severity: riskLevelSchema,
      source: z.string(),
      summary: z.string(),
    }),
  ),
  queueBacklog: z.number(),
  runningAgents: z.number(),
  healthyServices: z.number(),
  liveEventsPerMinute: z.number(),
});

export const tenantListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tier: z.enum(['starter', 'growth', 'enterprise']),
      status: statusSchema,
      region: z.string(),
      apps: z.number(),
      users: z.number(),
      monthlySpendUsd: z.number(),
      eventQuotaDaily: z.number(),
    }),
  ),
});

export const tenantRecordSchema = tenantListResponseSchema.shape.items.element;

export const tenantCreateRequestSchema = z.object({
  name: z.string().min(2),
  tier: z.enum(['starter', 'growth', 'enterprise']),
  status: statusSchema.default('healthy'),
  region: z.string().min(2),
  monthlySpendUsd: z.number().min(0).default(0),
  eventQuotaDaily: z.number().int().positive(),
});

export const tenantUpdateRequestSchema = tenantCreateRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Provide at least one tenant field to update.',
);

export const tenantMutationResponseSchema = z.object({
  ok: z.literal(true),
  item: tenantRecordSchema,
});

export const appListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tenantId: z.string(),
      name: z.string(),
      runtime: z.enum(['pwa', 'flutter', 'admin', 'api']),
      environment: z.enum(['production', 'staging', 'development']),
      status: statusSchema,
      region: z.string(),
      agentsAttached: z.number(),
    }),
  ),
});

export const appRecordSchema = appListResponseSchema.shape.items.element;

export const appCreateRequestSchema = z.object({
  tenantId: z.string().min(1),
  name: z.string().min(2),
  runtime: z.enum(['pwa', 'flutter', 'admin', 'api']),
  environment: z.enum(['production', 'staging', 'development']),
  status: statusSchema.default('healthy'),
  region: z.string().min(2),
  agentsAttached: z.number().int().min(0).default(0),
});

export const appUpdateRequestSchema = appCreateRequestSchema.omit({ tenantId: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  'Provide at least one app field to update.',
);

export const appMutationResponseSchema = z.object({
  ok: z.literal(true),
  item: appRecordSchema,
});

export const userListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tenantId: z.string(),
      appId: z.string(),
      name: z.string(),
      role: roleSchema,
      status: z.enum(['active', 'invited', 'suspended']),
      lastSeenAt: z.string(),
    }),
  ),
});

export const userRecordSchema = userListResponseSchema.shape.items.element;

export const userCreateRequestSchema = z.object({
  tenantId: z.string().min(1),
  appId: z.string().min(1),
  name: z.string().min(2),
  role: roleSchema,
  status: z.enum(['active', 'invited', 'suspended']).default('invited'),
});

export const userUpdateRequestSchema = userCreateRequestSchema
  .omit({ tenantId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one user field to update.');

export const userMutationResponseSchema = z.object({
  ok: z.literal(true),
  item: userRecordSchema,
});

export const paginationInfoSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(1),
  currentCursor: z.string().optional(),
  nextCursor: z.string().optional(),
  previousCursor: z.string().optional(),
  hasNextPage: z.boolean().optional(),
  hasPreviousPage: z.boolean().optional(),
});

export const auditListResponseSchema = z.object({
  items: z.array(auditRecordSchema),
});

export const auditPageResponseSchema = auditListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const tenantPageResponseSchema = tenantListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const appPageResponseSchema = appListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const userPageResponseSchema = userListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const agentListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tenantId: z.string(),
      appId: z.string(),
      name: z.string(),
      state: agentStateSchema,
      queue: z.string(),
      queueDepth: z.number(),
      budgetUsd: z.number(),
      budgetUtilizationPercent: z.number(),
      avgLatencyMs: z.number(),
      tokenUsage1h: z.number(),
      decisionsToday: z.number(),
      workflowVersion: z.string(),
      lastTask: z.string(),
      lastHeartbeatAt: z.string(),
      orchestration: agentOrchestrationSchema,
      tasks: z.array(agentTaskSchema),
      decisions: z.array(agentDecisionSchema),
      logs: z.array(agentLogSchema),
      executionHistory: z.array(agentExecutionSchema),
    }),
  ),
});

export const agentPageResponseSchema = agentListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const agentRecordSchema = agentListResponseSchema.shape.items.element;

export const agentActionRequestSchema = z.object({
  action: agentActionSchema,
  budgetUsd: z.number().optional(),
  workflowVersion: z.string().optional(),
  stage: agentOrchestrationStageSchema.optional(),
  lane: z.string().optional(),
  currentStage: agentOrchestrationStageSchema.optional(),
  dependencyState: agentDependencyStateSchema.optional(),
});

export const agentActionResponseSchema = z.object({
  ok: z.literal(true),
  agent: agentRecordSchema,
  audit: auditRecordSchema,
});

const orchestratorWorkflowStatusSchema = z.enum(['queued', 'running', 'waiting_review', 'completed', 'failed']);
const orchestratorWorkflowOutcomeSchema = z.enum(['success', 'warning', 'failed']);
const researchSourceSchema = z.enum(['rss', 'market_api', 'web_page', 'platform_activity']);
const researchRunStatusSchema = z.enum(['completed', 'degraded', 'failed']);
const researchScheduleStatusSchema = z.enum(['active', 'paused']);
const researchAgentTriggerTypeSchema = z.enum(['schedule', 'event']);
const researchAgentRunTriggerSchema = z.enum(['manual', 'schedule', 'event']);
const insightRunStatusSchema = z.enum(['completed', 'degraded', 'failed']);
const insightAgentRunTriggerSchema = z.enum(['manual', 'event']);
const marketSignalDirectionSchema = z.enum(['up', 'down', 'neutral']);
const recommendationRunStatusSchema = z.enum(['completed', 'degraded', 'failed']);
const recommendationCategorySchema = z.enum(['research_lead', 'prioritized_action', 'workflow_suggestion']);
const agentOutcomeStatusSchema = z.enum(['success', 'warning', 'failed', 'blocked']);
const agentOutcomeSourceSchema = z.enum(['manual', 'recommendation', 'research', 'insight', 'workflow']);
const agentPerformanceTrendSchema = z.enum(['up', 'flat', 'down']);

export const orchestratorParticipantSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  executionId: z.string(),
  status: orchestratorWorkflowStatusSchema,
  outputSummary: z.string().optional(),
  updatedAt: z.string(),
});

export const orchestratorWorkflowRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  title: z.string(),
  summary: z.string(),
  status: orchestratorWorkflowStatusSchema,
  priority: z.enum(['low', 'medium', 'high']),
  owner: z.string(),
  stage: agentOrchestrationStageSchema,
  lane: z.string(),
  participants: z.array(orchestratorParticipantSchema),
  aggregationSummary: z.string().optional(),
  outcome: orchestratorWorkflowOutcomeSchema.optional(),
  recommendations: z.array(z.string()),
  metadata: z.record(z.string(), z.any()),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
});

export const orchestratorWorkflowListResponseSchema = z.object({
  items: z.array(orchestratorWorkflowRecordSchema),
});

export const orchestratorScheduleRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(400),
  agentIds: z.array(z.string().trim().min(1)).min(1).max(6),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  owner: z.string().trim().min(1).max(80).optional(),
  stage: agentOrchestrationStageSchema.optional(),
  lane: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.string(), z.any()).default({}),
});

export const orchestratorLifecycleRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  taskStatus: orchestratorWorkflowStatusSchema,
  executionStatus: agentExecutionStatusSchema.optional(),
  stage: agentOrchestrationStageSchema.optional(),
  lane: z.string().trim().min(1).max(80).optional(),
  blocker: z.string().trim().min(1).max(180).optional(),
  outputSummary: z.string().trim().min(1).max(300).optional(),
  costUsd: z.number().min(0).max(1000).optional(),
});

export const orchestratorAggregateRequestSchema = z.object({
  outcome: orchestratorWorkflowOutcomeSchema,
  summary: z.string().trim().min(1).max(500),
  recommendations: z.array(z.string().trim().min(1).max(180)).max(8).default([]),
});

export const orchestratorWorkflowMutationResponseSchema = z.object({
  item: orchestratorWorkflowRecordSchema,
  agents: z.array(agentRecordSchema),
  audit: auditRecordSchema,
});

export const researchRunRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  source: researchSourceSchema,
  query: z.string(),
  sourceUri: z.string().optional(),
  scheduleId: z.string().optional(),
  status: researchRunStatusSchema,
  provider: z.string(),
  degraded: z.boolean(),
  summary: z.string(),
  documentsCreated: z.number().int().nonnegative(),
  embeddingsCreated: z.number().int().nonnegative(),
  itemsCollected: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const researchScheduleRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  name: z.string(),
  source: researchSourceSchema,
  query: z.string(),
  sourceUri: z.string().optional(),
  intervalMinutes: z.number().int().positive(),
  limit: z.number().int().positive(),
  persist: z.boolean(),
  status: researchScheduleStatusSchema,
  nextRunAt: z.string(),
  lastRunAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const researchCollectRequestSchema = z.object({
  source: researchSourceSchema,
  query: z.string().trim().min(1).max(180),
  sourceUri: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(6).default(3),
  persist: z.boolean().default(true),
  scheduleId: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const researchRunListResponseSchema = z.object({
  items: z.array(researchRunRecordSchema),
});

export const researchCollectResponseSchema = z.object({
  item: researchRunRecordSchema,
  audit: auditRecordSchema,
});

export const researchScheduleCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  source: researchSourceSchema,
  query: z.string().trim().min(1).max(180),
  sourceUri: z.string().trim().max(500).optional(),
  intervalMinutes: z.coerce.number().int().min(15).max(10_080).default(60),
  limit: z.coerce.number().int().min(1).max(6).default(3),
  persist: z.boolean().default(true),
  status: researchScheduleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const researchScheduleListResponseSchema = z.object({
  items: z.array(researchScheduleRecordSchema),
});

export const researchScheduleMutationResponseSchema = z.object({
  item: researchScheduleRecordSchema,
  audit: auditRecordSchema,
});

export const researchRunDueResponseSchema = z.object({
  items: z.array(researchRunRecordSchema),
});

export const researchAgentRunRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  researchRunId: z.string().optional(),
  trigger: researchAgentRunTriggerSchema,
  triggerId: z.string().optional(),
  eventId: z.string().optional(),
  source: researchSourceSchema,
  query: z.string(),
  sourceUri: z.string().optional(),
  status: researchRunStatusSchema,
  taskId: z.string(),
  executionId: z.string(),
  summary: z.string(),
  documentsCreated: z.number().int().nonnegative(),
  embeddingsCreated: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const researchAgentTriggerRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  name: z.string(),
  triggerType: researchAgentTriggerTypeSchema,
  source: researchSourceSchema,
  query: z.string(),
  sourceUri: z.string().optional(),
  intervalMinutes: z.number().int().positive().optional(),
  eventTypes: z.array(eventTypeSchema).optional(),
  limit: z.number().int().positive(),
  persist: z.boolean(),
  status: researchScheduleStatusSchema,
  nextRunAt: z.string().optional(),
  lastRunAt: z.string().optional(),
  lastEventAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const researchAgentExecuteRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  source: researchSourceSchema,
  query: z.string().trim().min(1).max(180),
  sourceUri: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(6).default(3),
  persist: z.boolean().default(true),
  triggerId: z.string().trim().min(1).max(120).optional(),
  eventId: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const researchAgentRunListResponseSchema = z.object({
  items: z.array(researchAgentRunRecordSchema),
});

export const researchAgentExecuteResponseSchema = z.object({
  item: researchAgentRunRecordSchema,
  agent: agentRecordSchema,
  researchRun: researchRunRecordSchema.optional(),
  audit: auditRecordSchema,
});

export const researchAgentTriggerCreateRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  triggerType: researchAgentTriggerTypeSchema,
  source: researchSourceSchema,
  query: z.string().trim().min(1).max(180),
  sourceUri: z.string().trim().max(500).optional(),
  intervalMinutes: z.coerce.number().int().min(15).max(10_080).optional(),
  eventTypes: z.array(eventTypeSchema).min(1).max(8).optional(),
  limit: z.coerce.number().int().min(1).max(6).default(3),
  persist: z.boolean().default(true),
  status: researchScheduleStatusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
}).superRefine((value, ctx) => {
  if (value.triggerType === 'schedule' && !value.intervalMinutes) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['intervalMinutes'], message: 'intervalMinutes is required for schedule triggers.' });
  }
  if (value.triggerType === 'event' && (!value.eventTypes || value.eventTypes.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['eventTypes'], message: 'eventTypes is required for event triggers.' });
  }
});

export const researchAgentTriggerListResponseSchema = z.object({
  items: z.array(researchAgentTriggerRecordSchema),
});

export const researchAgentTriggerMutationResponseSchema = z.object({
  item: researchAgentTriggerRecordSchema,
  audit: auditRecordSchema,
});

export const researchAgentTriggerRunResponseSchema = z.object({
  items: z.array(researchAgentRunRecordSchema),
});

export const marketSignalRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  signalType: z.string(),
  subject: z.string(),
  direction: marketSignalDirectionSchema,
  strength: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  detectedAt: z.string(),
});

export const marketSignalListResponseSchema = z.object({
  items: z.array(marketSignalRecordSchema),
});

export const insightAgentRunRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  trigger: insightAgentRunTriggerSchema,
  status: insightRunStatusSchema,
  taskId: z.string(),
  executionId: z.string(),
  summary: z.string(),
  signalCount: z.number().int().nonnegative(),
  marketSignalIds: z.array(z.string()),
  eventCount: z.number().int().nonnegative(),
  usagePatternCount: z.number().int().nonnegative(),
  researchRunCount: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const insightAgentExecuteRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  eventTypes: z.array(eventTypeSchema).max(8).optional(),
  eventLimit: z.coerce.number().int().min(1).max(50).default(20),
  usageLimit: z.coerce.number().int().min(1).max(30).default(10),
  researchLimit: z.coerce.number().int().min(0).max(20).default(5),
  signalLimit: z.coerce.number().int().min(1).max(6).default(3),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const insightAgentRunListResponseSchema = z.object({
  items: z.array(insightAgentRunRecordSchema),
});

export const insightAgentExecuteResponseSchema = z.object({
  item: insightAgentRunRecordSchema,
  agent: agentRecordSchema,
  signals: z.array(marketSignalRecordSchema),
  audit: auditRecordSchema,
});

export const insightAgentProcessEventsResponseSchema = z.object({
  items: z.array(insightAgentRunRecordSchema),
});

export const recommendationRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  agentId: z.string(),
  category: recommendationCategorySchema,
  priority: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  summary: z.string(),
  rationale: z.array(z.string()).max(6).default([]),
  confidence: z.number().min(0).max(1),
  sourceSignalIds: z.array(z.string()),
  relatedNodeIds: z.array(z.string()),
  relatedDocumentIds: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const recommendationListResponseSchema = z.object({
  items: z.array(recommendationRecordSchema),
});

export const recommendationAgentRunRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  status: recommendationRunStatusSchema,
  taskId: z.string(),
  executionId: z.string(),
  summary: z.string(),
  recommendationCount: z.number().int().nonnegative(),
  signalCount: z.number().int().nonnegative(),
  graphContextCount: z.number().int().nonnegative(),
  behaviorPatternCount: z.number().int().nonnegative(),
  documentMatchCount: z.number().int().nonnegative(),
  recommendationIds: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const recommendationAgentExecuteRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  query: z.string().trim().min(1).max(200).optional(),
  signalLimit: z.coerce.number().int().min(1).max(10).default(5),
  behaviorLimit: z.coerce.number().int().min(1).max(20).default(8),
  documentLimit: z.coerce.number().int().min(1).max(10).default(4),
  maxRecommendations: z.coerce.number().int().min(1).max(6).default(4),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const recommendationAgentRunListResponseSchema = z.object({
  items: z.array(recommendationAgentRunRecordSchema),
});

export const recommendationAgentExecuteResponseSchema = z.object({
  item: recommendationAgentRunRecordSchema,
  agent: agentRecordSchema,
  recommendations: z.array(recommendationRecordSchema),
  audit: auditRecordSchema,
});

export const agentOutcomeRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  source: agentOutcomeSourceSchema,
  status: agentOutcomeStatusSchema,
  score: z.number().min(0).max(1),
  summary: z.string(),
  relatedRunId: z.string().optional(),
  relatedRecommendationId: z.string().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const agentOutcomeRecordRequestSchema = z.object({
  agentId: z.string().trim().min(1),
  source: agentOutcomeSourceSchema.default('manual'),
  status: agentOutcomeStatusSchema,
  score: z.coerce.number().min(0).max(1),
  summary: z.string().trim().min(1).max(240),
  relatedRunId: z.string().trim().min(1).max(120).optional(),
  relatedRecommendationId: z.string().trim().min(1).max(120).optional(),
  latencyMs: z.coerce.number().int().min(0).optional(),
  costUsd: z.coerce.number().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const agentOutcomeListResponseSchema = z.object({
  items: z.array(agentOutcomeRecordSchema),
});

export const agentPerformanceRecordSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  tenantId: z.string(),
  appId: z.string(),
  evaluationWindow: z.string(),
  successRate: z.number().min(0).max(1),
  avgLatencyMs: z.number().nonnegative(),
  avgCostUsd: z.number().nonnegative(),
  taskCount: z.number().int().nonnegative(),
  feedbackScore: z.number().min(0).max(1),
  improvementDelta: z.number(),
  trend: agentPerformanceTrendSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  recordedAt: z.string(),
});

export const agentPerformanceListResponseSchema = z.object({
  items: z.array(agentPerformanceRecordSchema),
  summary: z.object({
    totalOutcomes: z.number().int().nonnegative(),
    averageSuccessRate: z.number().min(0).max(1),
    averageFeedbackScore: z.number().min(0).max(1),
    improvingAgents: z.number().int().nonnegative(),
    topPerformers: z.array(agentPerformanceRecordSchema).max(5),
  }),
});

export const agentOutcomeMutationResponseSchema = z.object({
  item: agentOutcomeRecordSchema,
  performance: agentPerformanceRecordSchema,
  audit: auditRecordSchema,
});

const toolNameSchema = z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/);
const toolExecutionModeSchema = z.enum(['read', 'compute', 'analyze']);
const toolExecutionStatusSchema = z.enum(['completed', 'blocked', 'failed']);

export const toolRecordSchema = z.object({
  name: toolNameSchema,
  description: z.string(),
  schema: z.array(z.string()),
  permissions: z.array(permissionSchema),
  riskLevel: riskLevelSchema,
  executionMode: toolExecutionModeSchema,
  safetyGuards: z.array(z.string()),
  usageToday: z.number(),
  p95Ms: z.number(),
  errorRate: z.number(),
});

export const toolListResponseSchema = z.object({
  items: z.array(toolRecordSchema),
});

export const toolPageResponseSchema = toolListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const toolExecuteRequestSchema = z.object({
  tool: toolNameSchema,
  input: z.record(z.string(), z.any()).default({}),
});

export const toolExecutionRecordSchema = z.object({
  id: z.string(),
  tool: toolNameSchema,
  actor: z.string(),
  tenantId: z.string().nullable().optional(),
  appId: z.string().nullable().optional(),
  status: toolExecutionStatusSchema,
  riskLevel: riskLevelSchema,
  executionMode: toolExecutionModeSchema,
  permissions: z.array(permissionSchema),
  safetyGuards: z.array(z.string()),
  durationMs: z.number().int().nonnegative(),
  summary: z.string(),
  inputPreview: z.string(),
  outputPreview: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
});

export const toolExecutionListResponseSchema = z.object({
  items: z.array(toolExecutionRecordSchema),
});

export const toolExecuteResponseSchema = z.object({
  item: toolExecutionRecordSchema,
  result: z.object({
    summary: z.string(),
    payload: z.record(z.string(), z.any()),
  }).nullable(),
});

export const modelListResponseSchema = z.object({
  items: z.array(
    z.object({
      key: z.enum(['planner', 'sql', 'agent', 'embedding']),
      service: z.string(),
      activeModel: z.string(),
      provider: z.string(),
      fallbackModel: z.string(),
      latencyMs: z.number(),
      tokenUsage1h: z.number(),
      errorRate: z.number(),
      candidates: z.array(z.string()),
    }),
  ),
});

export const modelRecordSchema = modelListResponseSchema.shape.items.element;

export const modelSwitchRequestSchema = z.object({
  key: z.enum(['planner', 'sql', 'agent', 'embedding']),
  targetModel: z.string().min(1),
});

export const modelSwitchResponseSchema = z.object({
  ok: z.literal(true),
  model: modelRecordSchema,
  audit: auditRecordSchema,
});

export const memoryListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      scope: z.enum(['tenant', 'app', 'agent']),
      tenantId: z.string(),
      appId: z.string(),
      records: z.number(),
      vectorCount: z.number(),
      lastCompactionAt: z.string(),
    }),
  ),
});

export const memoryPageResponseSchema = memoryListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const knowledgeGraphResponseSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: graphNodeTypeSchema,
      label: z.string(),
      metadata: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      score: z.number(),
      health: statusSchema,
      tenantId: z.string().optional(),
      appId: z.string().optional(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string(),
      category: graphEdgeCategorySchema,
      strength: z.number(),
      evidenceCount: z.number(),
    }),
  ),
});

export const eventListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tenantId: z.string(),
      appId: z.string(),
      type: eventTypeSchema,
      actor: z.string(),
      summary: z.string(),
      timestamp: z.string(),
    }),
  ),
});

export const eventPageResponseSchema = eventListResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const analyticsResponseSchema = z.object({
  kpis: z.array(z.object({ label: z.string(), value: z.string(), change: z.string() })),
  tenantGrowth: z.array(z.object({ label: z.string(), value: z.number() })),
  toolUsageByDomain: z.array(z.object({ label: z.string(), value: z.number() })),
});

const serviceMetricThresholdSchema = z.object({
  degraded: z.number().nonnegative().optional(),
  critical: z.number().nonnegative().optional(),
});

const serviceAlertThresholdsSchema = z.object({
  cpuPercent: serviceMetricThresholdSchema.optional(),
  memoryPercent: serviceMetricThresholdSchema.optional(),
  restarts24h: serviceMetricThresholdSchema.optional(),
});

const serviceThresholdAlertSchema = z.object({
  metric: z.enum(['cpuPercent', 'memoryPercent', 'restarts24h']),
  severity: z.enum(['degraded', 'critical']),
  actualValue: z.number(),
  thresholdValue: z.number(),
});

export const observabilityResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      layer: z.enum(['edge', 'orchestration', 'observability']),
      status: statusSchema,
      cpuPercent: z.number(),
      memoryPercent: z.number(),
      restarts24h: z.number(),
      endpoint: z.string(),
      thresholds: serviceAlertThresholdsSchema.optional(),
      alerts: z.array(serviceThresholdAlertSchema).default([]),
    }),
  ),
  clientErrors: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['boundary', 'window-error', 'unhandledrejection']),
      source: z.string(),
      message: z.string(),
      name: z.string(),
      pathname: z.string().nullable(),
      digest: z.string().nullable(),
      occurredAt: z.string(),
      tenantId: z.string().nullable(),
      appId: z.string().nullable(),
      userId: z.string().nullable(),
    }),
  ).default([]),
});

export const observabilityPageResponseSchema = observabilityResponseSchema.extend({
  pageInfo: paginationInfoSchema,
});

export const assistantToolCallSchema = z.object({
  tool: assistantToolNameSchema,
  permission: permissionSchema,
  status: z.enum(['completed', 'blocked', 'failed']),
  summary: z.string(),
});

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
  toolCalls: z.array(assistantToolCallSchema).default([]),
});

export const reasoningModeSchema = z.enum(['summarize', 'plan', 'decide']);

export const reasoningIntentSchema = z.enum([
  'overview',
  'analytics',
  'throttled_agents',
  'supply_gaps',
  'observability',
  'events',
  'memory',
  'models',
  'tooling',
]);

export const reasoningProviderSchema = z.object({
  name: z.enum(['local-rules', 'ollama']),
  model: z.string(),
  remoteEnabled: z.boolean().default(false),
});

export const reasoningActionSchema = z.object({
  title: z.string(),
  detail: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
});

export const reasoningDecisionSchema = z.object({
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string()).max(6).default([]),
});

export const reasoningStructuredOutputSchema = z.object({
  objective: z.string(),
  findings: z.array(z.string()).max(6).default([]),
  risks: z.array(z.string()).max(6).default([]),
  actions: z.array(reasoningActionSchema).max(5).default([]),
  decision: reasoningDecisionSchema.optional(),
});

export const memoryPreferenceSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  sampleCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const memoryConversationTurnSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  sessionId: z.string(),
  tenantId: z.string().nullable(),
  appId: z.string().nullable(),
  userId: z.string(),
  pathname: z.string().optional(),
  userMessage: z.string(),
  assistantMessage: z.string(),
  toolCalls: z.array(assistantToolCallSchema).default([]),
  createdAt: z.string(),
});

export const memoryAgentExperienceSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  outcome: z.enum(['success', 'warning', 'failed', 'blocked']),
  summary: z.string(),
  sampleCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const memoryContextItemSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  sourceType: z.string(),
  title: z.string(),
  snippet: z.string(),
  score: z.number(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
});

export const memoryContextSchema = z.object({
  summary: z.string().default(''),
  items: z.array(memoryContextItemSchema).max(6).default([]),
  preferences: z.array(memoryPreferenceSchema).max(6).default([]),
  conversation: z.array(memoryConversationTurnSchema).max(6).default([]),
  agentExperiences: z.array(memoryAgentExperienceSchema).max(6).default([]),
});

export const memoryConversationWriteRequestSchema = z.object({
  sessionId: z.string().trim().min(1).max(200),
  pathname: z.string().max(200).optional(),
  userMessage: z.string().trim().min(1).max(2000),
  assistantMessage: z.string().trim().min(1).max(8000),
  toolCalls: z.array(assistantToolCallSchema).max(10).default([]),
});

export const memoryConversationListResponseSchema = z.object({
  items: z.array(memoryConversationTurnSchema),
});

export const memoryPreferenceWriteRequestSchema = z.object({
  items: z.array(z.object({ key: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(200) })).min(1).max(10),
});

export const memoryPreferenceListResponseSchema = z.object({
  items: z.array(memoryPreferenceSchema),
});

export const memoryAgentExperienceWriteRequestSchema = z.object({
  agentId: z.string().trim().min(1).max(120),
  outcome: z.enum(['success', 'warning', 'failed', 'blocked']),
  summary: z.string().trim().min(1).max(500),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const memoryAgentExperienceResponseSchema = z.object({
  item: memoryAgentExperienceSchema,
});

export const memoryRetrieveRequestSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  sessionId: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(6).default(4),
  conversationLimit: z.coerce.number().int().min(1).max(6).default(3),
});

export const memoryRetrieveResponseSchema = memoryContextSchema;

export const reasoningEngineRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(assistantMessageSchema).max(20).default([]),
  pathname: z.string().max(200).optional(),
  memoryContext: memoryContextSchema.optional(),
  route: z.enum(['recommend', 'analyze', 'research']).optional(),
  mode: reasoningModeSchema.default('summarize'),
  intent: reasoningIntentSchema.optional(),
  maxActions: z.coerce.number().int().min(1).max(5).optional(),
});

export const reasoningEngineResponseSchema = z.object({
  mode: reasoningModeSchema,
  intent: reasoningIntentSchema,
  provider: reasoningProviderSchema,
  content: z.string(),
  structuredOutput: reasoningStructuredOutputSchema,
  toolCalls: z.array(assistantToolCallSchema).default([]),
  degraded: z.boolean().default(false),
});

export const aiGatewayRouteSchema = z.enum(['recommend', 'analyze', 'research', 'command']);

export const aiGatewayPromptTemplateSchema = z.enum([
  'operator_recommendations_v1',
  'control_plane_analysis_v1',
  'supply_gap_research_v1',
  'control_plane_commands_v1',
]);

export const controlPlaneCommandSchema = z.object({
  intent: z.string(),
  mode: z.enum(['read', 'act']),
  targetAgentId: z.string().optional(),
  executedActions: z.array(z.string()).max(6).default([]),
  dryRun: z.boolean().default(false),
});

export const aiGatewayRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(assistantMessageSchema).max(20).default([]),
  pathname: z.string().max(200).optional(),
  memoryContext: memoryContextSchema.optional(),
  maxRecommendations: z.coerce.number().int().min(1).max(5).optional(),
});

export const aiGatewayResponseSchema = z.object({
  route: aiGatewayRouteSchema,
  promptTemplate: aiGatewayPromptTemplateSchema,
  message: assistantMessageSchema,
  suggestions: z.array(z.string()).max(6).default([]),
  reasoning: reasoningEngineResponseSchema.optional(),
  command: controlPlaneCommandSchema.optional(),
  degraded: z.boolean().default(false),
  guardrails: z.object({
    concurrency: z.object({
      limit: z.number().int().positive(),
      inFlight: z.number().int().nonnegative(),
    }),
    budget: z.object({
      estimatedUnits: z.number().int().positive(),
      remainingUnits: z.number().int().nonnegative(),
      windowStartedAt: z.string(),
    }),
  }),
});

export const aiRecommendRequestSchema = aiGatewayRequestSchema;
export const aiAnalyzeRequestSchema = aiGatewayRequestSchema;
export const aiResearchRequestSchema = aiGatewayRequestSchema;

export const embeddingModelSchema = z.enum(['bge-small-en-v1.5', 'gte-small']);

export const embeddingProviderSchema = z.object({
  name: z.enum(['local-hash', 'ollama']),
  model: embeddingModelSchema,
  dimensions: z.number().int().positive(),
  remoteEnabled: z.boolean().default(false),
});

export const embedInputSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  title: z.string().trim().min(1).max(200).optional(),
  sourceType: z.enum(['inline', 'research_note', 'event', 'agent_note', 'query', 'document']).default('inline'),
  sourceUri: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const embedRequestSchema = z.object({
  items: z.array(embedInputSchema).min(1).max(10),
  persist: z.boolean().default(true),
  chunkSize: z.coerce.number().int().min(80).max(2_000).default(480),
  overlap: z.coerce.number().int().min(0).max(400).default(80),
  model: embeddingModelSchema.optional(),
});

export const embeddedDocumentSchema = z.object({
  id: z.string(),
  tenantId: z.string().nullable(),
  appId: z.string().nullable(),
  sourceType: z.string(),
  sourceUri: z.string(),
  title: z.string(),
  checksum: z.string(),
  chunkCount: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()),
});

export const embeddedChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  chunkText: z.string(),
  embeddingModel: embeddingModelSchema,
  embeddingDimensions: z.number().int().positive(),
  embeddingVector: z.array(z.number()),
  metadata: z.record(z.string(), z.unknown()),
});

export const embedResponseSchema = z.object({
  provider: embeddingProviderSchema,
  persisted: z.boolean(),
  documents: z.array(embeddedDocumentSchema),
  embeddings: z.array(embeddedChunkSchema),
  stats: z.object({
    documentsCreated: z.number().int().nonnegative(),
    embeddingsCreated: z.number().int().nonnegative(),
    totalCharacters: z.number().int().nonnegative(),
    totalChunks: z.number().int().nonnegative(),
  }),
  degraded: z.boolean().default(false),
});

export const systemResponseSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(
        z.object({
          key: z.string(),
          value: z.string(),
          description: z.string(),
        }),
      ),
    }),
  ),
});
