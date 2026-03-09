import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireCurrentSession,
  mockGetTenants,
  mockGetTenantPage,
  mockMetricsCards,
  mockTenantManager,
} = vi.hoisted(() => ({
  mockRequireCurrentSession: vi.fn(),
  mockGetTenants: vi.fn(),
  mockGetTenantPage: vi.fn(),
  mockMetricsCards: vi.fn(() => <div>Metrics cards</div>),
  mockTenantManager: vi.fn(() => <div>Tenant manager</div>),
}));

vi.mock('@/lib/session', () => ({ requireCurrentSession: mockRequireCurrentSession }));
vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getTenants: mockGetTenants,
    getTenantPage: mockGetTenantPage,
  },
}));
vi.mock('@/components/dashboard/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <div>{title} header</div> }));
vi.mock('@/components/dashboard/MetricsCards', () => ({ MetricsCards: mockMetricsCards }));
vi.mock('@/components/dashboard/TenantManager', () => ({ TenantManager: mockTenantManager }));

import TenantsPage from '@/app/(dashboard)/tenants/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCurrentSession.mockResolvedValue({ user: { roles: ['viewer'] } });
  mockGetTenants.mockResolvedValue({
    items: [
      { id: 'tenant_1', status: 'healthy', monthlySpendUsd: 1000, eventQuotaDaily: 25000 },
      { id: 'tenant_2', status: 'degraded', monthlySpendUsd: 2500, eventQuotaDaily: 50000 },
    ],
  });
  mockGetTenantPage.mockResolvedValue({ items: [{ id: 'tenant_2', status: 'degraded', region: 'eu-west-1', eventQuotaDaily: 50000 }], pageInfo: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } });
});

describe('TenantsPage', () => {
  it('builds tenant metrics and forwards parsed query props to TenantManager', async () => {
    render(await TenantsPage({ searchParams: Promise.resolve({ q: 'nova', status: 'degraded' }) }));

    expect(screen.getByText('Tenants header')).toBeInTheDocument();
    expect(mockGetTenantPage).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'nova', status: 'degraded', page: 1, pageSize: 10 }),
    );
    expect(mockMetricsCards).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: 'Tenant count', value: '2' }),
          expect.objectContaining({ label: 'Monthly spend', value: '$3,500' }),
          expect.objectContaining({ label: 'Degraded tenants', value: '1' }),
          expect.objectContaining({ label: 'Daily quota capacity', value: '75k' }),
        ]),
      }),
      undefined,
    );
    expect(mockTenantManager).toHaveBeenCalledWith(
      expect.objectContaining({
        tenants: [{ id: 'tenant_2', status: 'degraded', region: 'eu-west-1', eventQuotaDaily: 50000 }],
        query: expect.objectContaining({ query: 'nova', status: 'degraded', page: 1, pageSize: 10 }),
        canManage: false,
      }),
      undefined,
    );
  });
});

