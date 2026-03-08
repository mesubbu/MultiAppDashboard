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
  | 'users:read'
  | 'users:write'
  | 'agents:read'
  | 'agents:operate'
  | 'tools:read'
  | 'models:read'
  | 'models:switch'
  | 'memory:read'
  | 'graph:read'
  | 'events:read'
  | 'analytics:read'
  | 'observability:read'
  | 'system:write';

export type HealthStatus = 'healthy' | 'degraded' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AgentState = 'running' | 'paused' | 'throttled' | 'error';
export type EventType =
  | 'listing_created'
  | 'order_placed'
  | 'message_sent'
  | 'agent_triggered';
export type GraphNodeType =
  | 'user'
  | 'vendor'
  | 'category'
  | 'listing'
  | 'agent'
  | 'skill'
  | 'location';

export interface SessionUser {
  userId: string;
  tenantId: string;
  appId: string;
  name: string;
  email: string;
  roles: PlatformRole[];
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

export interface AgentRecord {
  id: string;
  tenantId: string;
  appId: string;
  name: string;
  state: AgentState;
  queue: string;
  budgetUsd: number;
  decisionsToday: number;
  workflowVersion: string;
  lastTask: string;
  lastHeartbeatAt: string;
}

export interface ToolRecord {
  name: string;
  schema: string[];
  permissions: Permission[];
  riskLevel: RiskLevel;
  usageToday: number;
  p95Ms: number;
  errorRate: number;
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
}

export interface GraphEdgeRecord {
  id: string;
  source: string;
  target: string;
  label: string;
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
