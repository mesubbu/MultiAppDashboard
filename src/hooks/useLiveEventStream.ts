'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { EventType, PlatformEvent } from '@/types/platform';

interface EventFilters {
  tenantId: string;
  appId: string;
  type: 'all' | EventType;
}

const FLUSH_INTERVAL_MS = 750;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const MAX_VISIBLE_EVENTS = 80;

type ConnectionState = 'connecting' | 'live' | 'paused' | 'reconnecting';
type ActiveConnectionState = Exclude<ConnectionState, 'paused'>;

function mergeEvents(current: PlatformEvent[], incoming: PlatformEvent[]) {
  const deduped = new Map(current.map((event) => [event.id, event]));
  for (const event of incoming) {
    deduped.set(event.id, event);
  }

  return Array.from(deduped.values())
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, MAX_VISIBLE_EVENTS);
}

export function useLiveEventStream(events: PlatformEvent[]) {
  const [filters, setFilters] = useState<EventFilters>({
    tenantId: 'all',
    appId: 'all',
    type: 'all',
  });
  const [liveEvents, setLiveEvents] = useState(events);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionState, setConnectionState] = useState<ActiveConnectionState>('connecting');
  const [bufferedCount, setBufferedCount] = useState(0);
  const [reconnectInMs, setReconnectInMs] = useState<number | null>(null);
  const [streamGeneration, setStreamGeneration] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEventsRef = useRef<PlatformEvent[]>([]);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    if (isPaused) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      return;
    }

    const source = new EventSource('/api/admin/events/stream');
    eventSourceRef.current = source;

    source.onopen = () => {
      reconnectAttemptRef.current = 0;
      setReconnectInMs(null);
      setConnectionState('live');
    };

    source.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as { items?: PlatformEvent[] };
        if (!Array.isArray(payload.items) || payload.items.length === 0) {
          return;
        }

        pendingEventsRef.current.push(...payload.items);
        setBufferedCount(pendingEventsRef.current.length);
      } catch {
        // Ignore malformed streaming payloads and wait for the next frame.
      }
    };

    source.onerror = () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }

      const nextAttempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = nextAttempt;
      const delay = Math.min(
        BASE_RECONNECT_DELAY_MS * 2 ** (nextAttempt - 1),
        MAX_RECONNECT_DELAY_MS,
      );
      setConnectionState('reconnecting');
      setReconnectInMs(delay);
      reconnectTimerRef.current = setTimeout(() => {
        setStreamGeneration((current) => current + 1);
      }, delay);
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [isPaused, streamGeneration]);

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!pendingEventsRef.current.length) {
        return;
      }

      const pending = pendingEventsRef.current.splice(0, pendingEventsRef.current.length);
      setBufferedCount(0);
      setLiveEvents((current) => mergeEvents(current, pending));
    }, FLUSH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPaused]);

  function togglePaused() {
    if (!isPaused) {
      pendingEventsRef.current = [];
      setBufferedCount(0);
      setReconnectInMs(null);
    } else {
      setConnectionState('connecting');
      setReconnectInMs(null);
    }
    setIsPaused((current) => !current);
  }

  const effectiveConnectionState = isPaused ? 'paused' : connectionState;

  const filteredEvents = useMemo(
    () =>
      liveEvents.filter((event) => {
        const tenantMatch = filters.tenantId === 'all' || event.tenantId === filters.tenantId;
        const appMatch = filters.appId === 'all' || event.appId === filters.appId;
        const typeMatch = filters.type === 'all' || event.type === filters.type;
        return tenantMatch && appMatch && typeMatch;
      }),
    [liveEvents, filters],
  );

  return {
    bufferedCount,
    connectionState: effectiveConnectionState,
    filteredEvents,
    filters,
    isPaused,
    liveEvents,
    reconnectInMs,
    setFilters,
    togglePaused,
  };
}
