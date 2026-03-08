import type {
  AgentRecord,
  AnalyticsBundle,
  AppRecord,
  MemoryRecord,
  ModelRecord,
  PlatformEvent,
  PlatformOverview,
  ServiceHealth,
  SystemSettingSection,
  TenantRecord,
  ToolRecord,
  UserRecord,
  GraphEdgeRecord,
  GraphNodeRecord,
} from '@/types/platform';

export const overviewData: PlatformOverview = {
  metrics: [
    { label: 'Active Tenants', value: '18', delta: '+2', trend: 'up', description: 'Enterprise and growth tenants across edge regions.' },
    { label: 'Running Agents', value: '42', delta: '+6%', trend: 'up', description: 'Agents with heartbeat within the last 2 minutes.' },
    { label: 'Queue Backlog', value: '482', delta: '-11%', trend: 'down', description: 'Events awaiting orchestration processing.' },
    { label: 'AI Error Rate', value: '0.91%', delta: '-0.12%', trend: 'down', description: 'Across planner, SQL, agent, and embeddings.' },
  ],
  alerts: [
    { id: 'alt-1', title: 'Embedding backlog spike', severity: 'medium', source: 'embedding-engine', summary: 'Vector ingestion crossed 2x expected throughput.' },
    { id: 'alt-2', title: 'Agent restart storm avoided', severity: 'low', source: 'agent-runtime', summary: 'Budget guardrails prevented 3 cascading retries.' },
    { id: 'alt-3', title: 'Tenant quota nearing threshold', severity: 'high', source: 'control-plane-api', summary: 'Acme exceeded 82% of daily event allocation.' },
  ],
  queueBacklog: 482,
  runningAgents: 42,
  healthyServices: 11,
  liveEventsPerMinute: 146,
};

export const tenantsData: TenantRecord[] = [
  { id: 'tenant_acme', name: 'Acme Marketplace', tier: 'enterprise', status: 'healthy', region: 'global', apps: 4, users: 1820, monthlySpendUsd: 9840, eventQuotaDaily: 150000 },
  { id: 'tenant_nova', name: 'Nova Commerce', tier: 'growth', status: 'degraded', region: 'eu-west-1', apps: 3, users: 640, monthlySpendUsd: 4210, eventQuotaDaily: 70000 },
  { id: 'tenant_helios', name: 'Helios Services', tier: 'starter', status: 'healthy', region: 'ap-south-1', apps: 2, users: 230, monthlySpendUsd: 980, eventQuotaDaily: 15000 },
];

export const appsData: AppRecord[] = [
  { id: 'app_market_web', tenantId: 'tenant_acme', name: 'Marketplace PWA', runtime: 'pwa', environment: 'production', status: 'healthy', region: 'global', agentsAttached: 5 },
  { id: 'app_vendor_flutter', tenantId: 'tenant_acme', name: 'Vendor Flutter', runtime: 'flutter', environment: 'production', status: 'healthy', region: 'us-east-1', agentsAttached: 2 },
  { id: 'app_admin', tenantId: 'tenant_nova', name: 'Operator Admin', runtime: 'admin', environment: 'staging', status: 'degraded', region: 'eu-west-1', agentsAttached: 1 },
  { id: 'app_public_api', tenantId: 'tenant_helios', name: 'Public API', runtime: 'api', environment: 'production', status: 'healthy', region: 'ap-south-1', agentsAttached: 2 },
];

export const usersData: UserRecord[] = [
  { id: 'usr_101', tenantId: 'tenant_acme', appId: 'app_market_web', name: 'Anaya Patel', role: 'tenant_admin', status: 'active', lastSeenAt: '2026-03-08T13:42:00.000Z' },
  { id: 'usr_102', tenantId: 'tenant_acme', appId: 'app_vendor_flutter', name: 'Diego Ramirez', role: 'viewer', status: 'invited', lastSeenAt: '2026-03-08T09:10:00.000Z' },
  { id: 'usr_103', tenantId: 'tenant_nova', appId: 'app_admin', name: 'Mei Chen', role: 'analyst', status: 'active', lastSeenAt: '2026-03-08T11:05:00.000Z' },
  { id: 'usr_104', tenantId: 'tenant_helios', appId: 'app_public_api', name: 'Ibrahim Khan', role: 'platform_admin', status: 'suspended', lastSeenAt: '2026-03-07T21:31:00.000Z' },
];

