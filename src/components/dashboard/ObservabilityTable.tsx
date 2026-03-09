'use client';

import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ServiceObservabilityLinks } from '@/lib/observability-links';
import type { ServiceHealth } from '@/types/platform';

function hasLinks(links: ServiceObservabilityLinks | undefined) {
  return Boolean(links?.grafana || links?.loki || links?.prometheus);
}

function formatThresholdMetric(metric: 'cpuPercent' | 'memoryPercent' | 'restarts24h') {
  return metric === 'cpuPercent' ? 'CPU' : metric === 'memoryPercent' ? 'Memory' : 'Restarts / 24h';
}

function renderThresholds(service: ServiceHealth) {
  if (!service.thresholds) {
    return <span className="text-xs text-slate-500">Defaults</span>;
  }

  return (
    <div className="space-y-1 text-xs text-slate-400">
      {Object.entries(service.thresholds).map(([metric, threshold]) =>
        threshold ? (
          <div key={metric}>
            {formatThresholdMetric(metric as 'cpuPercent' | 'memoryPercent' | 'restarts24h')} {threshold.degraded ?? '—'}/{threshold.critical ?? '—'}
          </div>
        ) : null,
      )}
    </div>
  );
}

function renderAlerts(service: ServiceHealth) {
  if (!service.alerts?.length) {
    return <span className="text-xs text-emerald-300">Within threshold</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {service.alerts.map((alert) => (
        <span
          key={`${service.name}-${alert.metric}-${alert.severity}`}
          className={alert.severity === 'critical' ? 'rounded-full border border-rose-400/30 px-2 py-1 text-xs text-rose-200' : 'rounded-full border border-amber-400/30 px-2 py-1 text-xs text-amber-200'}
          title={`${alert.actualValue} >= ${alert.thresholdValue}`}
        >
          {formatThresholdMetric(alert.metric)} {alert.severity}
        </span>
      ))}
    </div>
  );
}

export function ObservabilityTable({
  items,
  linksByService,
}: {
  items: ServiceHealth[];
  linksByService?: Record<string, ServiceObservabilityLinks>;
}) {
  const showLinksColumn = items.some((service) => hasLinks(linksByService?.[service.name]));

  return (
    <ClientDataTable
      ariaLabel="Service health table"
      caption="Service health aligned to Prometheus, Grafana, and Loki observability tooling."
      rows={items}
      rowKey={(service) => service.name}
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
          key: 'cpu',
          header: 'CPU',
          sortValue: (service) => service.cpuPercent,
          render: (service) => `${service.cpuPercent}%`,
        },
        {
          key: 'memory',
          header: 'Memory',
          sortValue: (service) => service.memoryPercent,
          render: (service) => `${service.memoryPercent}%`,
        },
        {
          key: 'thresholds',
          header: 'Thresholds',
          render: (service) => renderThresholds(service),
        },
        {
          key: 'alerts',
          header: 'Active alerts',
          sortValue: (service) => service.alerts?.length ?? 0,
          render: (service) => renderAlerts(service),
        },
        {
          key: 'endpoint',
          header: 'Endpoint',
          sortValue: (service) => service.endpoint,
          render: (service) => <span className="text-xs text-slate-400">{service.endpoint}</span>,
        },
        ...(showLinksColumn
          ? [
              {
                key: 'opsLinks',
                header: 'Ops links',
                render: (service: ServiceHealth) => {
                  const links = linksByService?.[service.name];
                  if (!hasLinks(links)) {
                    return <span className="text-xs text-slate-500">Not configured</span>;
                  }

                  return (
                    <div className="flex flex-wrap gap-2">
                      {links?.grafana ? (
                        <a href={links.grafana} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-400/30 px-2.5 py-1 text-xs text-cyan-200 transition hover:border-cyan-300 hover:text-white">
                          Grafana
                        </a>
                      ) : null}
                      {links?.loki ? (
                        <a href={links.loki} target="_blank" rel="noreferrer" className="rounded-full border border-fuchsia-400/30 px-2.5 py-1 text-xs text-fuchsia-200 transition hover:border-fuchsia-300 hover:text-white">
                          Loki
                        </a>
                      ) : null}
                      {links?.prometheus ? (
                        <a href={links.prometheus} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-200 transition hover:border-emerald-300 hover:text-white">
                          Prometheus
                        </a>
                      ) : null}
                    </div>
                  );
                },
              },
            ]
          : []),
      ]}
    />
  );
}
