import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { listLocalControlPlaneEvents } from '@/lib/control-plane-state.server';
import { getDashboardEnv } from '@/lib/env';
import {
  buildSyntheticPlatformEvent,
  formatSseChunk,
  formatSseComment,
} from '@/lib/live-events.server';
import type { EventType } from '@/types/platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createEventStreamHeaders(contentType?: string) {
  return new Headers({
    'content-type': contentType ?? 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  });
}

export const GET = withPermission(adminRoutePermissions.events, async (request: NextRequest, context) => {
  const env = getDashboardEnv();
  const baseUrl = env.CONTROL_PLANE_API_BASE_URL ?? env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  const path = `/admin/events/stream${request.nextUrl.search}`;

  if (baseUrl) {
    const response = await fetch(new URL(path, baseUrl), {
      headers: {
        authorization: `Bearer ${env.CONTROL_PLANE_API_TOKEN ?? ''}`,
        'x-tenant-id': context.session.user.tenantId,
        'x-app-id': context.session.user.appId,
        'x-user-id': context.session.user.userId,
        'x-user-roles': context.session.user.roles.join(','),
      },
      cache: 'no-store',
      signal: request.signal,
    });

    return new Response(response.body, {
      status: response.status,
      headers: createEventStreamHeaders(response.headers.get('content-type') ?? undefined),
    });
  }

  const tenantId = request.nextUrl.searchParams.get('tenant_id') ?? undefined;
  const appId = request.nextUrl.searchParams.get('app_id') ?? undefined;
  const eventType = request.nextUrl.searchParams.get('event_type') ?? undefined;
  const encoder = new TextEncoder();
  let sequence = 0;
  let eventTimer: ReturnType<typeof setInterval> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const closeTimers = () => {
    if (eventTimer) {
      clearInterval(eventTimer);
      eventTimer = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendSyntheticEvent = async () => {
        const scopedEvents = await listLocalControlPlaneEvents(context.session.user, {
          tenantId,
          appId,
          eventType: eventType as EventType | undefined,
          limit: 12,
        });
        const item = buildSyntheticPlatformEvent(scopedEvents, sequence);
        controller.enqueue(
          encoder.encode(
            formatSseChunk({ items: [item] }, sequence === 0 ? { retryMs: 1_000 } : undefined),
          ),
        );
        sequence += 1;
      };

      controller.enqueue(encoder.encode(formatSseComment('connected')));
      await sendSyntheticEvent();

      eventTimer = setInterval(() => {
        void sendSyntheticEvent().catch(() => {
          closeTimers();
          try {
            controller.close();
          } catch {}
        });
      }, 3_000);

      heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(formatSseComment('keepalive')));
      }, 15_000);

      request.signal.addEventListener(
        'abort',
        () => {
          closeTimers();
          try {
            controller.close();
          } catch {}
        },
        { once: true },
      );
    },
    cancel() {
      closeTimers();
    },
  });

  return new Response(stream, { headers: createEventStreamHeaders() });
});