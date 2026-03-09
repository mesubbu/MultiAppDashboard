import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseEventListQuery } from '@/lib/catalog-list-query';
import { filterEvents } from '@/lib/control-plane-list-filters';
import { listLocalControlPlaneEvents } from '@/lib/control-plane-state.server';
import { eventListResponseSchema, eventPageResponseSchema } from '@/types/contracts';
import type { EventType } from '@/types/platform';

export const GET = withPermission(adminRoutePermissions.events, async (request: NextRequest, context) => {
  const path = `/admin/events${request.nextUrl.search}`;
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams, ['event_type']);
  const proxied = await proxyCatalogRequest(path, context, {
    responseSchema: isPagedRequest ? eventPageResponseSchema : eventListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  const limit = request.nextUrl.searchParams.get('limit');
  const eventType = request.nextUrl.searchParams.get('event_type') ?? undefined;
  const tenantId = request.nextUrl.searchParams.get('tenant_id') ?? undefined;
  const appId = request.nextUrl.searchParams.get('app_id') ?? undefined;

  const items = await listLocalControlPlaneEvents(context.session.user, {
    tenantId,
    appId,
    eventType: eventType as EventType | undefined,
    limit: isPagedRequest ? undefined : limit ? Number(limit) : undefined,
  });

  if (isPagedRequest) {
    const query = parseEventListQuery(request.nextUrl.searchParams);
    return NextResponse.json(eventPageResponseSchema.parse(paginateItems(filterEvents(items, query), query)));
  }

  return NextResponse.json(eventListResponseSchema.parse({ items }));
});
