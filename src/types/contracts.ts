import { z } from 'zod';

const roleSchema = z.enum([
  'platform_owner',
  'platform_admin',
  'tenant_admin',
  'ops_admin',
  'analyst',
  'viewer',
]);

const permissionSchema = z.enum([
  'tenants:read',
  'tenants:write',
  'apps:read',
  'users:read',
  'users:write',
  'agents:read',
  'agents:operate',
  'tools:read',
  'models:read',
  'models:switch',
  'memory:read',
  'graph:read',
  'events:read',
  'analytics:read',
  'observability:read',
  'system:write',
]);

const statusSchema = z.enum(['healthy', 'degraded', 'critical']);
const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
const agentStateSchema = z.enum(['running', 'paused', 'throttled', 'error']);
const eventTypeSchema = z.enum([
  'listing_created',
  'order_placed',
  'message_sent',
  'agent_triggered',
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

export const agentListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      tenantId: z.string(),
      appId: z.string(),
      name: z.string(),
      state: agentStateSchema,
      queue: z.string(),
      budgetUsd: z.number(),
      decisionsToday: z.number(),
      workflowVersion: z.string(),
      lastTask: z.string(),
      lastHeartbeatAt: z.string(),
    }),
  ),
});

export const agentActionRequestSchema = z.object({
  action: z.enum(['pause', 'restart', 'update_budget', 'update_workflow']),
  budgetUsd: z.number().optional(),
  workflowVersion: z.string().optional(),
});

export const toolListResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      schema: z.array(z.string()),
      permissions: z.array(permissionSchema),
      riskLevel: riskLevelSchema,
      usageToday: z.number(),
      p95Ms: z.number(),
      errorRate: z.number(),
    }),
  ),
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

export const modelSwitchRequestSchema = z.object({
  key: z.enum(['planner', 'sql', 'agent', 'embedding']),
  targetModel: z.string(),
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

export const knowledgeGraphResponseSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: graphNodeTypeSchema,
      label: z.string(),
      metadata: z.string(),
    }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string(),
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

export const analyticsResponseSchema = z.object({
  kpis: z.array(z.object({ label: z.string(), value: z.string(), change: z.string() })),
  tenantGrowth: z.array(z.object({ label: z.string(), value: z.number() })),
  toolUsageByDomain: z.array(z.object({ label: z.string(), value: z.number() })),
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
    }),
  ),
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
