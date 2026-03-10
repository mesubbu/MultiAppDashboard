import { Suspense } from 'react';

import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockWorkflows = [
  { id: 'wf_01', name: 'Market Research Pipeline', status: 'running', participants: 3, stage: 'collection', scheduled: '2026-03-10T06:00:00Z', lastUpdate: '2026-03-10T07:15:00Z' },
  { id: 'wf_02', name: 'Competitor Analysis Sweep', status: 'completed', participants: 2, stage: 'aggregation', scheduled: '2026-03-09T18:00:00Z', lastUpdate: '2026-03-09T20:42:00Z' },
  { id: 'wf_03', name: 'Quarterly Insight Generation', status: 'scheduled', participants: 4, stage: 'pending', scheduled: '2026-03-11T00:00:00Z', lastUpdate: '2026-03-09T14:00:00Z' },
  { id: 'wf_04', name: 'Regional Price Signal Monitor', status: 'paused', participants: 1, stage: 'collection', scheduled: '2026-03-10T04:00:00Z', lastUpdate: '2026-03-10T05:30:00Z' },
];

function WorkflowsFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

function WorkflowsContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Running', value: mockWorkflows.filter((w) => w.status === 'running').length },
          { label: 'Scheduled', value: mockWorkflows.filter((w) => w.status === 'scheduled').length },
          { label: 'Completed', value: mockWorkflows.filter((w) => w.status === 'completed').length },
          { label: 'Total participants', value: mockWorkflows.reduce((s, w) => s + w.participants, 0) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Workflow registry" description="Multi-agent workflows, scheduling, lifecycle state, and aggregated outcomes.">
        <div className="space-y-3">
          {mockWorkflows.map((wf) => (
            <div key={wf.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">{wf.name}</h3>
                    <StatusBadge value={wf.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>{wf.participants} participant{wf.participants !== 1 ? 's' : ''}</span>
                    <span>Stage: {wf.stage}</span>
                    <span>Scheduled: {new Date(wf.scheduled).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {wf.status === 'running' ? (
                    <button type="button" className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5">Pause</button>
                  ) : null}
                  {wf.status === 'paused' ? (
                    <button type="button" className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5">Resume</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow Orchestrator"
        description="Coordinate multi-agent workflows, manage schedules and lifecycle, and review aggregated outcomes."
      />
      <Suspense fallback={<WorkflowsFallback />}>
        <WorkflowsContent />
      </Suspense>
    </div>
  );
}
