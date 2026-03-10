import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockIncident = {
  id: 'INC-4821',
  title: 'Agent budget exceeded with cascading queue backlog',
  status: 'investigating',
  severity: 'critical',
  owner: 'ops@platform.local',
  createdAt: '2026-03-10T06:45:00Z',
  updatedAt: '2026-03-10T07:22:00Z',
  summary: 'Research agent exceeded its hourly budget, causing tasks to queue. Downstream insight and recommendation agents are now blocked waiting for research outputs.',
  timeline: [
    { time: '2026-03-10T06:45:00Z', event: 'Agent agent_research_01 budget utilization crossed 90% threshold', source: 'agent_monitor' },
    { time: '2026-03-10T06:52:00Z', event: 'Alert ALR-1142 fired: budget burn rate critical', source: 'alerting' },
    { time: '2026-03-10T07:00:00Z', event: 'Queue depth for agent_research_01 exceeded 50 items', source: 'queue_monitor' },
    { time: '2026-03-10T07:05:00Z', event: 'Downstream agent agent_insight_01 entered blocked state', source: 'orchestrator' },
    { time: '2026-03-10T07:15:00Z', event: 'Incident created and assigned to ops@platform.local', source: 'incident_mgmt' },
  ],
  affectedEntities: [
    { type: 'Agent', name: 'agent_research_01', status: 'over_budget' },
    { type: 'Agent', name: 'agent_insight_01', status: 'blocked' },
    { type: 'Agent', name: 'agent_recommendation_01', status: 'idle' },
    { type: 'Workflow', name: 'Market Research Pipeline', status: 'degraded' },
  ],
};

export default function IncidentDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Incident ${mockIncident.id}`}
        description={mockIncident.title}
      />

      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={mockIncident.severity} />
        <StatusBadge value={mockIncident.status} />
        <span className="text-sm text-slate-400">Owner: {mockIncident.owner}</span>
        <span className="text-xs text-slate-500">Created {new Date(mockIncident.createdAt).toLocaleString()}</span>
        <span className="text-xs text-slate-500">Updated {new Date(mockIncident.updatedAt).toLocaleString()}</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-slate-300">{mockIncident.summary}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Timeline */}
        <SectionCard title="Incident timeline" description="Chronological record of events, alerts, and state changes.">
          <div className="space-y-4">
            {mockIncident.timeline.map((entry, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full border-2 border-cyan-400 bg-slate-950" />
                  {index < mockIncident.timeline.length - 1 ? <div className="w-0.5 flex-1 bg-white/10" /> : null}
                </div>
                <div className="pb-4">
                  <p className="text-sm text-white">{entry.event}</p>
                  <div className="mt-1 flex gap-3 text-xs text-slate-500">
                    <span>{new Date(entry.time).toLocaleTimeString()}</span>
                    <span>{entry.source.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Affected entities */}
        <SectionCard title="Affected entities" description="Services, agents, and workflows impacted by this incident.">
          <div className="space-y-3">
            {mockIncident.affectedEntities.map((entity) => (
              <div key={entity.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">{entity.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{entity.type}</p>
                </div>
                <StatusBadge value={entity.status.replace(/_/g, ' ')} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <button type="button" className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400">
          Change status
        </button>
        <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5">
          Assign owner
        </button>
        <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5">
          Add note
        </button>
        <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5">
          Export summary
        </button>
      </div>
    </div>
  );
}
