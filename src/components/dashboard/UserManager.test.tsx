import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppRecord, PaginationInfo, PlatformRole, TenantRecord, UserRecord } from '@/types/platform';

const { navState, replaceMock, refreshMock, pushSuccessToastMock, pushErrorToastMock } = vi.hoisted(() => ({
  navState: { pathname: '/admin/users', searchParamsString: '' },
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  pushSuccessToastMock: vi.fn(),
  pushErrorToastMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
  usePathname: () => navState.pathname,
  useSearchParams: () => new URLSearchParams(navState.searchParamsString),
}));
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ pushSuccessToast: pushSuccessToastMock, pushErrorToast: pushErrorToastMock }),
}));

import { UserManager } from '@/components/dashboard/UserManager';

const tenants: TenantRecord[] = [
  { id: 'tenant_1', name: 'Acme', tier: 'growth', status: 'healthy', region: 'us-east-1', apps: 1, users: 2, monthlySpendUsd: 1200, eventQuotaDaily: 50000 },
  { id: 'tenant_2', name: 'Nova', tier: 'starter', status: 'healthy', region: 'eu-west-1', apps: 1, users: 1, monthlySpendUsd: 200, eventQuotaDaily: 15000 },
];
const apps: AppRecord[] = [
  { id: 'app_1', tenantId: 'tenant_1', name: 'Acme Web', runtime: 'pwa', environment: 'production', status: 'healthy', region: 'global', agentsAttached: 2 },
  { id: 'app_2', tenantId: 'tenant_2', name: 'Nova Admin', runtime: 'admin', environment: 'staging', status: 'healthy', region: 'eu-west-1', agentsAttached: 1 },
];
const user: UserRecord = { id: 'user_1', tenantId: 'tenant_1', appId: 'app_1', name: 'Taylor', role: 'viewer', status: 'active', lastSeenAt: '2026-03-09T00:00:00.000Z' };
const pageInfo: PaginationInfo = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 };
const roleOptions: PlatformRole[] = ['viewer', 'tenant_admin'];

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  navState.searchParamsString = '';
});

describe('UserManager', () => {
  it('applies user filters through router.replace', () => {
    render(<UserManager users={[]} apps={apps} tenants={tenants} roleOptions={roleOptions} canManage={false} pageInfo={{ ...pageInfo, totalItems: 0 }} query={{ query: '' }} />);

    fireEvent.change(screen.getByRole('textbox', { name: /search users/i }), { target: { value: 'taylor' } });
    fireEvent.change(screen.getByRole('combobox', { name: /^status$/i }), { target: { value: 'active' } });
    fireEvent.change(screen.getByRole('combobox', { name: /^role$/i }), { target: { value: 'tenant_admin' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(replaceMock).toHaveBeenCalledWith('/admin/users?q=taylor&status=active&role=tenant_admin');
  });

  it('switches form apps by tenant, creates a user, and saves row edits', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<UserManager users={[user]} apps={apps} tenants={tenants} roleOptions={roleOptions} canManage pageInfo={pageInfo} query={{ query: '' }} />);

    const formSelects = screen.getAllByRole('combobox').slice(0, 4);
    fireEvent.change(formSelects[0]!, { target: { value: 'tenant_2' } });
    expect(within(formSelects[1]!).getByRole('option', { name: 'Nova Admin' })).toBeInTheDocument();
    expect(within(formSelects[1]!).queryByRole('option', { name: 'Acme Web' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('User name'), { target: { value: 'Jordan' } });
    fireEvent.click(screen.getByRole('button', { name: /add user/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ tenantId: 'tenant_2', appId: 'app_2', name: 'Jordan', role: 'viewer', status: 'invited' });
    expect(pushSuccessToastMock).toHaveBeenCalledWith('User created', 'Jordan was added to the directory.');

    const row = within(screen.getByRole('table', { name: /user directory table/i })).getAllByRole('row')[1]!;
    fireEvent.change(within(row).getByDisplayValue('Active'), { target: { value: 'suspended' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/users/user_1', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ appId: 'app_1', role: 'viewer', status: 'suspended' });
    expect(pushSuccessToastMock).toHaveBeenCalledWith('User updated', 'Taylor was saved successfully.');
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});

