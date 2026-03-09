import type { EventType, PlatformEvent } from '@/types/platform';

export type LiveEventFilters = {
  tenantId?: string;
  appId?: string;
  eventType?: EventType;
  limit?: number;
};

const fallbackEvent: PlatformEvent = {
  id: 'event_live_fallback',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  type: 'agent_triggered',
  actor: 'system',
  summary: 'Live control-plane heartbeat emitted.',
  timestamp: new Date('2026-03-08T00:00:00.000Z').toISOString(),
};

export function filterPlatformEvents(events: PlatformEvent[], filters: LiveEventFilters = {}) {
  const filtered = events
    .filter((event) => !filters.tenantId || event.tenantId === filters.tenantId)
    .filter((event) => !filters.appId || event.appId === filters.appId)
    .filter((event) => !filters.eventType || event.type === filters.eventType)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());

  if (typeof filters.limit === 'number' && Number.isFinite(filters.limit)) {
    return filtered.slice(0, filters.limit);
  }

  return filtered;
}

export function buildSyntheticPlatformEvent(seedEvents: PlatformEvent[], sequence: number) {
  const template = seedEvents[sequence % Math.max(seedEvents.length, 1)] ?? fallbackEvent;
  const timestamp = new Date(Date.now() + sequence).toISOString();

  return {
    ...template,
    id: `event_live_${template.id}_${Date.now()}_${sequence}`,
    timestamp,
    summary: template.summary.endsWith('· live update')
      ? template.summary
      : `${template.summary} · live update`,
  } satisfies PlatformEvent;
}

export function formatSseChunk(payload: unknown, options: { retryMs?: number } = {}) {
  const retryPrefix = options.retryMs ? `retry: ${options.retryMs}\n` : '';
  return `${retryPrefix}data: ${JSON.stringify(payload)}\n\n`;
}

export function formatSseComment(comment: string) {
  return `: ${comment}\n\n`;
}