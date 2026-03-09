'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
  tone: ToastTone;
  durationMs: number;
}

interface ToastContextValue {
  pushToast: (toast: ToastInput) => void;
  pushSuccessToast: (title: string, description?: string) => void;
  pushErrorToast: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function renderIconForTone(tone: ToastTone) {
  if (tone === 'success') return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />;
  if (tone === 'error') return <XCircle className="mt-0.5 h-5 w-5 shrink-0" />;
  if (tone === 'warning') return <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />;
  return <Info className="mt-0.5 h-5 w-5 shrink-0" />;
}

function toneClasses(tone: ToastTone) {
  if (tone === 'success') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50';
  if (tone === 'error') return 'border-rose-400/30 bg-rose-500/15 text-rose-50';
  if (tone === 'warning') return 'border-amber-400/30 bg-amber-500/15 text-amber-50';
  return 'border-cyan-400/30 bg-cyan-500/15 text-cyan-50';
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast.durationMs, toast.id]);

  return (
    <div
      className={cn(
        'pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl shadow-slate-950/40 backdrop-blur',
        toneClasses(toast.tone),
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {renderIconForTone(toast.tone)}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-sm opacity-90">{toast.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="rounded-full p-1 text-current/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast: ToastInput) => {
    setToasts((current) => [
      ...current,
      {
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tone: toast.tone ?? 'info',
        durationMs: toast.durationMs ?? 4500,
        ...toast,
      },
    ]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
      pushSuccessToast: (title, description) => pushToast({ tone: 'success', title, description }),
      pushErrorToast: (title, description) => pushToast({ tone: 'error', title, description }),
    }),
    [pushToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return context;
}
