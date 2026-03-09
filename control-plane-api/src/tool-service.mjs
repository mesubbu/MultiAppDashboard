import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { hasPermission } from './authz.mjs';
import { HttpError } from './http.mjs';

const toolNamePattern = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

const datasetDefinitions = {
  tenants: { permission: 'tenants:read', load: (store, filters) => store.listTenants(filters), filterKeys: ['id', 'name', 'tier', 'status', 'region'] },
  apps: { permission: 'apps:read', load: (store, filters) => store.listApps(filters), filterKeys: ['id', 'tenantId', 'name', 'runtime', 'environment', 'status', 'region'] },
  users: { permission: 'users:read', load: (store, filters) => store.listUsers(filters), filterKeys: ['id', 'tenantId', 'appId', 'name', 'role', 'status'] },
  agents: { permission: 'agents:read', load: (store, filters) => store.listAgents(filters), filterKeys: ['id', 'tenantId', 'appId', 'name', 'state', 'queue', 'workflowVersion'] },
  events: { permission: 'events:read', load: (store, filters, input) => store.listEvents({ ...filters, limit: input.limit }), filterKeys: ['id', 'tenantId', 'appId', 'type', 'actor', 'summary'] },
  tools: { permission: 'tools:read', load: (store) => store.listTools(), filterKeys: ['name', 'riskLevel'] },
  models: { permission: 'models:read', load: (store) => store.listModels(), filterKeys: ['key', 'service', 'activeModel', 'provider', 'fallbackModel'] },
  memory: { permission: 'memory:read', load: (store, filters) => store.listMemory(filters), filterKeys: ['id', 'scope', 'tenantId', 'appId'] },
};

const databaseQueryInputSchema = z.object({
  dataset: z.enum(Object.keys(datasetDefinitions)),
  filters: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  limit: z.number().int().min(1).max(25).default(10),
});

const statisticsSummaryInputSchema = z.object({
  values: z.array(z.number().finite()).min(1).max(500),
  label: z.string().trim().min(1).max(64).default('values'),
});

const marketLookupInputSchema = z.object({
  category: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(80),
  condition: z.enum(['new', 'used']).default('new'),
  quantity: z.number().int().min(1).max(100).default(1),
});

const analysisInputSchema = z.object({
  topic: z.enum(['supply_gap', 'agent_backlog', 'service_health']),
  focus: z.string().trim().min(1).max(80).optional(),
});

function stringifyPreview(value, maxLength = 220) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (!serialized) return '';
  return serialized.length <= maxLength ? serialized : `${serialized.slice(0, maxLength - 1).trimEnd()}…`;
}

function compareFilterValue(candidate, expected) {
  if (typeof candidate === 'string') return candidate.toLowerCase().includes(String(expected).toLowerCase());
  if (typeof candidate === 'number') return candidate === Number(expected);
  if (typeof candidate === 'boolean') return candidate === expected;
  return false;
}

