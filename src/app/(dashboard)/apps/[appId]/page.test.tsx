import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireCurrentSession,
  mockGetApps,
  mockGetAgents,
  mockGetEventPage,
  mockGetAuditPage,
  mockGetObservability,
  mockGetSystemSettings,
  mockNotFound,
} = vi.hoisted(() => ({
  mockRequireCurrentSession: vi.fn(),
  mockGetApps: vi.fn(),
  mockGetAgents: vi.fn(),
  mockGetEventPage: vi.fn(),
  mockGetAuditPage: vi.fn(),
  mockGetObservability: vi.fn(),
  mockGetSystemSettings: vi.fn(),
  mockNotFound: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));
vi.mock('@/lib/session', () => ({
  requireCurrentSession: mockRequireCurrentSession,
}));
vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getApps: mockGetApps,
    getAgents: mockGetAgents,
    getEventPage: mockGetEventPage,
    getAuditPage: mockGetAuditPage,
    getObservability: mockGetObservability,
    getSystemSettings: mockGetSystemSettings,
  },
}));

import AppObservationPage from '@/app/(dashboard)/apps/[appId]/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCurrentSession.mockResolvedValue({
    user: { roles: ['platform_admin'] },
  });
  mockGetApps.mockResolvedValue({
    items: [
      {
        id: 'app_1',
        tenantId: 'tenant_private',
        name: 'Control Console',
        runtime: 'admin',
        environment: 'production',
        status: 'degraded',
        region: 'private-vps',
        agentsAttached: 1,
      },
    ],
  });
  mockGetAgents.mockResolvedValue({
    items: [
      {
        id: 'agent_1',
        tenantId: 'tenant_private',
        appId: 'app_1',
        name: 'Ops Agent',
        state: 'running',
        queue: 'ops',
        queueDepth: 5,
        budgetUsd: 90,
        budgetUtilizationPercent: 55,
        avgLatencyMs: 320,
        tokenUsage1h: 9000,
        decisionsToday: 7,
        workflowVersion: 'wf.ops.v2',
        lastTask: 'Collected diagnostics',
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
    ],
  });
  mockGetEventPage.mockResolvedValue({
    items: [
      {
        id: 'evt_1',
        tenantId: 'tenant_private',
        appId: 'app_1',
        type: 'app_updated',
        actor: 'operator',
        summary: 'Configuration snapshot refreshed after deploy.',
        timestamp: '2026-03-10T07:13:00.000Z',
      },
    ],
    pageInfo: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
  });
  mockGetAuditPage.mockResolvedValue({
    items: [
      {
        id: 'audit_1',
        actor: 'operator',
        actorDisplay: 'Operator',
        action: 'app_update',
        resourceType: 'app',
        resourceId: 'app_1',
        appId: 'app_1',
        tenantId: 'tenant_private',
        summary: 'Updated deployment environment variables.',
        timestamp: '2026-03-10T07:14:00.000Z',
      },
    ],
    pageInfo: { page: 1, pageSize: 8, totalItems: 1, totalPages: 1 },
  });
  mockGetObservability.mockResolvedValue({
    items: [
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
    ],
    clientErrors: [
      {
        id: 'err_1',
        kind: 'window-error',
        source: 'dashboard-ui',
        message: 'Unhandled promise rejection while polling metrics.',
        name: 'Error',
        pathname: '/apps/app_1',
        digest: null,
        occurredAt: '2026-03-10T07:15:00.000Z',
        tenantId: 'tenant_private',
        appId: 'app_1',
        userId: 'operator',
      },
    ],
  });
  mockGetSystemSettings.mockResolvedValue({
    sections: [
      {
        title: 'Control Plane Connectivity',
        items: [
          {
            key: 'edge_api_timeout_ms',
            value: '12000',
            description: 'Timeout for UI to control-plane API requests.',
          },
        ],
      },
    ],
  });
});

describe('AppObservationPage', () => {
  it('renders the per-app observation view with runtime details', async () => {
    render(
      await AppObservationPage({ params: Promise.resolve({ appId: 'app_1' }) }),
    );

    expect(
      screen.getByRole('heading', { name: 'Control Console' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to apps/i })).toHaveAttribute(
      'href',
      '/apps',
    );
    expect(screen.getByText('Runtime services')).toBeInTheDocument();
    expect(screen.getByText('control-plane-api')).toBeInTheDocument();
    expect(
      screen.getByText('Restart window scheduled after failed health check.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Updated deployment environment variables.').length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Unhandled promise rejection while polling metrics.')
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('single-operator')).toBeInTheDocument();
    expect(mockGetEventPage).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app_1' }),
    );
    expect(mockGetAuditPage).toHaveBeenCalledWith(
      expect.objectContaining({ appId: 'app_1' }),
    );
  });
});
