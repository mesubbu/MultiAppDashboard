import { Suspense } from 'react';

import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockAlerts = [
  { id: 'alert_01', title: 'Agent budget burn rate exceeds 90%', summary: 'Agent agent_research_01 has consumed 93% of its hourly budget allocation.', severity: 'critical', status: 'active', source: 'agent_monitor', timestamp: '2026-03-10T07:22:00Z', owner: null },
  { id: 'alert_02', title: 'Model latency spike on planner route', summary: 'The planner model is responding with p95 latency exceeding 4.2s threshold.', severity: 'warning', status: 'active', source: 'model_monitor', timestamp: '2026-03-10T07:18:00Z', owner: null },
  { id: 'alert_03', title: 'Event queue backlog growing', summary: 'The events outbox has accumulated 1,247 undelivered events in the last 15 minutes.', severity: 'warning', status: 'acknowledged', source: 'observability', timestamp: '2026-03-10T06:58:00Z', owner: 'ops@platform.local' },
  { id: 'alert_04', title: 'Tenant quota approaching limit', summary: 'Acme Corp daily event quota is at 92% utilization with 6 hours remaining.', severity: 'info', status: 'active', source: 'tenant_monitor', timestamp: '2026-03-10T06:45:00Z', owner: null },
  { id: 'alert_05', title: 'Research run degraded output', summary: 'Research run rr_2026030901 completed with 3 sources failing collection.', severity: 'warning', status: 'resolved', source: 'research_agent', timestamp: '2026-03-10T05:30:00Z', owner: 'admin@platform.local' },
];

function AlertsFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full" />
      ))}
    </div>
  );
}

function AlertsContent() {
  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Critical', value: mockAlerts.filter((a) => a.severity === 'critical').length, color: 'text-rose-300' },
          { label: 'Warnings', value: mockAlerts.filter((a) => a.severity === 'warning').length, color: 'text-amber-300' },
          { label: 'Active', value: mockAlerts.filter((a) => a.status === 'active').length, color: 'text-cyan-300' },
          { label: 'Resolved', value: mockAlerts.filter((a) => a.status === 'resolved').length, color: 'text-emerald-300' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts list */}
      <SectionCard title="Alert feed" description="Active and recent alerts across the platform with severity, ownership, and investigation links.">
        <div className="space-y-3">
          {mockAlerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">{alert.title}</h3>
                    <StatusBadge value={alert.severity} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{alert.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span>Source: {alert.source.replace(/_/g, ' ')}</span>
                    <span>Status: {alert.status}</span>
                    {alert.owner ? <span>Owner: {alert.owner}</span> : null}
                    <span>{new Date(alert.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {alert.status === 'active' ? (
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5"
                    >
                      Acknowledge
                    </button>
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

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts Inbox"
        description="Centralized alert management with severity filtering, ownership tracking, and investigation deep links."
      />
      <Suspense fallback={<AlertsFallback />}>
        <AlertsContent />
      </Suspense>
    </div>
  );
}
