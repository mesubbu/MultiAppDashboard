import { Suspense } from 'react';

import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockRecommendations = [
  { id: 'rec_01', title: 'Increase research collection frequency for APAC feeds', priority: 'high', confidence: 0.91, status: 'pending', category: 'research_ops', rationale: 'APAC market signal velocity is 3x higher than current collection cadence.', createdAt: '2026-03-10T06:30:00Z' },
  { id: 'rec_02', title: 'Switch planner model to Qwen-2.5 for cost efficiency', priority: 'high', confidence: 0.87, status: 'pending', category: 'model_routing', rationale: 'Qwen-2.5 shows 40% lower token cost at equivalent latency.', createdAt: '2026-03-10T05:15:00Z' },
  { id: 'rec_03', title: 'Consolidate duplicate vendor entities in knowledge graph', priority: 'medium', confidence: 0.78, status: 'approved', category: 'data_quality', rationale: '47 vendor entities appear to have overlapping identities.', createdAt: '2026-03-09T22:00:00Z' },
  { id: 'rec_04', title: 'Review agent budget allocation for research agents', priority: 'medium', confidence: 0.82, status: 'deferred', category: 'agent_ops', rationale: 'Research agent budget utilization consistently reaches 90%+ within cycle.', createdAt: '2026-03-09T18:00:00Z' },
  { id: 'rec_05', title: 'Enable regional fallback model for EU traffic', priority: 'low', confidence: 0.65, status: 'rejected', category: 'model_routing', rationale: 'EU latency occasionally spikes above 5s threshold during peak hours.', createdAt: '2026-03-09T14:00:00Z' },
];

function RecommendationsFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full" />
      ))}
    </div>
  );
}

function RecommendationsContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Pending', value: mockRecommendations.filter((r) => r.status === 'pending').length, color: 'text-cyan-300' },
          { label: 'Approved', value: mockRecommendations.filter((r) => r.status === 'approved').length, color: 'text-emerald-300' },
          { label: 'High priority', value: mockRecommendations.filter((r) => r.priority === 'high').length, color: 'text-amber-300' },
          { label: 'Avg confidence', value: `${Math.round((mockRecommendations.reduce((s, r) => s + r.confidence, 0) / mockRecommendations.length) * 100)}%`, color: 'text-white' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Recommendations" description="Prioritized actions from the recommendation agent with rationale, confidence, and approval controls.">
        <div className="space-y-3">
          {mockRecommendations.map((rec) => (
            <div key={rec.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold text-white">{rec.title}</h3>
                    <StatusBadge value={rec.priority} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{rec.rationale}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="rounded-full bg-white/5 px-2 py-0.5">{rec.category.replace(/_/g, ' ')}</span>
                    <span>{Math.round(rec.confidence * 100)}% confidence</span>
                    <span>Status: {rec.status}</span>
                    <span>{new Date(rec.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {rec.status === 'pending' ? (
                    <>
                      <button type="button" className="rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/25">
                        Approve
                      </button>
                      <button type="button" className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5">
                        Defer
                      </button>
                    </>
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

export default function RecommendationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommendations Workbench"
        description="Review prioritized recommendations, rationale, and confidence from the recommendation agent. Approve, defer, or reject suggested actions."
      />
      <Suspense fallback={<RecommendationsFallback />}>
        <RecommendationsContent />
      </Suspense>
    </div>
  );
}
