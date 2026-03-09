'use client';

import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { formatCompactNumber, formatDateTime } from '@/lib/utils';
import type { MemoryRecord } from '@/types/platform';

export function MemoryRegistryTable({ items }: { items: MemoryRecord[] }) {
  return (
    <ClientDataTable
      ariaLabel="Memory registry table"
      caption="Memory stores and compaction metrics across tenants and apps."
      rows={items}
      rowKey={(item) => item.id}
      initialSort={{ key: 'records', direction: 'desc' }}
      columns={[
        {
          key: 'id',
          header: 'Memory ID',
          sortValue: (item) => item.id,
          render: (item) => <span className="font-medium text-white">{item.id}</span>,
        },
        {
          key: 'scope',
          header: 'Scope',
          sortValue: (item) => item.scope,
          render: (item) => <span className="capitalize">{item.scope}</span>,
        },
        {
          key: 'tenant',
          header: 'Tenant',
          sortValue: (item) => item.tenantId,
          render: (item) => item.tenantId,
        },
        {
          key: 'app',
          header: 'App',
          sortValue: (item) => item.appId,
          render: (item) => item.appId,
        },
        {
          key: 'records',
          header: 'Records',
          sortValue: (item) => item.records,
          render: (item) => formatCompactNumber(item.records),
        },
        {
          key: 'vectors',
          header: 'Vectors',
          sortValue: (item) => item.vectorCount,
          render: (item) => formatCompactNumber(item.vectorCount),
        },
        {
          key: 'compaction',
          header: 'Last compaction',
          sortValue: (item) => (item.lastCompactionAt ? new Date(item.lastCompactionAt) : null),
          render: (item) => formatDateTime(item.lastCompactionAt),
        },
      ]}
    />
  );
}
