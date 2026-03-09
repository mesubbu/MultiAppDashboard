export type PlatformRole =
  | 'platform_owner'
  | 'platform_admin'
  | 'tenant_admin'
  | 'ops_admin'
  | 'analyst'
  | 'viewer';

export type Permission =
  | 'tenants:read'
  | 'tenants:write'
  | 'apps:read'
  | 'apps:write'
  | 'users:read'
  | 'users:write'
  | 'agents:read'
  | 'agents:operate'
  | 'tools:read'
  | 'models:read'
  | 'models:switch'
  | 'research:read'
  | 'research:operate'
  | 'memory:read'
  | 'graph:read'
  | 'events:read'
  | 'analytics:read'
  | 'observability:read'
  | 'audit:read'
  | 'system:write';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ToolExecutionMode = 'read' | 'compute' | 'analyze';
export type ToolExecutionStatus = 'completed' | 'blocked' | 'failed';
export type AgentState = 'running' | 'paused' | 'throttled' | 'error';
export type OrchestratorWorkflowStatus = 'queued' | 'running' | 'waiting_review' | 'completed' | 'failed';
export type OrchestratorWorkflowOutcome = 'success' | 'warning' | 'failed';
export type ResearchSource = 'rss' | 'market_api' | 'web_page' | 'platform_activity';
export type ResearchRunStatus = 'completed' | 'degraded' | 'failed';
export type ResearchScheduleStatus = 'active' | 'paused';
export type ResearchAgentTriggerType = 'schedule' | 'event';
export type ResearchAgentRunTrigger = 'manual' | 'schedule' | 'event';
export type InsightRunStatus = 'completed' | 'degraded' | 'failed';
export type InsightAgentRunTrigger = 'manual' | 'event';
export type MarketSignalDirection = 'up' | 'down' | 'neutral';
export type RecommendationRunStatus = 'completed' | 'degraded' | 'failed';
export type RecommendationCategory = 'research_lead' | 'prioritized_action' | 'workflow_suggestion';
export type AgentOutcomeStatus = 'success' | 'warning' | 'failed' | 'blocked';
export type AgentOutcomeSource = 'manual' | 'recommendation' | 'research' | 'insight' | 'workflow';
export type AgentPerformanceTrend = 'up' | 'flat' | 'down';
export type AgentTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_review'
  | 'completed'
  | 'failed';
export type AgentLogLevel = 'info' | 'warn' | 'error';
export type AgentExecutionStatus = 'running' | 'success' | 'warning' | 'failed';
export type AgentDecisionOutcome = 'approved' | 'blocked' | 'rerouted' | 'flagged';
export type AgentActionName =
  | 'pause'
  | 'restart'
  | 'update_budget'
  | 'update_workflow'
  | 'move_stage'
  | 'retry_queue'
  | 'unblock'
  | 'reroute';
export type AgentOrchestrationStage =
  | 'intake'
  | 'reason'
  | 'review'
  | 'act'
  | 'observe';
export type AgentDependencyState = 'ready' | 'waiting' | 'blocked';
export type AgentAutonomyLevel = 'autonomous' | 'supervised' | 'human_in_loop';
export type EventType =
  | 'listing_created'
  | 'order_placed'
  | 'message_sent'
  | 'agent_triggered'
  | 'tenant_created'
  | 'tenant_updated'
  | 'app_created'
  | 'app_updated'
  | 'user_created'
  | 'user_updated'
  | 'agent_action_requested'
  | 'model_switched'
  | 'agent_task_scheduled'
  | 'agent_run_updated'
  | 'workflow_aggregated'
  | 'research_collected'
  | 'research_schedule_triggered'
  | 'research_requested'
  | 'analysis_completed'
  | 'signal_detected'
  | 'recommendation_created'
  | 'agent_outcome_recorded'
  | 'search_performed';
export type GraphNodeType =
  | 'user'
  | 'vendor'
  | 'category'
  | 'listing'
  | 'agent'
  | 'skill'
  | 'location';
export type GraphEdgeCategory =
  | 'behavior'
  | 'supply'
  | 'location'
  | 'intelligence';

export interface SessionUser {
  userId: string;
  tenantId: string;
  appId: string;
  name: string;
  email: string;
  roles: PlatformRole[];
}

