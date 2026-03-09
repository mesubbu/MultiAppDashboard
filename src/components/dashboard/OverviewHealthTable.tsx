'use client';

import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ServiceHealth } from '@/types/platform';

export function OverviewHealthTable({ items }: { items: ServiceHealth[] }) {
  return (
    <ClientDataTable
      ariaLabel="Overview service health table"
      caption="Compact service health snapshot for the platform overview page."
      rows={items}
      rowKey={(service) => service.name}
      pageSize={4}
      pageSizeOptions={[4, 8, 16]}
      initialSort={{ key: 'status', direction: 'asc' }}
      columns={[
        {
          key: 'name',
          header: 'Service',
          sortValue: (service) => service.name,
          render: (service) => <span className="font-medium text-white">{service.name}</span>,
        },
        {
          key: 'layer',
          header: 'Layer',
          sortValue: (service) => service.layer,
          render: (service) => service.layer,
        },
        {
          key: 'status',
          header: 'Status',
          sortValue: (service) => service.status,
          render: (service) => <StatusBadge value={service.status} />,
        },
        {
          key: 'restarts',
          header: 'Restarts',
          sortValue: (service) => service.restarts24h,
          render: (service) => service.restarts24h,
        },
      ]}
    />
  );
}
