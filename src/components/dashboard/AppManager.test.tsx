import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnchorHTMLAttributes } from 'react';

import type { AppRecord, PaginationInfo, TenantRecord } from '@/types/platform';

const {
  navState,
  replaceMock,
  refreshMock,
  pushSuccessToastMock,
  pushErrorToastMock,
} = vi.hoisted(() => ({
  navState: { pathname: '/admin/apps', searchParamsString: '' },
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
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({
    pushSuccessToast: pushSuccessToastMock,
    pushErrorToast: pushErrorToastMock,
  }),
}));

import { AppManager } from '@/components/dashboard/AppManager';

const tenant: TenantRecord = {
  id: 'tenant_1',
  name: 'Acme',
  tier: 'growth',
  status: 'healthy',
  region: 'us-east-1',
  apps: 2,
  users: 12,
  monthlySpendUsd: 1200,
  eventQuotaDaily: 50000,
};
const app: AppRecord = {
  id: 'app_1',
  tenantId: 'tenant_1',
  name: 'Alpha',
  runtime: 'pwa',
  environment: 'production',
  status: 'healthy',
  region: 'us-east-1',
  agentsAttached: 2,
};
const pageInfo: PaginationInfo = {
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  navState.searchParamsString = '';
});

describe('AppManager', () => {
  it('applies list filters through router.replace', () => {
    render(
      <AppManager
        apps={[]}
        tenants={[tenant]}
        canManage={false}
        pageInfo={pageInfo}
        query={{ query: '' }}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: /search apps/i }), {
      target: { value: 'alpha' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /status/i }), {
      target: { value: 'healthy' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /environment/i }), {
      target: { value: 'staging' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    expect(replaceMock).toHaveBeenCalledWith(
      '/admin/apps?q=alpha&status=healthy&environment=staging',
    );
  });

  it('creates a new app and saves row edits', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppManager
        apps={[app]}
        tenants={[tenant]}
        canManage
        pageInfo={pageInfo}
        query={{ query: '' }}
      />,
    );

    expect(screen.getByRole('link', { name: /observe/i })).toHaveAttribute(
      'href',
      '/apps/app_1',
    );

    fireEvent.change(screen.getByPlaceholderText('App name'), {
      target: { value: 'New Console' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create app/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/admin/apps',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      tenantId: 'tenant_1',
      name: 'New Console',
      runtime: 'pwa',
      environment: 'production',
      region: 'us-east-1',
      status: 'healthy',
      agentsAttached: 0,
    });
    expect(pushSuccessToastMock).toHaveBeenCalledWith(
      'Application created',
      'New Console was added successfully.',
    );
    expect(refreshMock).toHaveBeenCalledTimes(1);

    const row = within(
      screen.getByRole('table', { name: /application registry table/i }),
    ).getAllByRole('row')[1]!;
    fireEvent.change(within(row).getByDisplayValue('us-east-1'), {
      target: { value: 'ap-south-1' },
    });
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/admin/apps/app_1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(
      JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)),
    ).toMatchObject({
      name: 'Alpha',
      environment: 'production',
      status: 'healthy',
      region: 'ap-south-1',
    });
    expect(pushSuccessToastMock).toHaveBeenCalledWith(
      'Application updated',
      'Alpha was saved successfully.',
    );
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });
});
