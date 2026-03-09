import { Suspense, cache } from 'react';

import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { ModelMonitor } from '@/components/dashboard/ModelMonitor';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';

const getModelsData = cache(() => controlPlaneService.getModels());

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

async function ModelsMetricsSection() {
  const models = await getModelsData();

  return (
    <MetricsCards
      items={[
        { label: 'Model services', value: `${models.items.length}`, delta: 'flat', trend: 'flat', description: 'Planner, SQL, agent, and embedding orchestration services.' },
        { label: 'Avg latency', value: `${Math.round(models.items.reduce((sum, model) => sum + model.latencyMs, 0) / models.items.length)} ms`, delta: '-4%', trend: 'down', description: 'Average model latency across services.' },
        { label: 'Hourly tokens', value: `${Math.round(models.items.reduce((sum, model) => sum + model.tokenUsage1h, 0) / 1000)}k`, delta: '+6%', trend: 'up', description: 'Aggregate token throughput over the last hour.' },
        { label: 'Switch candidates', value: `${models.items.reduce((sum, model) => sum + model.candidates.length, 0)}`, delta: '+1', trend: 'up', description: 'Configured fallback and candidate models ready for switching.' },
      ]}
    />
  );
}

async function ModelsMonitorSection({ canSwitch }: { canSwitch: boolean }) {
  const models = await getModelsData();

  return (
    <ModelMonitor
      key={models.items.map((model) => `${model.key}:${model.activeModel}`).join('|')}
      models={models.items}
      canSwitch={canSwitch}
    />
  );
}

export default async function ModelsPage() {
  const session = await requireCurrentSession();

  return (
    <div className="space-y-6">
      <PageHeader title="AI Models" description="Monitor planner, SQL, agent, and embedding models for latency, token burn, error rate, and active routing." />
      <Suspense fallback={<MetricsCardsFallback />}>
        <ModelsMetricsSection />
      </Suspense>
      <Suspense fallback={<SectionFallback title="Model routing" description="Preparing active models, latency rollups, and switch candidates." rows={4} />}>
        <ModelsMonitorSection canSwitch={hasPermission(session.user.roles, 'models:switch')} />
      </Suspense>
    </div>
  );
}
