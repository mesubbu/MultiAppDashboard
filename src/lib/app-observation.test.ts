import { describe, expect, it } from 'vitest';

import { buildAppObservationModel } from '@/lib/app-observation';
import type {
  AgentRecord,
  AppRecord,
  AuditRecord,
  ClientErrorRecord,
  PlatformEvent,
  ServiceHealth,
  SystemSettingSection,
} from '@/types/platform';

const app: AppRecord = {
  id: 'app_control',
  tenantId: 'tenant_private',
  name: 'Control Console',
  runtime: 'admin',
  environment: 'production',
  status: 'degraded',
  region: 'private-vps',
  agentsAttached: 1,
};

const services: ServiceHealth[] = [
  {
    name: 'cloudflare-workers-gateway',
    layer: 'edge',
    status: 'healthy',
    cpuPercent: 22,
    memoryPercent: 31,
    restarts24h: 0,
    endpoint: 'https://edge.internal',
  },
  {
    name: 'control-plane-api',
    layer: 'orchestration',
    status: 'degraded',
    cpuPercent: 78,
    memoryPercent: 64,
    restarts24h: 1,
    endpoint: 'https://control-plane.internal',
  },
  {
    name: 'observability-api',
    layer: 'observability',
    status: 'healthy',
    cpuPercent: 34,
    memoryPercent: 48,
    restarts24h: 0,
    endpoint: 'https://observability.internal',
  },
];

const agents: AgentRecord[] = [
  {
    id: 'agent_1',
    tenantId: 'tenant_private',
    appId: 'app_control',
    name: 'Ops Agent',
    state: 'running',
    queue: 'ops',
    queueDepth: 7,
    budgetUsd: 120,
    budgetUtilizationPercent: 42,
    avgLatencyMs: 310,
    tokenUsage1h: 14000,
    decisionsToday: 9,
    workflowVersion: 'wf.ops.v2',
    lastTask: 'Collected runtime diagnostics',
    lastHeartbeatAt: '2026-03-10T07:11:00.000Z',
    orchestration: {
      stage: 'observe',
      lane: 'Runtime inspection',
      dependencyState: 'ready',
      priority: 'medium',
      autonomyLevel: 'supervised',
      blockers: [],
      upstreamAgentIds: [],
      downstreamAgentIds: [],
      stageEnteredAt: '2026-03-10T07:00:00.000Z',
    },
    tasks: [],
    decisions: [],
    logs: [
      {
        id: 'log_1',
        level: 'warn',
        source: 'agent-runtime',
        message: 'Restart window scheduled after failed health check.',
        timestamp: '2026-03-10T07:12:00.000Z',
      },
    ],
    executionHistory: [],
  },
];

const events: PlatformEvent[] = [
  {
    id: 'evt_1',
    tenantId: 'tenant_private',
    appId: 'app_control',
    type: 'app_updated',
    actor: 'operator',
    summary: 'Configuration snapshot refreshed after deploy.',
    timestamp: '2026-03-10T07:13:00.000Z',
  },
];

const actions: AuditRecord[] = [
  {
    id: 'audit_1',
    actor: 'operator',
    actorDisplay: 'Operator',
    action: 'app_update',
    resourceType: 'app',
    resourceId: 'app_control',
    appId: 'app_control',
    tenantId: 'tenant_private',
    summary: 'Updated deployment environment variables.',
    timestamp: '2026-03-10T07:14:00.000Z',
  },
];

const clientErrors: ClientErrorRecord[] = [
  {
    id: 'err_1',
    kind: 'window-error',
    source: 'dashboard-ui',
    message: 'Unhandled promise rejection while polling metrics.',
    name: 'Error',
    pathname: '/apps/app_control',
    digest: null,
    occurredAt: '2026-03-10T07:15:00.000Z',
    tenantId: 'tenant_private',
    appId: 'app_control',
    userId: 'operator',
  },
];

const systemSections: SystemSettingSection[] = [
  {
    title: 'Control Plane Connectivity',
    items: [
      {
        key: 'edge_api_timeout_ms',
        value: '12000',
        description: 'Timeout for UI to control-plane API requests.',
      },
      {
        key: 'service_mesh_policy',
        value: 'mTLS + JWT',
        description: 'Internal service-to-service authentication.',
      },
    ],
  },
];

describe('buildAppObservationModel', () => {
  it('assembles a single-operator inspection view for an app', () => {
    const observation = buildAppObservationModel({
      app,
      agents,
      services,
      events,
      actions,
      clientErrors,
      systemSections,
    });

    expect(observation.summary).toContain('Single-operator inspection');
    expect(observation.services.map((service) => service.name)).toEqual([
      'cloudflare-workers-gateway',
      'control-plane-api',
      'observability-api',
    ]);
    expect(observation.metrics.map((metric) => metric.label)).toEqual([
      'Linked services',
      'Average CPU',
      'Queue backlog',
      'Recent activity',
    ]);
    expect(observation.logs[0]).toMatchObject({
      source: 'dashboard-ui',
      level: 'error',
    });
    expect(observation.configuration).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'deployment_mode',
          value: 'single-operator',
        }),
        expect.objectContaining({
          key: 'service_mesh_policy',
          value: 'mTLS + JWT',
        }),
      ]),
    );
    expect(observation.recentEvents[0]?.summary).toBe(
      'Configuration snapshot refreshed after deploy.',
    );
    expect(observation.recentActions[0]?.summary).toBe(
      'Updated deployment environment variables.',
    );
  });
});
