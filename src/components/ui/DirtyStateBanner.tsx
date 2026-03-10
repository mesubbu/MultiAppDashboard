'use client';

import { AlertCircle, RotateCcw, Save } from 'lucide-react';

import { cn } from '@/lib/utils';

interface DirtyStateBannerProps {
  dirtyCount: number;
  onSave: () => void;
  onDiscard: () => void;
  isSaving?: boolean;
  className?: string;
}

export function DirtyStateBanner({
  dirtyCount,
  onSave,
  onDiscard,
  isSaving = false,
  className,
}: DirtyStateBannerProps) {
  if (dirtyCount === 0) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm text-amber-200">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{dirtyCount}</strong> unsaved {dirtyCount === 1 ? 'change' : 'changes'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Discard
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
