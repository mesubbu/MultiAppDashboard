'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  fullScreen?: boolean;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
  fullScreen = false,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-rose-500/30 bg-rose-500/10 px-6 py-8 text-center text-rose-100',
        fullScreen && 'flex min-h-screen items-center justify-center rounded-none bg-slate-950 px-6',
        className,
      )}
    >
      <div className="mx-auto max-w-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/15 text-rose-200">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-rose-100/85">{description}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            <RotateCcw className="h-4 w-4" />
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
