import { cn } from '@/lib/utils';

const toneMap: Record<string, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  degraded: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  critical: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  running: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  paused: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  throttled: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  error: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  queued: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  ready: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  waiting: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  waiting_review: 'bg-violet-500/15 text-violet-300 ring-violet-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  low: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  high: 'bg-orange-500/15 text-orange-300 ring-orange-500/30',
};

export function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset',
        toneMap[value] ?? 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
      )}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}
