import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRequireCurrentSession,
  mockGetUsers,
  mockGetUserPage,
  mockGetApps,
  mockGetTenants,
  mockMetricsCards,
  mockUserManager,
} = vi.hoisted(() => ({
  mockRequireCurrentSession: vi.fn(),
  mockGetUsers: vi.fn(),
  mockGetUserPage: vi.fn(),
  mockGetApps: vi.fn(),
  mockGetTenants: vi.fn(),
  mockMetricsCards: vi.fn(() => <div>Metrics cards</div>),
  mockUserManager: vi.fn(() => <div>User manager</div>),
}));

vi.mock('@/lib/session', () => ({ requireCurrentSession: mockRequireCurrentSession }));
vi.mock('@/services/control-plane', () => ({
  controlPlaneService: {
    getUsers: mockGetUsers,
    getUserPage: mockGetUserPage,
    getApps: mockGetApps,
    getTenants: mockGetTenants,
  },
}));
vi.mock('@/components/dashboard/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <div>{title} header</div> }));
vi.mock('@/components/dashboard/MetricsCards', () => ({ MetricsCards: mockMetricsCards }));
vi.mock('@/components/dashboard/UserManager', () => ({ UserManager: mockUserManager }));

import UsersPage from '@/app/(dashboard)/users/page';

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCurrentSession.mockResolvedValue({ user: { roles: ['platform_owner'] } });
  mockGetUsers.mockResolvedValue({
    items: [
      { id: 'user_1', role: 'tenant_admin', status: 'active' },
      { id: 'user_2', role: 'viewer', status: 'invited' },
      { id: 'user_3', role: 'analyst', status: 'suspended' },
    ],
  });
  mockGetUserPage.mockResolvedValue({ items: [{ id: 'user_2', role: 'viewer', status: 'invited', name: 'Jordan' }], pageInfo: { page: 1, pageSize: 20, totalItems: 3, totalPages: 1 } });
  mockGetApps.mockResolvedValue({ items: [{ id: 'app_1', name: 'Acme Web' }] });
  mockGetTenants.mockResolvedValue({ items: [{ id: 'tenant_1', name: 'Acme' }] });
});

describe('UsersPage', () => {
  it('builds user metrics, parses filters, and derives elevated role options', async () => {
    render(await UsersPage({ searchParams: Promise.resolve({ q: 'jordan', status: 'invited', role: 'viewer' }) }));

    expect(screen.getByText('Users header')).toBeInTheDocument();
    expect(mockGetUserPage).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'jordan', status: 'invited', role: 'viewer', page: 1, pageSize: 10 }),
    );
    expect(mockMetricsCards).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ label: 'Active users', value: '1' }),
          expect.objectContaining({ label: 'Invitations pending', value: '1' }),
          expect.objectContaining({ label: 'Suspended', value: '1' }),
          expect.objectContaining({ label: 'Distinct roles', value: '3' }),
        ]),
      }),
      undefined,
    );
    expect(mockUserManager).toHaveBeenCalledWith(
      expect.objectContaining({
        users: [{ id: 'user_2', role: 'viewer', status: 'invited', name: 'Jordan' }],
        apps: [{ id: 'app_1', name: 'Acme Web' }],
        tenants: [{ id: 'tenant_1', name: 'Acme' }],
        roleOptions: ['platform_admin', 'tenant_admin', 'ops_admin', 'analyst', 'viewer'],
        query: expect.objectContaining({ query: 'jordan', status: 'invited', role: 'viewer', page: 1, pageSize: 10 }),
        canManage: true,
      }),
      undefined,
    );
  });
});

