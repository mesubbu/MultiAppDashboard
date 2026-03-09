import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseAuditListQuery } from '@/lib/catalog-list-query';
import { filterAuditLogs } from '@/lib/control-plane-list-filters';
import { listLocalControlPlaneAuditLogs } from '@/lib/control-plane-state.server';
import { auditListResponseSchema, auditPageResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.audit, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams, ['actor', 'action', 'resource_type', 'from', 'to']);
  const proxied = await proxyCatalogRequest(`/admin/audit${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? auditPageResponseSchema : auditListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  const items = await listLocalControlPlaneAuditLogs(context.session.user);
  if (isPagedRequest) {
    const query = parseAuditListQuery(request.nextUrl.searchParams);
    return NextResponse.json(auditPageResponseSchema.parse(paginateItems(filterAuditLogs(items, query), query)));
  }

  return NextResponse.json(auditListResponseSchema.parse({ items }));
});