export type AssistantToolName =
  | 'control.read.overview'
  | 'control.read.analytics'
  | 'control.read.agents'
  | 'control.read.tools'
  | 'control.read.knowledge-graph'
  | 'control.read.events'
  | 'control.read.observability'
  | 'control.read.memory'
  | 'control.read.models'
  | 'control.read.market-signals'
  | 'control.read.recommendations'
  | 'control.read.agent-performance'
  | 'control.run.research-agent'
  | 'control.run.insight-agent'
  | 'control.run.recommendation-agent'
  | 'control.write.feedback';

export type AssistantToolStatus = 'completed' | 'blocked' | 'failed';

export interface AssistantToolCall {
  tool: AssistantToolName;
  permission: Permission;
  status: AssistantToolStatus;
  summary: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolCalls: AssistantToolCall[];
}

export interface MemoryPreference {
  id: string;
  key: string;
  value: string;
  sampleCount: number;
  updatedAt: string;
}

export interface MemoryConversationTurn {
  id: string;
  documentId: string;
  sessionId: string;
  tenantId: string | null;
  appId: string | null;
  userId: string;
  pathname?: string;
  userMessage: string;
  assistantMessage: string;
  toolCalls: AssistantToolCall[];
  createdAt: string;
}

export interface MemoryAgentExperience {
  id: string;
  agentId: string;
  outcome: 'success' | 'warning' | 'failed' | 'blocked';
  summary: string;
  sampleCount: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface MemoryContextItem {
  id: string;
  documentId: string;
  sourceType: string;
  title: string;
  snippet: string;
  score: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryContext {
  summary: string;
  items: MemoryContextItem[];
  preferences: MemoryPreference[];
  conversation: MemoryConversationTurn[];
  agentExperiences: MemoryAgentExperience[];
}

export interface MetricCard {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'flat';
  description: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: RiskLevel;
  source: string;
  summary: string;
}

export interface PlatformOverview {
  metrics: MetricCard[];
  alerts: AlertItem[];
  queueBacklog: number;
  runningAgents: number;
  healthyServices: number;
  liveEventsPerMinute: number;
}

export interface TenantRecord {
  id: string;
  name: string;
  tier: 'starter' | 'growth' | 'enterprise';
  status: HealthStatus;
  region: string;
  apps: number;
  users: number;
  monthlySpendUsd: number;
  eventQuotaDaily: number;
}

export interface AppRecord {
  id: string;
  tenantId: string;
  name: string;
  runtime: 'pwa' | 'flutter' | 'admin' | 'api';
  environment: 'production' | 'staging' | 'development';
  status: HealthStatus;
  region: string;
  agentsAttached: number;
}

export interface UserRecord {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  role: PlatformRole;
  status: 'active' | 'invited' | 'suspended';
  lastSeenAt: string;
}

export interface AgentTaskRecord {
  id: string;
  title: string;
  summary: string;
  status: AgentTaskStatus;
  priority: 'low' | 'medium' | 'high';
  owner: string;
  workflowId?: string;
  executionId?: string;
  startedAt: string;
  updatedAt: string;
}

export interface AgentDecisionRecord {
  id: string;
  summary: string;
  rationale: string;
  confidence: number;
  outcome: AgentDecisionOutcome;
  timestamp: string;
}

export interface AgentLogRecord {
  id: string;
  level: AgentLogLevel;
  source: string;
  message: string;
  timestamp: string;
}

export interface AgentExecutionRecord {
  id: string;
  workflowVersion: string;
  status: AgentExecutionStatus;
  workflowId?: string;
  taskId?: string;
  startedAt: string;
  endedAt: string;
  costUsd: number;
  outputSummary: string;
}

export interface AuditRecord {
  id: string;
  actor: string;
  actorDisplay?: string;
  action:
    | AgentActionName
    | 'switch_model'
    | 'tenant_create'
    | 'tenant_update'
    | 'app_create'
    | 'app_update'
    | 'user_create'
    | 'user_update'
    | 'client_error'
    | 'tool_execute'
    | 'orchestrator_schedule'
    | 'orchestrator_update'
    | 'orchestrator_aggregate'
    | 'research_collect'
    | 'research_schedule_create'
    | 'research_schedule_run'
    | 'research_agent_execute'
    | 'research_agent_trigger_create'
    | 'research_agent_trigger_run'
    | 'insight_agent_execute'
    | 'insight_agent_process_events'
    | 'recommendation_agent_execute'
    | 'agent_outcome_recorded';
  resourceType: 'agent' | 'model' | 'tenant' | 'app' | 'user' | 'system' | 'tool' | 'workflow' | 'research' | 'signal' | 'recommendation';
  resourceId: string;
  timestamp: string;
  tenantId?: string | null;
  appId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentOrchestrationRecord {
  stage: AgentOrchestrationStage;
  lane: string;
  dependencyState: AgentDependencyState;
  priority: 'low' | 'medium' | 'high';
  autonomyLevel: AgentAutonomyLevel;
  blockers: string[];
  upstreamAgentIds: string[];
  downstreamAgentIds: string[];
  stageEnteredAt: string;
}

export interface AgentRecord {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  state: AgentState;
  queue: string;
  queueDepth: number;
  budgetUsd: number;
  budgetUtilizationPercent: number;
  avgLatencyMs: number;
  tokenUsage1h: number;
  decisionsToday: number;
  workflowVersion: string;
  lastTask: string;
  lastHeartbeatAt: string;
  orchestration: AgentOrchestrationRecord;
  tasks: AgentTaskRecord[];
  decisions: AgentDecisionRecord[];
  logs: AgentLogRecord[];
  executionHistory: AgentExecutionRecord[];
}

export interface OrchestratorParticipantRecord {
  agentId: string;
  taskId: string;
  executionId: string;
  status: OrchestratorWorkflowStatus;
  outputSummary?: string;
  updatedAt: string;
}

export interface OrchestratorWorkflowRecord {
  id: string;
  tenantId: string;
  appId: string;
  title: string;
  summary: string;
  status: OrchestratorWorkflowStatus;
  priority: 'low' | 'medium' | 'high';
  owner: string;
  stage: AgentOrchestrationStage;
  lane: string;
  participants: OrchestratorParticipantRecord[];
  aggregationSummary?: string;
  outcome?: OrchestratorWorkflowOutcome;
  recommendations: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ResearchRunRecord {
  id: string;
  tenantId: string;
  appId: string;
  source: ResearchSource;
  query: string;
  sourceUri?: string;
  scheduleId?: string;
  status: ResearchRunStatus;
  provider: string;
  degraded: boolean;
  summary: string;
  documentsCreated: number;
  embeddingsCreated: number;
  itemsCollected: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ResearchScheduleRecord {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  source: ResearchSource;
  query: string;
  sourceUri?: string;
  intervalMinutes: number;
  limit: number;
  persist: boolean;
  status: ResearchScheduleStatus;
  nextRunAt: string;
  lastRunAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchAgentRunRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  researchRunId?: string;
  trigger: ResearchAgentRunTrigger;
  triggerId?: string;
  eventId?: string;
  source: ResearchSource;
  query: string;
  sourceUri?: string;
  status: ResearchRunStatus;
  taskId: string;
  executionId: string;
  summary: string;
  documentsCreated: number;
  embeddingsCreated: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ResearchAgentTriggerRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  name: string;
  triggerType: ResearchAgentTriggerType;
  source: ResearchSource;
  query: string;
  sourceUri?: string;
  intervalMinutes?: number;
  eventTypes?: EventType[];
  limit: number;
  persist: boolean;
  status: ResearchScheduleStatus;
  nextRunAt?: string;
  lastRunAt?: string;
  lastEventAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketSignalRecord {
  id: string;
  tenantId: string;
  appId: string;
  signalType: string;
  subject: string;
  direction: MarketSignalDirection;
  strength: number;
  confidence: number;
  summary: string;
  metadata: Record<string, unknown>;
  detectedAt: string;
}

export interface InsightAgentRunRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  trigger: InsightAgentRunTrigger;
  status: InsightRunStatus;
  taskId: string;
  executionId: string;
  summary: string;
  signalCount: number;
  marketSignalIds: string[];
  eventCount: number;
  usagePatternCount: number;
  researchRunCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecommendationRecord {
  id: string;
  tenantId: string;
  appId: string;
  agentId: string;
  category: RecommendationCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  rationale: string[];
  confidence: number;
  sourceSignalIds: string[];
  relatedNodeIds: string[];
  relatedDocumentIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecommendationAgentRunRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  status: RecommendationRunStatus;
  taskId: string;
  executionId: string;
  summary: string;
  recommendationCount: number;
  signalCount: number;
  graphContextCount: number;
  behaviorPatternCount: number;
  documentMatchCount: number;
  recommendationIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentOutcomeRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  source: AgentOutcomeSource;
  status: AgentOutcomeStatus;
  score: number;
  summary: string;
  relatedRunId?: string;
  relatedRecommendationId?: string;
  latencyMs?: number;
  costUsd?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentPerformanceRecord {
  id: string;
  agentId: string;
  tenantId: string;
  appId: string;
  evaluationWindow: string;
  successRate: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  taskCount: number;
  feedbackScore: number;
  improvementDelta: number;
  trend: AgentPerformanceTrend;
  metadata: Record<string, unknown>;
  recordedAt: string;
}

export interface AgentImprovementSnapshot {
  totalOutcomes: number;
  averageSuccessRate: number;
  averageFeedbackScore: number;
  improvingAgents: number;
  topPerformers: AgentPerformanceRecord[];
}

export interface ToolRecord {
  name: string;
  description: string;
  schema: string[];
  permissions: Permission[];
  riskLevel: RiskLevel;
  executionMode: ToolExecutionMode;
  safetyGuards: string[];
  usageToday: number;
  p95Ms: number;
  errorRate: number;
}

export interface ToolExecutionRecord {
  id: string;
  tool: string;
  actor: string;
  tenantId?: string | null;
  appId?: string | null;
  status: ToolExecutionStatus;
  riskLevel: RiskLevel;
  executionMode: ToolExecutionMode;
  permissions: Permission[];
  safetyGuards: string[];
  durationMs: number;
  summary: string;
  inputPreview: string;
  outputPreview?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface ModelRecord {
  key: 'planner' | 'sql' | 'agent' | 'embedding';
  service: string;
  activeModel: string;
  provider: string;
  fallbackModel: string;
  latencyMs: number;
  tokenUsage1h: number;
  errorRate: number;
  candidates: string[];
}

export interface MemoryRecord {
  id: string;
  scope: 'tenant' | 'app' | 'agent';
  tenantId: string;
  appId: string;
  records: number;
  vectorCount: number;
  lastCompactionAt: string;
}

export interface GraphNodeRecord {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata: string;
  description: string;
  tags: string[];
  score: number;
  health: HealthStatus;
  tenantId?: string;
  appId?: string;
}

export interface GraphEdgeRecord {
  id: string;
  source: string;
  target: string;
  label: string;
  category: GraphEdgeCategory;
  strength: number;
  evidenceCount: number;
}

export interface PlatformEvent {
  id: string;
  tenantId: string;
  appId: string;
  type: EventType;
  actor: string;
  summary: string;
  timestamp: string;
}

export interface AnalyticsMetric {
  label: string;
  value: string;
  change: string;
}

export interface AnalyticsSeriesPoint {
  label: string;
  value: number;
}

export interface AnalyticsBundle {
  kpis: AnalyticsMetric[];
  tenantGrowth: AnalyticsSeriesPoint[];
  toolUsageByDomain: AnalyticsSeriesPoint[];
}

export interface ServiceHealth {
  name: string;
  layer: 'edge' | 'orchestration' | 'observability';
  status: HealthStatus;
  cpuPercent: number;
  memoryPercent: number;
  restarts24h: number;
  endpoint: string;
  thresholds?: ServiceAlertThresholds;
  alerts?: ServiceThresholdAlert[];
}

export type ServiceAlertMetric = 'cpuPercent' | 'memoryPercent' | 'restarts24h';

export interface ServiceMetricThreshold {
  degraded?: number;
  critical?: number;
}

export interface ServiceAlertThresholds {
  cpuPercent?: ServiceMetricThreshold;
  memoryPercent?: ServiceMetricThreshold;
  restarts24h?: ServiceMetricThreshold;
}

export interface ServiceThresholdAlert {
  metric: ServiceAlertMetric;
  severity: Exclude<HealthStatus, 'healthy'>;
  actualValue: number;
  thresholdValue: number;
}

export interface ClientErrorRecord {
  id: string;
  kind: 'boundary' | 'window-error' | 'unhandledrejection';
  source: string;
  message: string;
  name: string;
  pathname: string | null;
  digest: string | null;
  occurredAt: string;
  tenantId: string | null;
  appId: string | null;
  userId: string | null;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  currentCursor?: string;
  nextCursor?: string;
  previousCursor?: string;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}

export interface SystemSettingItem {
  key: string;
  value: string;
  description: string;
}

export interface SystemSettingSection {
  title: string;
  items: SystemSettingItem[];
}

export interface DashboardModuleDefinition {
  slug: string;
  title: string;
  description: string;
  pageLayout: string;
  components: string[];
  apiEndpoints: string[];
  databaseEntities: string[];
  keyInteractions: string[];
}
