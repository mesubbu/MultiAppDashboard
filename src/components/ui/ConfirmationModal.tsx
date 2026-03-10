'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description: string;
  impactSummary?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  children?: ReactNode;
}

const toneStyles = {
  danger: {
    icon: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
    button: 'bg-rose-500 hover:bg-rose-400 text-white',
    impact: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  },
  warning: {
    icon: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
    button: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
    impact: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  },
  info: {
    icon: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-200',
    button: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
    impact: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
  },
};

export function ConfirmationModal({
  open,
  title,
  description,
  impactSummary,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'warning',
  onConfirm,
  onCancel,
  isLoading = false,
  children,
}: ConfirmationModalProps) {
  if (!open) return null;
  const styles = toneStyles[tone];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-slate-950/50"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', styles.icon)}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="confirm-modal-title" className="mt-4 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>

        {impactSummary ? (
          <div className={cn('mt-4 rounded-2xl border px-4 py-3 text-sm', styles.impact)}>
            <p className="font-medium">Impact summary</p>
            <p className="mt-1 opacity-85">{impactSummary}</p>
          </div>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        <p className="mt-4 text-xs text-slate-500">This action will be recorded in the audit log.</p>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn('rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60', styles.button)}
          >
            {isLoading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
