import { Suspense } from 'react';

import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockSignals = [
  { id: 'sig_01', title: 'Rising demand for AI-assisted pricing in APAC markets', type: 'trend', confidence: 0.89, direction: 'up', category: 'market_demand', updatedAt: '2026-03-10T06:30:00Z' },
  { id: 'sig_02', title: 'Competitor launched automated vendor scoring feature', type: 'competitive', confidence: 0.76, direction: 'neutral', category: 'competitive_intel', updatedAt: '2026-03-09T22:15:00Z' },
  { id: 'sig_03', title: 'Supply cost volatility increasing for raw materials category', type: 'alert', confidence: 0.92, direction: 'up', category: 'supply_risk', updatedAt: '2026-03-10T04:45:00Z' },
  { id: 'sig_04', title: 'User engagement with recommendations improving week-over-week', type: 'trend', confidence: 0.84, direction: 'up', category: 'platform_usage', updatedAt: '2026-03-10T07:00:00Z' },
  { id: 'sig_05', title: 'Regulatory changes may impact data collection in EU region', type: 'alert', confidence: 0.68, direction: 'neutral', category: 'regulatory', updatedAt: '2026-03-09T16:00:00Z' },
];

function SignalsFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

function directionEmoji(direction: string) {
  if (direction === 'up') return '📈';
  if (direction === 'down') return '📉';
  return '➡️';
}

function SignalsContent() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Active signals', value: mockSignals.length },
          { label: 'High confidence', value: mockSignals.filter((s) => s.confidence >= 0.85).length },
          { label: 'Trends', value: mockSignals.filter((s) => s.type === 'trend').length },
          { label: 'Alerts', value: mockSignals.filter((s) => s.type === 'alert').length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Signal feed" description="Generated signals from research, events, and usage patterns with confidence ratings and trend direction.">
        <div className="space-y-3">
          {mockSignals.map((signal) => (
            <div key={signal.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/[0.08]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{directionEmoji(signal.direction)}</span>
                    <h3 className="text-sm font-semibold text-white">{signal.title}</h3>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="rounded-full bg-white/5 px-2 py-0.5">{signal.type}</span>
                    <span className="rounded-full bg-white/5 px-2 py-0.5">{signal.category.replace(/_/g, ' ')}</span>
                    <span>{Math.round(signal.confidence * 100)}% confidence</span>
                    <span>{new Date(signal.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
                <StatusBadge value={signal.confidence >= 0.85 ? 'healthy' : signal.confidence >= 0.7 ? 'degraded' : 'critical'} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Signals & Insights"
        description="Generated intelligence from research, events, and usage patterns with confidence scoring and trend analysis."
      />
      <Suspense fallback={<SignalsFallback />}>
        <SignalsContent />
      </Suspense>
    </div>
  );
}
