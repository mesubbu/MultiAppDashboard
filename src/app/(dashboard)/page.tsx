import { Suspense, cache } from 'react';

import { EventStream } from '@/components/dashboard/EventStream';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { ModelMonitor } from '@/components/dashboard/ModelMonitor';
import { OverviewHealthTable } from '@/components/dashboard/OverviewHealthTable';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';

const getOverviewData = cache(() => controlPlaneService.getOverview());
const getEventsData = cache(() => controlPlaneService.getEvents());
const getModelsData = cache(() => controlPlaneService.getModels());
const getObservabilityData = cache(() => controlPlaneService.getObservability());

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

function SectionFallback({ title, description, rows = 4 }: { title: string; description: string; rows?: number }) {
  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </SectionCard>
  );
}

async function OverviewMetricsSection() {
  const overview = await getOverviewData();
  return <MetricsCards items={overview.metrics} />;
}

async function OverviewAlertsSection() {
  const overview = await getOverviewData();

  return (
    <SectionCard title="Operational alerts" description="Top issues surfaced by the control plane and orchestration services.">
      <div className="space-y-3">
        {overview.alerts.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-white">{alert.title}</p>
                <p className="mt-1 text-sm text-slate-400">{alert.summary}</p>
              </div>
              <StatusBadge value={alert.severity} />
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">source: {alert.source}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

async function OverviewHealthSection() {
  const observability = await getObservabilityData();

  return (
    <SectionCard title="Service health snapshot" description="Quick read of the most important control-plane and orchestration components.">
      <OverviewHealthTable items={observability.items} />
    </SectionCard>
  );
}

async function OverviewModelsSection({ canSwitch }: { canSwitch: boolean }) {
  const models = await getModelsData();

  return (
    <ModelMonitor
      key={models.items.map((model) => `${model.key}:${model.activeModel}`).join('|')}
      models={models.items}
      canSwitch={canSwitch}
    />
  );
}

async function OverviewEventsSection() {
  const events = await getEventsData();
  return <EventStream key={events.items.map((event) => event.id).join('|')} events={events.items} />;
}

export default async function OverviewPage() {
  const session = await requireCurrentSession();

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" description="Monitor the full AI-native platform from the edge layer through orchestration services, model routing, and observability integrations." />
      <Suspense fallback={<MetricsCardsFallback />}>
        <OverviewMetricsSection />
      </Suspense>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Suspense fallback={<SectionFallback title="Operational alerts" description="Top issues surfaced by the control plane and orchestration services." rows={4} />}>
          <OverviewAlertsSection />
        </Suspense>
        <Suspense fallback={<SectionFallback title="Service health snapshot" description="Quick read of the most important control-plane and orchestration components." rows={5} />}>
          <OverviewHealthSection />
        </Suspense>
      </div>
      <Suspense fallback={<SectionFallback title="AI model routing" description="Preparing model availability, latency, and candidate routing data." rows={4} />}>
        <OverviewModelsSection canSwitch={hasPermission(session.user.roles, 'models:switch')} />
      </Suspense>
      <Suspense fallback={<SectionFallback title="Live event stream" description="Preparing the latest operational events and triage filters." rows={6} />}>
        <OverviewEventsSection />
      </Suspense>
    </div>
  );
}
