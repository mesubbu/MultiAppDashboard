'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ClientDataTable, type ClientDataTableColumn } from '@/components/ui/ClientDataTable';
import type { AuditRecord, PaginationInfo } from '@/types/platform';

const columns: ClientDataTableColumn<AuditRecord>[] = [
  { key: 'timestamp', header: 'When', render: (row) => new Date(row.timestamp).toLocaleString(), sortValue: (row) => row.timestamp },
  { key: 'actor', header: 'Actor', render: (row) => row.actorDisplay ?? row.actor, sortValue: (row) => row.actorDisplay ?? row.actor },
  { key: 'action', header: 'Action', render: (row) => <span className="rounded-full border border-cyan-500/30 px-2 py-1 text-xs text-cyan-200">{row.action}</span>, sortValue: (row) => row.action },
  { key: 'resource', header: 'Resource', render: (row) => <div><div>{row.resourceId}</div><div className="text-xs text-slate-400">{row.resourceType}</div></div>, sortValue: (row) => `${row.resourceType}:${row.resourceId}` },
  { key: 'scope', header: 'Scope', render: (row) => <div className="text-xs text-slate-300">{row.tenantId ?? 'platform'}{row.appId ? ` / ${row.appId}` : ''}</div>, sortValue: (row) => `${row.tenantId ?? ''}:${row.appId ?? ''}` },
  { key: 'summary', header: 'Summary', render: (row) => row.summary ?? '—', sortValue: (row) => row.summary ?? '' },
];

function setListParam(searchParams: URLSearchParams, key: string, value: string | null) {
  if (!value) searchParams.delete(key);
  else searchParams.set(key, value);
  searchParams.delete('cursor');
}

export function AuditLogTable({ rows, pageInfo }: { rows: AuditRecord[]; pageInfo: PaginationInfo }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <ClientDataTable
      ariaLabel="Audit log"
      caption="Administrative and runtime changes across the platform"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      serverPagination={{
        page: pageInfo.page,
        pageSize: pageInfo.pageSize,
        totalItems: pageInfo.totalItems,
        totalPages: pageInfo.totalPages,
        onPageChange: (page) => {
          const next = new URLSearchParams(searchParams.toString());
          setListParam(next, 'page', `${page}`);
          router.replace(`${pathname}?${next.toString()}` as never);
        },
        onPageSizeChange: (pageSize) => {
          const next = new URLSearchParams(searchParams.toString());
          setListParam(next, 'page_size', `${pageSize}`);
          setListParam(next, 'page', '1');
          router.replace(`${pathname}?${next.toString()}` as never);
        },
      }}
    />
  );
}