'use client';

import { useId, useMemo } from 'react';

import { useLiveEventStream } from '@/hooks/useLiveEventStream';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import type { PlatformEvent } from '@/types/platform';

export function EventStream({ events }: { events: PlatformEvent[] }) {
  const eventListId = useId();
  const tenantFilterId = useId();
  const appFilterId = useId();
  const typeFilterId = useId();
  const {
    bufferedCount,
    connectionState,
    filteredEvents,
    filters,
    isPaused,
    liveEvents,
    reconnectInMs,
    setFilters,
    togglePaused,
  } = useLiveEventStream(events);

  const tenantOptions = useMemo(() => Array.from(new Set(liveEvents.map((event) => event.tenantId))), [liveEvents]);
  const appOptions = useMemo(() => Array.from(new Set(liveEvents.map((event) => event.appId))), [liveEvents]);
  const typeOptions = useMemo(() => Array.from(new Set(liveEvents.map((event) => event.type))), [liveEvents]);
  const hasActiveFilters =
    filters.tenantId !== 'all' || filters.appId !== 'all' || filters.type !== 'all';

  function resetFilters() {
    setFilters({ tenantId: 'all', appId: 'all', type: 'all' });
  }

  const connectionLabel =
    connectionState === 'live'
      ? 'Live'
      : connectionState === 'paused'
        ? 'Paused'
        : connectionState === 'reconnecting'
          ? 'Reconnecting'
          : 'Connecting';

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Real-time event stream</h3>
          <p className="mt-1 text-sm text-slate-400">Live SSE stream with buffering, pause/resume controls, and reconnect-aware triage filters.</p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span
              className={cn(
                'rounded-full border px-2.5 py-1 font-medium',
                connectionState === 'live'
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                  : connectionState === 'paused'
                    ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                    : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
              )}
            >
              {connectionLabel}
            </span>
            <span>{filteredEvents.length} visible</span>
            {bufferedCount > 0 ? <span>{bufferedCount} buffered</span> : null}
            {reconnectInMs ? <span>retrying in {Math.ceil(reconnectInMs / 1000)}s</span> : null}
            <button
              type="button"
              onClick={togglePaused}
              aria-pressed={isPaused}
              aria-controls={eventListId}
              className="rounded-full border border-white/10 px-3 py-1 text-slate-200 hover:bg-white/5"
            >
              {isPaused ? 'Resume stream' : 'Pause stream'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label htmlFor={tenantFilterId} className="block">
              <span className="sr-only">Filter events by tenant</span>
              <select id={tenantFilterId} value={filters.tenantId} onChange={(event) => setFilters((current) => ({ ...current, tenantId: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                <option value="all">All tenants</option>
                {tenantOptions.map((tenant) => <option key={tenant} value={tenant}>{tenant}</option>)}
              </select>
            </label>
            <label htmlFor={appFilterId} className="block">
              <span className="sr-only">Filter events by app</span>
              <select id={appFilterId} value={filters.appId} onChange={(event) => setFilters((current) => ({ ...current, appId: event.target.value }))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                <option value="all">All apps</option>
                {appOptions.map((app) => <option key={app} value={app}>{app}</option>)}
              </select>
            </label>
            <label htmlFor={typeFilterId} className="block">
              <span className="sr-only">Filter events by type</span>
              <select id={typeFilterId} value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as typeof current.type }))} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200">
                <option value="all">All event types</option>
                {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>
      <div id={eventListId} aria-busy={connectionState === 'connecting' || connectionState === 'reconnecting'} className="mt-5 space-y-3">
        {filteredEvents.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No events match the current filters' : 'No live events yet'}
            description={
              hasActiveFilters
                ? 'Clear one or more filters to widen the stream and resume triage.'
                : 'The stream is ready and waiting for the next platform event to arrive.'
            }
            actions={
              <>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    Clear filters
                  </button>
                ) : null}
                {isPaused ? (
                  <button
                    type="button"
                    onClick={togglePaused}
                    className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                  >
                    Resume stream
                  </button>
                ) : null}
              </>
            }
          />
        ) : null}
        {filteredEvents.map((event) => (
          <article key={event.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300">{event.type}</span>
                  <span>{event.summary}</span>
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{event.tenantId} • {event.appId} • {event.actor}</p>
              </div>
              <p className="text-sm text-slate-400">{formatDateTime(event.timestamp)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
