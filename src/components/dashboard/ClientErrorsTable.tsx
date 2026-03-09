'use client';

import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { formatDateTime } from '@/lib/utils';
import type { ClientErrorRecord } from '@/types/platform';

export function ClientErrorsTable({ items }: { items: ClientErrorRecord[] }) {
  return (
    <ClientDataTable
      ariaLabel="Recent client errors"
      caption="Recent browser-side failures captured by dashboard boundaries and global error listeners."
      rows={items}
      rowKey={(item) => item.id}
      pageSize={5}
      pageSizeOptions={[5, 10, 20]}
      initialSort={{ key: 'occurredAt', direction: 'desc' }}
      columns={[
        {
          key: 'occurredAt',
          header: 'Occurred',
          sortValue: (item) => new Date(item.occurredAt),
          render: (item) => formatDateTime(item.occurredAt),
        },
        {
          key: 'kind',
          header: 'Kind',
          sortValue: (item) => item.kind,
          render: (item) => <span className="capitalize">{item.kind.replace('-', ' ')}</span>,
        },
        {
          key: 'source',
          header: 'Source',
          sortValue: (item) => item.source,
          render: (item) => (
            <div>
              <p className="font-medium text-white">{item.source}</p>
              <p className="text-xs text-slate-500">{item.pathname ?? 'No route captured'}</p>
            </div>
          ),
        },
        {
          key: 'message',
          header: 'Message',
          sortValue: (item) => item.message,
          render: (item) => (
            <div>
              <p className="font-medium text-white">{item.name}</p>
              <p className="text-sm text-slate-400">{item.message}</p>
              {item.digest ? <p className="text-xs text-slate-500">digest: {item.digest}</p> : null}
            </div>
          ),
        },
        {
          key: 'scope',
          header: 'Scope',
          sortValue: (item) => `${item.tenantId ?? ''}:${item.appId ?? ''}`,
          render: (item) => (
            <div className="text-xs text-slate-400">
              <p>{item.tenantId ?? 'platform'}</p>
              <p>{item.appId ?? 'all apps'}</p>
            </div>
          ),
        },
      ]}
    />
  );
}