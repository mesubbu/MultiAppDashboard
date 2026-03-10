import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockRecommendation = {
  id: 'rec_01',
  title: 'Increase research collection frequency for APAC feeds',
  status: 'pending',
  priority: 'high',
  confidence: 0.91,
  category: 'research_ops',
  createdAt: '2026-03-10T06:30:00Z',
  rationale: 'APAC market signal velocity is 3x higher than the current collection cadence. Multiple recent insight runs have flagged stale APAC data as a limiting factor in recommendation quality. Increasing the collection frequency from every 6 hours to every 2 hours would address 78% of the identified staleness issues.',
  supportingSignals: [
    { id: 'sig_01', title: 'Rising demand for AI-assisted pricing in APAC markets', confidence: 0.89 },
    { id: 'sig_03', title: 'Supply cost volatility increasing for raw materials category', confidence: 0.92 },
  ],
  impactedEntities: [
    { type: 'Schedule', name: 'Daily RSS Collection', change: 'Frequency change from 6h to 2h' },
    { type: 'Agent', name: 'agent_research_01', change: 'Increased task load ~3x' },
    { type: 'Budget', name: 'Research agent budget', change: 'Estimated 2.8x increase in token usage' },
  ],
  approvalHistory: [
    { action: 'created', actor: 'recommendation_agent', timestamp: '2026-03-10T06:30:00Z', note: 'Auto-generated from insight analysis' },
  ],
};

export default function RecommendationDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={mockRecommendation.title}
        description={`Recommendation ${mockRecommendation.id} · ${mockRecommendation.category.replace(/_/g, ' ')}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={mockRecommendation.priority} />
        <StatusBadge value={mockRecommendation.status} />
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
          {Math.round(mockRecommendation.confidence * 100)}% confidence
        </span>
        <span className="text-xs text-slate-500">Created {new Date(mockRecommendation.createdAt).toLocaleString()}</span>
      </div>

      {/* Rationale */}
      <SectionCard title="Rationale" description="Full explanation of why this action is recommended.">
        <p className="text-sm leading-6 text-slate-300">{mockRecommendation.rationale}</p>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Supporting signals */}
        <SectionCard title="Supporting signals" description="Insights and signals that contributed to this recommendation.">
          <div className="space-y-3">
            {mockRecommendation.supportingSignals.map((signal) => (
              <div key={signal.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white">{signal.title}</p>
                <p className="mt-1 text-xs text-slate-500">{Math.round(signal.confidence * 100)}% confidence</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Impact */}
        <SectionCard title="Impact assessment" description="Entities and resources affected if this recommendation is approved.">
          <div className="space-y-3">
            {mockRecommendation.impactedEntities.map((entity) => (
              <div key={entity.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{entity.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{entity.type}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-amber-200/80">{entity.change}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Approval history */}
      <SectionCard title="Approval history" description="Record of all actions taken on this recommendation.">
        <div className="space-y-2">
          {mockRecommendation.approvalHistory.map((entry, index) => (
            <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <StatusBadge value={entry.action} />
              <div>
                <p className="text-sm text-white">{entry.actor}</p>
                <p className="text-xs text-slate-500">{entry.note} · {new Date(entry.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <button type="button" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400">
          Approve
        </button>
        <button type="button" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400">
          Defer
        </button>
        <button type="button" className="rounded-xl border border-rose-500/30 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/10">
          Reject
        </button>
        <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5">
          Capture outcome
        </button>
      </div>
    </div>
  );
}
