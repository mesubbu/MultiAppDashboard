'use client';

import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, actions, className, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-white/10 bg-slate-900/40 text-center',
        compact ? 'px-4 py-5' : 'px-6 py-8',
        className,
      )}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300">
        <Inbox className="h-5 w-5" />
      </div>
      <h4 className="mt-4 text-sm font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {actions ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
