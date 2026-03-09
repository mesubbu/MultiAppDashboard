import { describe, expect, it } from 'vitest';

import {
  buildSyntheticPlatformEvent,
  filterPlatformEvents,
  formatSseChunk,
} from '@/lib/live-events.server';
import { eventsData } from '@/mocks/platform-data';

describe('live events helpers', () => {
  it('filters events by tenant, app, and type', () => {
    const filtered = filterPlatformEvents(eventsData, {
      tenantId: 'tenant_acme',
      appId: 'app_vendor_flutter',
      eventType: 'message_sent',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].tenantId).toBe('tenant_acme');
    expect(filtered[0].appId).toBe('app_vendor_flutter');
    expect(filtered[0].type).toBe('message_sent');
  });

  it('builds a unique synthetic event and formats it as SSE data', () => {
    const event = buildSyntheticPlatformEvent(eventsData, 2);
    const chunk = formatSseChunk({ items: [event] }, { retryMs: 1000 });

    expect(event.id).toContain('event_live_');
    expect(event.summary).toContain('live update');
    expect(chunk).toContain('retry: 1000');
    expect(chunk).toContain('data: ');
  });
});