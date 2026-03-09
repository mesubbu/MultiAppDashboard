'use client';

import { Activity, BrainCircuit, RefreshCw, Server } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { appendObservabilitySnapshot, buildObservabilityLiveSnapshot, type ObservabilityLiveSnapshot } from '@/lib/observability-live-charts';
import { cn, formatCompactNumber, formatDateTime } from '@/lib/utils';
import { modelListResponseSchema, observabilityResponseSchema, overviewResponseSchema } from '@/types/contracts';

const POLL_INTERVAL_MS = 30_000;

async function fetchLiveSnapshot() {
  const [overviewResponse, observabilityResponse, modelsResponse] = await Promise.all([
    fetch('/api/admin/overview', { cache: 'no-store' }),
    fetch('/api/admin/observability', { cache: 'no-store' }),
    fetch('/api/admin/models', { cache: 'no-store' }),
  ]);
  if (!overviewResponse.ok || !observabilityResponse.ok || !modelsResponse.ok) {
    throw new Error('Unable to refresh live observability metrics.');
  }

  return buildObservabilityLiveSnapshot({
    overview: overviewResponseSchema.parse(await overviewResponse.json()),
    observability: observabilityResponseSchema.parse(await observabilityResponse.json()),
    models: modelListResponseSchema.parse(await modelsResponse.json()),
  });
}

function Sparkline({ values, strokeClassName }: { values: number[]; strokeClassName: string }) {
  const safeValues = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues
    .map((value, index) => `${(index / (safeValues.length - 1)) * 100},${100 - ((value - min) / range) * 100}`)
    .join(' ');

  return <svg viewBox="0 0 100 100" className="h-24 w-full" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="5" vectorEffect="non-scaling-stroke" className={strokeClassName} /></svg>;
}

export function LiveObservabilityCharts({ initialSnapshot }: { initialSnapshot: ObservabilityLiveSnapshot }) {
  const [history, setHistory] = useState([initialSnapshot]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        setIsRefreshing(true);
        const next = await fetchLiveSnapshot();
        if (!cancelled) {
          setHistory((current) => appendObservabilitySnapshot(current, next));
          setError(null);
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh live observability metrics.');
        }
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const latest = history.at(-1) ?? initialSnapshot;

  return (
    <SectionCard title="Live infrastructure charts" description="30-second polling snapshots for queue backlog, service saturation, and active model latency.">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="flex items-center gap-2"><RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin text-cyan-300')} /><span>Last updated {formatDateTime(latest.capturedAt)}</span></div>
        <span>{history.length} recent samples retained</span>
      </div>
      {error ? <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-cyan-300"><Activity className="h-4 w-4" /><h4 className="text-sm font-medium text-white">Queue backlog trend</h4></div>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCompactNumber(latest.queueBacklog)}</p>
          <p className="mt-1 text-sm text-slate-400">{latest.runningAgents} running agents · {latest.liveEventsPerMinute}/min live events</p>
          <div className="mt-4 rounded-2xl border border-white/5 bg-slate-900/80 px-2 py-1 text-cyan-300"><Sparkline values={history.map((snapshot) => snapshot.queueBacklog)} strokeClassName="text-cyan-300" /></div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-emerald-300"><Server className="h-4 w-4" /><h4 className="text-sm font-medium text-white">Container CPU / memory</h4></div>
          <div className="mt-4 space-y-4">
            {latest.services.map((service) => (
              <div key={service.name} className="space-y-2">
                <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">{service.name}</p><p className="text-xs text-slate-500">CPU {service.cpuPercent}% · Memory {service.memoryPercent}%</p></div><StatusBadge value={service.status} /></div>
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-cyan-400" style={{ width: `${Math.min(100, service.cpuPercent)}%` }} /></div>
                  <div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, service.memoryPercent)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 text-violet-300"><BrainCircuit className="h-4 w-4" /><h4 className="text-sm font-medium text-white">AI latency</h4></div>
          <div className="mt-4 space-y-4">
            {latest.models.map((model) => (
              <div key={model.key} className="space-y-2">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-white">{model.service}</p><p className="text-xs text-slate-500">{model.activeModel}</p></div><span className="text-sm text-slate-300">{model.latencyMs} ms</span></div>
                <div className="h-2 rounded-full bg-white/5"><div className="h-2 rounded-full bg-violet-400" style={{ width: `${Math.min(100, model.latencyMs / 12)}%` }} /></div>
                <p className="text-xs text-slate-500">Error rate {(model.errorRate * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </SectionCard>
  );
}