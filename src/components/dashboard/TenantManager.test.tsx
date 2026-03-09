import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PaginationInfo, TenantRecord } from '@/types/platform';

const { navState, replaceMock, refreshMock, pushSuccessToastMock, pushErrorToastMock } = vi.hoisted(() => ({
  navState: { pathname: '/admin/tenants', searchParamsString: '' },
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

import { TenantManager } from '@/components/dashboard/TenantManager';

const tenant: TenantRecord = { id: 'tenant_1', name: 'Acme', tier: 'growth', status: 'healthy', region: 'us-east-1', apps: 2, users: 12, monthlySpendUsd: 1200, eventQuotaDaily: 25000 };
const pageInfo: PaginationInfo = { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  navState.searchParamsString = '';
});

describe('TenantManager', () => {
  it('applies tenant filters through router.replace', () => {
    render(<TenantManager tenants={[]} canManage={false} pageInfo={{ ...pageInfo, totalItems: 0 }} query={{ query: '' }} />);

    fireEvent.change(screen.getByRole('textbox', { name: /search tenants/i }), { target: { value: 'acme' } });
    fireEvent.change(screen.getByRole('combobox', { name: /status/i }), { target: { value: 'critical' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(replaceMock).toHaveBeenCalledWith('/admin/tenants?q=acme&status=critical');
  });

  it('creates a tenant and saves quota edits', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    render(<TenantManager tenants={[tenant]} canManage pageInfo={pageInfo} query={{ query: '' }} />);

    fireEvent.change(screen.getByPlaceholderText('New tenant name'), { target: { value: 'Northwind' } });
    fireEvent.change(screen.getByPlaceholderText('Region'), { target: { value: 'eu-west-1' } });
    fireEvent.change(screen.getByPlaceholderText('Quota / day'), { target: { value: '60000' } });
    fireEvent.click(screen.getByRole('button', { name: /create tenant/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ name: 'Northwind', tier: 'starter', status: 'healthy', region: 'eu-west-1', monthlySpendUsd: 0, eventQuotaDaily: 60000 });
    expect(pushSuccessToastMock).toHaveBeenCalledWith('Tenant created', 'Northwind is now available in the fleet.');

    const row = within(screen.getByRole('table', { name: /tenant fleet table/i })).getAllByRole('row')[1]!;
    fireEvent.change(within(row).getByDisplayValue('25000'), { target: { value: '50000' } });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/admin/tenants/tenant_1', expect.objectContaining({ method: 'PATCH' }));
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ name: 'Acme', tier: 'growth', status: 'healthy', region: 'us-east-1', eventQuotaDaily: 50000 });
    expect(pushSuccessToastMock).toHaveBeenCalledWith('Tenant updated', 'Acme was saved successfully.');
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});

