import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AuditRecord, PaginationInfo } from '@/types/platform';

const replaceMock = vi.fn();
const pathname = '/audit';
const searchParams = new URLSearchParams('page=1&cursor=cursor_1&q=owner');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

import { AuditLogTable } from '@/components/dashboard/AuditLogTable';

const rows: AuditRecord[] = [
  {
    id: 'audit_1',
    actor: 'usr_owner',
    actorDisplay: 'Owner',
    action: 'tenant_update',
    resourceType: 'tenant',
    resourceId: 'tenant_acme',
    timestamp: '2026-03-09T12:00:00.000Z',
    tenantId: 'tenant_acme',
    appId: 'app_market_web',
    summary: 'Updated tenant quota',
  },
];

const pageInfo: PaginationInfo = { page: 1, pageSize: 20, totalItems: 40, totalPages: 2 };

describe('AuditLogTable', () => {
  it('renders rows and updates the route when paging forward', () => {
    render(<AuditLogTable rows={rows} pageInfo={pageInfo} />);

    expect(screen.getByRole('table', { name: /audit log/i })).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Updated tenant quota')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));

    expect(replaceMock).toHaveBeenCalledWith('/audit?page=2&q=owner');
  });
});