function applyRecordFilters(records, filters, allowedKeys) {
  for (const key of Object.keys(filters)) {
    if (!allowedKeys.includes(key)) {
      throw new HttpError(400, 'INVALID_TOOL_FILTER', `Filter ${key} is not allowed for this dataset.`);
    }
  }
  return records.filter((record) =>
    Object.entries(filters).every(([key, value]) => compareFilterValue(record[key], value)),
  );
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function roundCurrency(value) {
  return Math.round(value / 100) * 100;
}

function isPrivilegedRole(roles = []) {
  return roles.some((role) => ['platform_owner', 'platform_admin'].includes(role));
}

const toolDefinitions = [
  {
    name: 'database.query.records',
    description: 'Query a scoped control-plane dataset with read-only filters and row limits.',
    schema: ['dataset:tenants|apps|users|agents|events|tools|models|memory', 'filters?:record', 'limit:number<=25'],
    permissions: ['tools:read', 'tenants:read', 'apps:read', 'users:read', 'agents:read', 'events:read', 'models:read', 'memory:read'],
    riskLevel: 'medium',
    executionMode: 'read',
    safetyGuards: ['read_only', 'whitelisted_filters', 'result_limit_25'],
    inputSchema: databaseQueryInputSchema,
    requiredPermissions: (input) => Array.from(new Set(['tools:read', datasetDefinitions[input.dataset].permission])),
    async execute({ store, input, filters }) {
      const dataset = datasetDefinitions[input.dataset];
      const records = await dataset.load(store, filters, input);
      const filtered = applyRecordFilters(records, input.filters, dataset.filterKeys).slice(0, input.limit);
      return {
        summary: `Returned ${filtered.length} ${input.dataset} record${filtered.length === 1 ? '' : 's'}.`,
        payload: { dataset: input.dataset, returnedCount: filtered.length, records: filtered },
      };
    },
  },
  {
    name: 'statistics.calculate.summary',
    description: 'Compute a bounded statistical summary over numeric inputs.',
    schema: ['values:number[]<=500', 'label?:string'],
    permissions: ['tools:read'],
    riskLevel: 'low',
    executionMode: 'compute',
    safetyGuards: ['bounded_input_500', 'no_side_effects'],
    inputSchema: statisticsSummaryInputSchema,
    async execute({ input }) {
      const sorted = [...input.values].sort((left, right) => left - right);
      const sum = input.values.reduce((total, value) => total + value, 0);
      const mean = sum / input.values.length;
      return {
        summary: `Computed summary statistics for ${input.values.length} ${input.label}.`,
        payload: {
          label: input.label,
          count: input.values.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          sum: Number(sum.toFixed(4)),
          mean: Number(mean.toFixed(4)),
          median: percentile(sorted, 0.5),
          p90: percentile(sorted, 0.9),
        },
      };
    },
  },
  {
    name: 'market.lookup.price',
    description: 'Estimate an indicative market price band from scoped platform knowledge signals.',
    schema: ['category:string', 'location:string', 'condition:new|used', 'quantity:number<=100'],
    permissions: ['tools:read', 'graph:read'],
    riskLevel: 'medium',
    executionMode: 'analyze',
    safetyGuards: ['indicative_only', 'internal_signals_only', 'no_external_requests'],
    inputSchema: marketLookupInputSchema,
    async execute({ store, input, filters }) {
      const graph = await store.getKnowledgeGraph(filters);
      const categoryNode = graph.nodes.find((node) => node.type === 'category' && node.label.toLowerCase().includes(input.category.toLowerCase()));
      const locationNode = graph.nodes.find((node) => node.type === 'location' && node.label.toLowerCase().includes(input.location.toLowerCase()));
      const categoryScore = categoryNode?.score ?? 0.68;
      const locationScore = locationNode?.score ?? 0.71;
      const demandScore = (categoryScore + locationScore) / 2;
      const conditionMultiplier = input.condition === 'used' ? 0.74 : 1;
      const quantityMultiplier = 1 + Math.min(input.quantity - 1, 20) * 0.012;
      const midpoint = (72_000 + categoryScore * 24_000 + locationScore * 18_000) * conditionMultiplier * quantityMultiplier;
      const low = roundCurrency(midpoint * 0.92);
      const high = roundCurrency(midpoint * 1.08);
      return {
        summary: `Indicative ${input.condition} market band for ${input.category} in ${input.location} is ₹${low.toLocaleString()}–₹${high.toLocaleString()}.`,
        payload: {
          category: input.category,
          location: input.location,
          condition: input.condition,
          quantity: input.quantity,
          currency: 'INR',
          indicativeLow: low,
          indicativeHigh: high,
          confidence: Number(demandScore.toFixed(2)),
          factors: [
            categoryNode ? `Category signal matched ${categoryNode.label}.` : 'No direct category node match; used fallback market prior.',
            locationNode ? `Location signal matched ${locationNode.label}.` : 'No direct location node match; used regional fallback.',
            input.condition === 'used' ? 'Used-condition discount applied.' : 'New-condition baseline applied.',
          ],
        },
      };
    },
  },
  {
    name: 'analysis.summarize.signals',
    description: 'Summarize key platform signals for supply gaps, backlog, or service health.',
    schema: ['topic:supply_gap|agent_backlog|service_health', 'focus?:string'],
    permissions: ['tools:read', 'graph:read', 'agents:read', 'observability:read'],
    riskLevel: 'high',
    executionMode: 'analyze',
    safetyGuards: ['topic_scoped', 'read_only', 'summary_only'],
    inputSchema: analysisInputSchema,
    requiredPermissions: (input) => ['tools:read', input.topic === 'supply_gap' ? 'graph:read' : input.topic === 'agent_backlog' ? 'agents:read' : 'observability:read'],
    async execute({ store, input, filters }) {
      if (input.topic === 'supply_gap') {
        const graph = await store.getKnowledgeGraph(filters);
        const hotCategory = graph.nodes.find((node) => node.type === 'category' && (!input.focus || node.label.toLowerCase().includes(input.focus.toLowerCase())));
        const hotLocation = graph.nodes.find((node) => node.type === 'location' && node.health !== 'healthy');
        return {
          summary: `Supply gap summary: ${hotCategory?.label ?? 'category signals'} remain strongest around ${hotLocation?.label ?? 'priority locations'}.`,
          payload: { topic: input.topic, findings: [hotCategory?.description ?? 'Category demand remains elevated.', hotLocation?.description ?? 'Location health indicates uneven supply coverage.'] },
        };
      }

      if (input.topic === 'agent_backlog') {
        const agents = await store.listAgents(filters);
        const busiest = [...agents].sort((left, right) => right.queueDepth - left.queueDepth)[0];
        const blocked = agents.filter((agent) => agent.orchestration?.dependencyState === 'blocked').length;
        return {
          summary: `Agent backlog summary: ${busiest?.name ?? 'No agents'} has the deepest queue, with ${blocked} blocked agent${blocked === 1 ? '' : 's'}.`,
          payload: { topic: input.topic, busiestAgent: busiest?.name ?? null, queueDepth: busiest?.queueDepth ?? 0, blockedAgents: blocked },
        };
      }

      const services = await store.getObservability();
      const degraded = services.filter((service) => service.status !== 'healthy');
      return {
        summary: `Service health summary: ${degraded.length} service${degraded.length === 1 ? '' : 's'} need attention.`,
        payload: { topic: input.topic, degradedServices: degraded.map((service) => ({ name: service.name, status: service.status, cpuPercent: service.cpuPercent, memoryPercent: service.memoryPercent })) },
      };
    },
  },
].map((definition) => {
  if (!toolNamePattern.test(definition.name)) {
    throw new Error(`Invalid tool name: ${definition.name}`);
  }
  return definition;
});

export function createToolService({ store }) {
  return {
    async listTools() {
      const telemetry = new Map((await store.listTools()).map((item) => [item.name, item]));
      return toolDefinitions.map((definition) => ({
        name: definition.name,
        description: definition.description,
        schema: definition.schema,
        permissions: definition.permissions,
        riskLevel: definition.riskLevel,
        executionMode: definition.executionMode,
        safetyGuards: definition.safetyGuards,
        usageToday: telemetry.get(definition.name)?.usageToday ?? 0,
        p95Ms: telemetry.get(definition.name)?.p95Ms ?? 0,
        errorRate: telemetry.get(definition.name)?.errorRate ?? 0,
      }));
    },
    async listExecutions(input = {}, adminContext) {
      return store.listToolExecutions({
        tenantId: adminContext.tenantId ?? null,
        appId: adminContext.appId ?? null,
        tool: input.tool,
        status: input.status,
        limit: input.limit ?? 20,
      });
    },
    async executeTool(payload, adminContext, filters = {}) {
      const definition = toolDefinitions.find((item) => item.name === payload.tool);
      if (!definition) {
        throw new HttpError(404, 'TOOL_NOT_FOUND', `No tool found for ${payload.tool}.`);
      }

      const input = definition.inputSchema.parse(payload.input ?? {});
      const requiredPermissions = definition.requiredPermissions?.(input) ?? definition.permissions;
      const now = new Date().toISOString();

      if (definition.riskLevel === 'critical' && !isPrivilegedRole(adminContext.roles)) {
        const item = await store.recordToolExecution({
          id: `tool_exec_${randomUUID()}`,
          tool: definition.name,
          actor: adminContext.userId,
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          status: 'blocked',
          riskLevel: definition.riskLevel,
          executionMode: definition.executionMode,
          permissions: requiredPermissions,
          safetyGuards: [...definition.safetyGuards, 'privileged_role_required'],
          schema: definition.schema,
          summary: 'Blocked critical-risk tool for a non-privileged caller.',
          inputPreview: stringifyPreview(input),
          outputPreview: '',
          errorMessage: 'Critical-risk tools require a privileged platform role.',
          durationMs: 0,
          createdAt: now,
        });
        return { item, result: null };
      }

      const missingPermission = requiredPermissions.find((permission) => !hasPermission(adminContext.roles, permission));
      if (missingPermission) {
        const item = await store.recordToolExecution({
          id: `tool_exec_${randomUUID()}`,
          tool: definition.name,
          actor: adminContext.userId,
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          status: 'blocked',
          riskLevel: definition.riskLevel,
          executionMode: definition.executionMode,
          permissions: requiredPermissions,
          safetyGuards: definition.safetyGuards,
          schema: definition.schema,
          summary: `Blocked tool execution because ${missingPermission} is required.`,
          inputPreview: stringifyPreview(input),
          outputPreview: '',
          errorMessage: `Missing ${missingPermission} permission.`,
          durationMs: 0,
          createdAt: now,
        });
        return { item, result: null };
      }

      const startedAt = Date.now();
      try {
        const result = await definition.execute({ store, input, filters, adminContext });
        const item = await store.recordToolExecution({
          id: `tool_exec_${randomUUID()}`,
          tool: definition.name,
          actor: adminContext.userId,
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          status: 'completed',
          riskLevel: definition.riskLevel,
          executionMode: definition.executionMode,
          permissions: requiredPermissions,
          safetyGuards: definition.safetyGuards,
          schema: definition.schema,
          summary: result.summary,
          inputPreview: stringifyPreview(input),
          outputPreview: stringifyPreview(result.payload),
          durationMs: Date.now() - startedAt,
          createdAt: now,
        });
        return { item, result };
      } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to execute ${definition.name}.`;
        const item = await store.recordToolExecution({
          id: `tool_exec_${randomUUID()}`,
          tool: definition.name,
          actor: adminContext.userId,
          tenantId: adminContext.tenantId ?? null,
          appId: adminContext.appId ?? null,
          status: 'failed',
          riskLevel: definition.riskLevel,
          executionMode: definition.executionMode,
          permissions: requiredPermissions,
          safetyGuards: definition.safetyGuards,
          schema: definition.schema,
          summary: `Tool execution failed for ${definition.name}.`,
          inputPreview: stringifyPreview(input),
          outputPreview: '',
          errorMessage: message,
          durationMs: Date.now() - startedAt,
          createdAt: now,
        });
        return { item, result: null };
      }
    },
  };
}