import { TrendingDown, TrendingUp } from 'lucide-react';

import type { MetricCard } from '@/types/platform';

export function MetricsCards({ items }: { items: MetricCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const isUp = item.trend === 'up';
        return (
          <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/10">
            <p className="text-sm text-slate-400">{item.label}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-3xl font-semibold text-white">{item.value}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${isUp ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {item.delta}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{item.description}</p>
          </article>
        );
      })}
    </div>
  );
}
