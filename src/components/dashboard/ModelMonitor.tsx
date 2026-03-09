'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { SectionCard } from '@/components/ui/SectionCard';
import { useToast } from '@/components/ui/toast';
import { cn, formatCompactNumber, formatPercent } from '@/lib/utils';
import type { ModelRecord } from '@/types/platform';

export function ModelMonitor({ models, canSwitch }: { models: ModelRecord[]; canSwitch: boolean }) {
  const router = useRouter();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const [localModels, setLocalModels] = useState(models);
  const [switchingKey, setSwitchingKey] = useState<ModelRecord['key'] | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function switchModel(key: ModelRecord['key'], targetModel: string) {
    const previousModels = localModels;
    setFeedback(null);
    setSwitchingKey(key);
    setLocalModels((current) => current.map((model) => (model.key === key ? { ...model, activeModel: targetModel } : model)));

    try {
      const response = await fetch('/api/admin/models/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, targetModel }),
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | { model?: ModelRecord; audit?: { summary?: string }; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(responsePayload?.error?.message ?? 'Unable to switch model.');
      }

      if (responsePayload?.model) {
        setLocalModels((current) => current.map((model) => (model.key === key ? responsePayload.model ?? model : model)));
      }

      const successText = responsePayload?.audit?.summary ?? 'Model switch applied.';
      setFeedback({ tone: 'success', text: successText });
      pushSuccessToast('Model routing updated', successText);
      router.refresh();
    } catch (error) {
      setLocalModels(previousModels);
      const errorText = error instanceof Error ? error.message : 'Unable to switch model.';
      setFeedback({ tone: 'error', text: errorText });
      pushErrorToast('Unable to switch model', errorText);
    } finally {
      setSwitchingKey(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {feedback ? (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={cn(
            'xl:col-span-2 rounded-2xl border px-4 py-3 text-sm',
            feedback.tone === 'success'
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/30 bg-rose-500/10 text-rose-200',
          )}
        >
          {feedback.text}
        </div>
      ) : null}
      {localModels.map((model) => (
        <SectionCard key={model.key} title={`${model.service} (${model.key})`} description={`${model.provider} • Fallback: ${model.fallbackModel}`}>
          <div className="grid gap-4 text-sm text-slate-300">
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-white/5 p-4">
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latency</p><p className="mt-1 text-lg font-semibold text-white">{model.latencyMs} ms</p></div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tokens / 1h</p><p className="mt-1 text-lg font-semibold text-white">{formatCompactNumber(model.tokenUsage1h)}</p></div>
              <div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Error rate</p><p className="mt-1 text-lg font-semibold text-white">{formatPercent(model.errorRate)}</p></div>
            </div>
            <div>
              <label htmlFor={`model-select-${model.key}`} className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Active model
              </label>
              <p className="mt-1 font-medium text-cyan-300">{model.activeModel}</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <select id={`model-select-${model.key}`} value={model.activeModel} disabled={!canSwitch || switchingKey === model.key} onChange={(event) => void switchModel(model.key, event.target.value)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50">
                {model.candidates.map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
              </select>
              <button type="button" disabled={!canSwitch || switchingKey === model.key} onClick={() => void switchModel(model.key, model.fallbackModel)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">Switch to fallback</button>
            </div>
            <p className="text-xs text-slate-500">{!canSwitch ? 'You have read-only access for model routing.' : switchingKey === model.key ? 'Applying model switch…' : 'Switches are applied through the control-plane API.'}</p>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
