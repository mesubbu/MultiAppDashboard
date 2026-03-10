import { Suspense } from 'react';

import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockRuns = [
  { id: 'rr_01', name: 'RSS Market Feed Collection', status: 'completed', source: 'rss', artifacts: 24, duration: '3m 12s', startedAt: '2026-03-10T06:00:00Z' },
  { id: 'rr_02', name: 'Competitor Pricing Crawl', status: 'running', source: 'web_page', artifacts: 8, duration: '1m 45s', startedAt: '2026-03-10T07:15:00Z' },
  { id: 'rr_03', name: 'Platform Activity Analysis', status: 'completed', source: 'platform_activity', artifacts: 156, duration: '5m 28s', startedAt: '2026-03-09T18:00:00Z' },
  { id: 'rr_04', name: 'Market API Data Pull', status: 'failed', source: 'market_api', artifacts: 0, duration: '0m 42s', startedAt: '2026-03-10T04:00:00Z' },
  { id: 'rr_05', name: 'Regional Trend Snapshot', status: 'scheduled', source: 'rss', artifacts: 0, duration: '-', startedAt: '2026-03-11T00:00:00Z' },
];

const mockSchedules = [
  { id: 'sched_01', name: 'Daily RSS Collection', frequency: 'every 6 hours', nextRun: '2026-03-10T12:00:00Z', active: true },
  { id: 'sched_02', name: 'Weekly Competitor Crawl', frequency: 'weekly', nextRun: '2026-03-16T00:00:00Z', active: true },
  { id: 'sched_03', name: 'Monthly Market API Sync', frequency: 'monthly', nextRun: '2026-04-01T00:00:00Z', active: false },
];

function ResearchFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function ResearchContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total runs', value: mockRuns.length },
          { label: 'Completed', value: mockRuns.filter((r) => r.status === 'completed').length },
          { label: 'Active schedules', value: mockSchedules.filter((s) => s.active).length },
          { label: 'Artifacts collected', value: mockRuns.reduce((s, r) => s + r.artifacts, 0) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Schedules & triggers" description="Automated collection schedules and event-driven triggers.">
          <div className="space-y-3">
            {mockSchedules.map((sched) => (
              <div key={sched.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">{sched.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{sched.frequency} · Next: {new Date(sched.nextRun).toLocaleDateString()}</p>
                </div>
                <StatusBadge value={sched.active ? 'active' : 'inactive'} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Run launch" description="Trigger a manual research collection run.">
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-sm text-slate-400">Select a source type and parameters to launch a new research run.</p>
            <button
              type="button"
              className="mt-4 inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              Launch research run
            </button>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Research runs" description="History of manual and scheduled research collection runs with status and artifact counts.">
        <div className="space-y-3">
          {mockRuns.map((run) => (
            <div key={run.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">{run.name}</h3>
                    <StatusBadge value={run.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Source: {run.source.replace(/_/g, ' ')}</span>
                    <span>{run.artifacts} artifacts</span>
                    <span>Duration: {run.duration}</span>
                    <span>{new Date(run.startedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Research Operations"
        description="Launch, schedule, and manage research collection runs with source tracking and artifact management."
      />
      <Suspense fallback={<ResearchFallback />}>
        <ResearchContent />
      </Suspense>
    </div>
  );
}
