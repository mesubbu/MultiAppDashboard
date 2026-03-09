import { Activity, ExternalLink, Logs, PanelsTopLeft } from 'lucide-react';
import { Suspense, cache } from 'react';

import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { ClientErrorsTable } from '@/components/dashboard/ClientErrorsTable';
import { LiveObservabilityCharts } from '@/components/dashboard/LiveObservabilityCharts';
import { ObservabilityTable } from '@/components/dashboard/ObservabilityTable';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { buildObservabilityLiveSnapshot } from '@/lib/observability-live-charts';
import {
  buildObservabilityIntegrationConfig,
  buildServiceObservabilityLinks,
} from '@/lib/observability-links';
import { controlPlaneService } from '@/services/control-plane';

const getObservabilityData = cache(() => controlPlaneService.getObservability());
const getOverviewData = cache(() => controlPlaneService.getOverview());
const getModelsData = cache(() => controlPlaneService.getModels());
const getObservabilityIntegrations = cache(() =>
  buildObservabilityIntegrationConfig({
    OBSERVABILITY_GRAFANA_DASHBOARD_URL: process.env.OBSERVABILITY_GRAFANA_DASHBOARD_URL,
    OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: process.env.OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL,
    OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: process.env.OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL,
    OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: process.env.OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE,
    OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: process.env.OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE,
    OBSERVABILITY_PROMETHEUS_URL: process.env.OBSERVABILITY_PROMETHEUS_URL,
  }),
);

function MetricsCardsFallback() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/10">
          <Skeleton className="h-4 w-24" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function TableFallback() {
  return (
    <SectionCard title="Service health" description="Container and API health aligned to Prometheus and Grafana dashboards.">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </SectionCard>
  );
}

function ClientErrorTableFallback() {
  return (
    <SectionCard title="Recent client errors" description="Latest browser-side failures captured by the dashboard boundary and global listeners.">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </SectionCard>
  );
}

function LiveChartsFallback() {
  return (
    <SectionCard title="Live infrastructure charts" description="30-second polling snapshots for queue backlog, service saturation, and active model latency.">
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-8 w-24" />
            <Skeleton className="mt-3 h-24 w-full" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function ObservabilityMetricsSection() {
  const observability = await getObservabilityData();

  return (
    <MetricsCards
      items={[
        { label: 'Healthy services', value: `${observability.items.filter((service) => service.status === 'healthy').length}`, delta: '+1', trend: 'up', description: 'Services currently meeting SLO thresholds.' },
        { label: 'Degraded services', value: `${observability.items.filter((service) => service.status !== 'healthy').length}`, delta: '-1', trend: 'down', description: 'Services requiring active operations attention.' },
        { label: 'Avg CPU', value: `${Math.round(observability.items.reduce((sum, service) => sum + service.cpuPercent, 0) / observability.items.length)}%`, delta: '-3%', trend: 'down', description: 'Average CPU usage across monitored services.' },
        { label: 'Restarts / 24h', value: `${observability.items.reduce((sum, service) => sum + service.restarts24h, 0)}`, delta: '-2', trend: 'down', description: 'Process restarts across the monitored fleet.' },
      ]}
    />
  );
}

async function ObservabilityTableSection() {
  const observability = await getObservabilityData();
  const integrations = getObservabilityIntegrations();
  const linksByService = Object.fromEntries(
    observability.items.map((service) => [service.name, buildServiceObservabilityLinks(service, integrations)]),
  );

  return (
    <SectionCard title="Service health" description="Container and API health aligned to Prometheus and Grafana dashboards, with status derived from configured CPU, memory, and restart thresholds.">
      <ObservabilityTable items={observability.items} linksByService={linksByService} />
    </SectionCard>
  );
}

async function ClientErrorsSection() {
  const observability = await getObservabilityData();

  return (
    <SectionCard
      title="Recent client errors"
      description="Latest browser-side failures captured by the dashboard boundary and global listeners."
    >
      <ClientErrorsTable items={observability.clientErrors} />
    </SectionCard>
  );
}

async function LiveChartsSection() {
  const [overview, observability, models] = await Promise.all([
    getOverviewData(),
    getObservabilityData(),
    getModelsData(),
  ]);

  return (
    <LiveObservabilityCharts
      initialSnapshot={buildObservabilityLiveSnapshot({ overview, observability, models })}
    />
  );
}

function EmbeddedDashboardsSection() {
  const integrations = getObservabilityIntegrations();

  if (integrations.grafanaEmbeds.length === 0) {
    return (
      <SectionCard
        title="Embedded Grafana panels"
        description="Configure Grafana panel URLs to embed live fleet health and alert views directly in this dashboard."
      >
        <p className="text-sm leading-6 text-slate-400">
          Set `OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL` and/or `OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL` to render live Grafana panels here.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Embedded Grafana panels" description="Live dashboards embedded from Grafana for operators who need fast incident context.">
      <div className="grid gap-6 xl:grid-cols-2">
        {integrations.grafanaEmbeds.map((panel) => (
          <article key={panel.src} className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-white">{panel.title}</h4>
              <p className="mt-1 text-sm text-slate-400">{panel.description}</p>
            </div>
            <iframe title={panel.title} src={panel.src} className="h-80 w-full rounded-2xl border border-white/10 bg-slate-900" loading="lazy" />
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function ObservabilityToolsSection() {
  const integrations = getObservabilityIntegrations();
  const tools = [
    {
      name: 'Grafana',
      description: 'Open the fleet dashboard, drill into service panels, and pivot from service rows into dashboard context.',
      href: integrations.grafanaDashboardUrl,
      icon: PanelsTopLeft,
      missingMessage: 'Set `OBSERVABILITY_GRAFANA_DASHBOARD_URL` to link this card to your shared dashboard.',
    },
    {
      name: 'Loki',
      description: 'Use row-level deep links to jump straight into scoped service logs for incident investigation.',
      href: undefined,
      icon: Logs,
      missingMessage: 'Set `OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE` to enable per-service log exploration links.',
    },
    {
      name: 'Prometheus',
      description: 'Open the metrics source of truth for ad-hoc queries and alert rule inspection.',
      href: integrations.prometheusUrl,
      icon: Activity,
      missingMessage: 'Set `OBSERVABILITY_PROMETHEUS_URL` to provide a direct metrics jump-off point.',
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <SectionCard key={tool.name} title={tool.name} description={tool.description}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-cyan-300"><Icon className="h-4 w-4" /><span className="text-sm font-medium">Integration target</span></div>
              <p className="text-sm leading-6 text-slate-400">{tool.href ? 'Open the external tool in a new tab.' : tool.missingMessage}</p>
              {tool.href ? (
                <a href={tool.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300 hover:text-white">
                  Open {tool.name}
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

export default async function ObservabilityPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Observability" description="Prometheus, Grafana, and Loki-aligned health and backlog monitoring for the entire AI-native platform." />
      <Suspense fallback={<MetricsCardsFallback />}>
        <ObservabilityMetricsSection />
      </Suspense>
      <Suspense fallback={<TableFallback />}>
        <ObservabilityTableSection />
      </Suspense>
      <Suspense fallback={<LiveChartsFallback />}>
        <LiveChartsSection />
      </Suspense>
      <Suspense fallback={<ClientErrorTableFallback />}>
        <ClientErrorsSection />
      </Suspense>
      <EmbeddedDashboardsSection />
      <ObservabilityToolsSection />
    </div>
  );
}
