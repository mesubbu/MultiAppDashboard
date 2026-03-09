import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireCurrentSession,
  mockGetApps,
  mockGetAppPage,
  mockGetTenants,
  mockMetricsCards,
  mockAppManager,
} = vi.hoisted(() => ({
  mockRequireCurrentSession: vi.fn(),
  mockGetApps: vi.fn(),
  mockGetAppPage: vi.fn(),
  mockGetTenants: vi.fn(),
  mockMetricsCards: vi.fn(() => <div>Metrics cards</div>),
  mockAppManager: vi.fn(() => <div>App manager</div>),
}));

vi.mock('@/lib/session', () => ({ requireCurrentSession: mockRequireCurrentSession }));
vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getApps: mockGetApps,
    getAppPage: mockGetAppPage,
    getTenants: mockGetTenants,
  },
}));
vi.mock('@/components/dashboard/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <div>{title} header</div> }));
vi.mock('@/components/dashboard/MetricsCards', () => ({ MetricsCards: mockMetricsCards }));
vi.mock('@/components/dashboard/AppManager', () => ({ AppManager: mockAppManager }));

import AppsPage from '@/app/(dashboard)/apps/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCurrentSession.mockResolvedValue({ user: { roles: ['platform_admin'] } });
  mockGetApps.mockResolvedValue({
    items: [
      { id: 'app_1', environment: 'production', status: 'healthy', runtime: 'pwa', agentsAttached: 2 },
      { id: 'app_2', environment: 'staging', status: 'critical', runtime: 'admin', agentsAttached: 3 },
    ],
  });
  mockGetAppPage.mockResolvedValue({ items: [{ id: 'app_2', status: 'critical', environment: 'staging', region: 'eu-west-1' }], pageInfo: { page: 2, pageSize: 20, totalItems: 2, totalPages: 1 } });
  mockGetTenants.mockResolvedValue({ items: [{ id: 'tenant_1', name: 'Acme' }] });
});

describe('AppsPage', () => {
  it('builds app metrics and forwards parsed query props to AppManager', async () => {
    render(await AppsPage({ searchParams: Promise.resolve({ q: 'alpha', status: 'critical', environment: 'staging' }) }));

    expect(screen.getByText('Apps header')).toBeInTheDocument();
    expect(mockGetAppPage).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'alpha', status: 'critical', environment: 'staging', page: 1, pageSize: 10 }),
    );
    expect(mockMetricsCards).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ label: 'Production apps', value: '1' }),
          expect.objectContaining({ label: 'Degraded apps', value: '1' }),
          expect.objectContaining({ label: 'Attached agents', value: '5' }),
          expect.objectContaining({ label: 'Runtime families', value: '2' }),
        ],
      }),
      undefined,
    );
    expect(mockAppManager).toHaveBeenCalledWith(
      expect.objectContaining({
        apps: [{ id: 'app_2', status: 'critical', environment: 'staging', region: 'eu-west-1' }],
        tenants: [{ id: 'tenant_1', name: 'Acme' }],
        query: expect.objectContaining({ query: 'alpha', status: 'critical', environment: 'staging', page: 1, pageSize: 10 }),
        canManage: true,
      }),
      undefined,
    );
  });
});

