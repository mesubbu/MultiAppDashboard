'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, LogOut, RotateCcw, Server, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';

type ErrorCategory = 'auth' | 'service' | 'data' | 'network' | 'generic';

interface ErrorStateProps {
  title: string;
  description: string;
  category?: ErrorCategory;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  fullScreen?: boolean;
  actions?: ReactNode;
}

const categoryConfig: Record<ErrorCategory, { icon: typeof AlertTriangle; iconClass: string; suggestion: string }> = {
  auth: {
    icon: LogOut,
    iconClass: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
    suggestion: 'Your session may have expired. Try signing in again.',
  },
  service: {
    icon: Server,
    iconClass: 'border-orange-400/30 bg-orange-500/15 text-orange-200',
    suggestion: 'A backend service is unavailable. Check the status page or try again shortly.',
  },
  data: {
    icon: AlertTriangle,
    iconClass: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
    suggestion: 'The requested data could not be loaded or is malformed.',
  },
  network: {
    icon: WifiOff,
    iconClass: 'border-violet-400/30 bg-violet-500/15 text-violet-200',
    suggestion: 'Check your internet connection and try again.',
  },
  generic: {
    icon: AlertTriangle,
    iconClass: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
    suggestion: 'Something went wrong. Please try again.',
  },
};

export function ErrorState({
  title,
  description,
  category = 'generic',
  onRetry,
  retryLabel = 'Try again',
  className,
  fullScreen = false,
  actions,
}: ErrorStateProps) {
  const config = categoryConfig[category];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-3xl border border-rose-500/30 bg-rose-500/10 px-6 py-8 text-center text-rose-100',
        fullScreen && 'flex min-h-screen items-center justify-center rounded-none bg-slate-950 px-6',
        className,
      )}
    >
      <div className="mx-auto max-w-xl">
        <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full border', config.iconClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-rose-100/85">{description}</p>
        <p className="mt-2 text-xs text-slate-400">{config.suggestion}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <RotateCcw className="h-4 w-4" />
              {retryLabel}
            </button>
          ) : null}
          {category === 'auth' ? (
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              <LogOut className="h-4 w-4" />
              Sign in again
            </a>
          ) : null}
          {category === 'service' ? (
            <a
              href="/observability"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              <Server className="h-4 w-4" />
              View status
            </a>
          ) : null}
          {actions}
        </div>
      </div>
    </div>
  );
}