export const agentsData: AgentRecord[] = [
  { id: 'agent_growth_01', tenantId: 'tenant_acme', appId: 'app_market_web', name: 'Growth Agent', state: 'running', queue: 'growth-signals', budgetUsd: 300, decisionsToday: 48, workflowVersion: 'wf.growth.v4', lastTask: 'Detected supply gap in agri-implements.', lastHeartbeatAt: '2026-03-08T13:59:00.000Z' },
  { id: 'agent_moderation_02', tenantId: 'tenant_acme', appId: 'app_vendor_flutter', name: 'Moderation Agent', state: 'paused', queue: 'moderation', budgetUsd: 120, decisionsToday: 77, workflowVersion: 'wf.moderation.v2', lastTask: 'Paused after human escalation threshold exceeded.', lastHeartbeatAt: '2026-03-08T13:55:00.000Z' },
  { id: 'agent_finance_03', tenantId: 'tenant_nova', appId: 'app_admin', name: 'Finance Insights Agent', state: 'throttled', queue: 'finance-analytics', budgetUsd: 450, decisionsToday: 22, workflowVersion: 'wf.finance.v7', lastTask: 'Prepared monthly margin projection.', lastHeartbeatAt: '2026-03-08T13:57:00.000Z' },
];

export const toolsData: ToolRecord[] = [
  { name: 'marketplace.create.listing', schema: ['title:string', 'price:number', 'category_id:string'], permissions: ['tools:read', 'users:write'], riskLevel: 'medium', usageToday: 1280, p95Ms: 218, errorRate: 0.38 },
  { name: 'marketplace.search.listings', schema: ['query:string', 'location?:string', 'limit:number'], permissions: ['tools:read'], riskLevel: 'low', usageToday: 18432, p95Ms: 94, errorRate: 0.11 },
  { name: 'messages.send.message', schema: ['thread_id:string', 'message:string', 'recipient_id:string'], permissions: ['tools:read', 'users:read'], riskLevel: 'high', usageToday: 6230, p95Ms: 136, errorRate: 0.19 },
];

export const modelsData: ModelRecord[] = [
  { key: 'planner', service: 'planner-slm', activeModel: 'Qwen2.5-7B-Instruct', provider: 'VPS / Ollama', fallbackModel: 'Llama3.1-8B', latencyMs: 418, tokenUsage1h: 184000, errorRate: 0.72, candidates: ['Qwen2.5-7B-Instruct', 'Mistral-7B-Instruct', 'Llama3.1-8B'] },
  { key: 'sql', service: 'sql-brain', activeModel: 'SQLCoder-7B-2', provider: 'VPS / vLLM', fallbackModel: 'DeepSeek-Coder-V2-Lite', latencyMs: 302, tokenUsage1h: 93000, errorRate: 0.41, candidates: ['SQLCoder-7B-2', 'DeepSeek-Coder-V2-Lite', 'CodeLlama-13B'] },
  { key: 'agent', service: 'agent-brain', activeModel: 'Llama3.1-70B', provider: 'Dedicated GPU Node', fallbackModel: 'Qwen2.5-32B', latencyMs: 1112, tokenUsage1h: 421000, errorRate: 1.24, candidates: ['Llama3.1-70B', 'Qwen2.5-32B', 'Mixtral-8x7B'] },
  { key: 'embedding', service: 'embedding-engine', activeModel: 'bge-small-en-v1.5', provider: 'VPS / TEI', fallbackModel: 'gte-small', latencyMs: 74, tokenUsage1h: 580000, errorRate: 0.08, candidates: ['bge-small-en-v1.5', 'gte-small', 'e5-small-v2'] },
];

export const memoryData: MemoryRecord[] = [
  { id: 'mem_tenant_acme', scope: 'tenant', tenantId: 'tenant_acme', appId: 'app_market_web', records: 14220, vectorCount: 49810, lastCompactionAt: '2026-03-08T10:05:00.000Z' },
  { id: 'mem_app_nova', scope: 'app', tenantId: 'tenant_nova', appId: 'app_admin', records: 3820, vectorCount: 11130, lastCompactionAt: '2026-03-08T08:20:00.000Z' },
  { id: 'mem_agent_growth', scope: 'agent', tenantId: 'tenant_acme', appId: 'app_market_web', records: 910, vectorCount: 2910, lastCompactionAt: '2026-03-08T11:15:00.000Z' },
];

export const graphNodesData: GraphNodeRecord[] = [
  { id: 'user:anaya', type: 'user', label: 'Anaya Patel', metadata: 'Buyer / tenant_acme' },
  { id: 'vendor:novafoods', type: 'vendor', label: 'Nova Foods', metadata: 'Vendor / tenant_nova' },
  { id: 'category:farm', type: 'category', label: 'Farm Equipment', metadata: 'High demand category' },
  { id: 'listing:tractor301', type: 'listing', label: 'Tractor Listing 301', metadata: 'Marketplace listing' },
  { id: 'agent:growth', type: 'agent', label: 'Growth Agent', metadata: 'Monitors supply gaps' },
  { id: 'skill:analytics', type: 'skill', label: 'Market Intelligence', metadata: 'Agent skill cluster' },
  { id: 'location:mumbai', type: 'location', label: 'Mumbai', metadata: 'High demand metro' },
];

