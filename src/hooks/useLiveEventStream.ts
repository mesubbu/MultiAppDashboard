'use client';

import { useMemo, useState } from 'react';

import type { EventType, PlatformEvent } from '@/types/platform';

interface EventFilters {
  tenantId: string;
  appId: string;
  type: 'all' | EventType;
}

export function useLiveEventStream(events: PlatformEvent[]) {
  const [filters, setFilters] = useState<EventFilters>({
    tenantId: 'all',
    appId: 'all',
    type: 'all',
  });

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        const tenantMatch = filters.tenantId === 'all' || event.tenantId === filters.tenantId;
        const appMatch = filters.appId === 'all' || event.appId === filters.appId;
        const typeMatch = filters.type === 'all' || event.type === filters.type;
        return tenantMatch && appMatch && typeMatch;
      }),
    [events, filters],
  );

  return { filters, setFilters, filteredEvents };
}