export const graphEdgesData: GraphEdgeRecord[] = [
  { id: 'edge-1', source: 'user:anaya', target: 'category:farm', label: 'searches' },
  { id: 'edge-2', source: 'vendor:novafoods', target: 'listing:tractor301', label: 'offers' },
  { id: 'edge-3', source: 'listing:tractor301', target: 'location:mumbai', label: 'located_in' },
  { id: 'edge-4', source: 'agent:growth', target: 'category:farm', label: 'monitors' },
  { id: 'edge-5', source: 'agent:growth', target: 'skill:analytics', label: 'uses' },
];

export const eventsData: PlatformEvent[] = [
  { id: 'evt_1001', tenantId: 'tenant_acme', appId: 'app_market_web', type: 'listing_created', actor: 'usr_101', summary: 'New premium tractor listing created for Mumbai.', timestamp: '2026-03-08T13:58:00.000Z' },
  { id: 'evt_1002', tenantId: 'tenant_nova', appId: 'app_admin', type: 'order_placed', actor: 'usr_103', summary: 'Enterprise order routed to vendor cluster.', timestamp: '2026-03-08T13:52:00.000Z' },
  { id: 'evt_1003', tenantId: 'tenant_acme', appId: 'app_vendor_flutter', type: 'message_sent', actor: 'usr_102', summary: 'Vendor response sent to buyer negotiation thread.', timestamp: '2026-03-08T13:48:00.000Z' },
  { id: 'evt_1004', tenantId: 'tenant_acme', appId: 'app_market_web', type: 'agent_triggered', actor: 'agent_growth_01', summary: 'Growth agent triggered after demand anomaly crossed threshold.', timestamp: '2026-03-08T13:44:00.000Z' },
  { id: 'evt_1005', tenantId: 'tenant_helios', appId: 'app_public_api', type: 'message_sent', actor: 'system', summary: 'Webhook dispatch delivered to external ERP.', timestamp: '2026-03-08T13:30:00.000Z' },
];

export const analyticsData: AnalyticsBundle = {
  kpis: [
    { label: 'Gross platform volume', value: '$2.4M', change: '+8.4%' },
    { label: 'AI-assisted actions', value: '61.2K', change: '+12.1%' },
    { label: 'Average tool success', value: '99.1%', change: '+0.5%' },
  ],
  tenantGrowth: [
    { label: 'Jan', value: 9 },
    { label: 'Feb', value: 12 },
    { label: 'Mar', value: 18 },
  ],
  toolUsageByDomain: [
    { label: 'marketplace', value: 18200 },
    { label: 'messages', value: 6230 },
    { label: 'analytics', value: 1810 },
  ],
};

export const observabilityData: ServiceHealth[] = [
  { name: 'cloudflare-workers-gateway', layer: 'edge', status: 'healthy', cpuPercent: 22, memoryPercent: 31, restarts24h: 0, endpoint: 'https://edge.platform.local' },
  { name: 'control-plane-api', layer: 'orchestration', status: 'healthy', cpuPercent: 41, memoryPercent: 58, restarts24h: 0, endpoint: 'https://control-plane.internal' },
  { name: 'agent-runtime', layer: 'orchestration', status: 'degraded', cpuPercent: 82, memoryPercent: 73, restarts24h: 2, endpoint: 'https://agent-runtime.internal' },
  { name: 'observability-api', layer: 'observability', status: 'healthy', cpuPercent: 36, memoryPercent: 47, restarts24h: 0, endpoint: 'https://observability.internal' },
];

export const systemData: SystemSettingSection[] = [
  {
    title: 'Authentication & RBAC',
    items: [
      { key: 'session_ttl', value: '12h', description: 'Signed dashboard admin session lifetime.' },
      { key: 'mfa_required', value: 'true', description: 'Platform owner and ops admin roles require MFA.' },
    ],
  },
  {
    title: 'Control Plane Connectivity',
    items: [
      { key: 'edge_api_timeout_ms', value: '12000', description: 'Timeout for UI to control-plane API requests.' },
      { key: 'service_mesh_policy', value: 'mTLS + JWT', description: 'VPS service-to-service auth strategy.' },
    ],
  },
  {
    title: 'Observability',
    items: [
      { key: 'prometheus_scrape_interval', value: '15s', description: 'Baseline scrape interval for VPS services.' },
      { key: 'loki_retention_days', value: '30', description: 'Operational logs retention for dashboard drilldowns.' },
    ],
  },
];
