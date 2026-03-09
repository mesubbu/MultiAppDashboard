import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseObservabilityListQuery } from '@/lib/catalog-list-query';
import { filterClientErrors, filterObservabilityItems } from '@/lib/control-plane-list-filters';
import { listObservabilityServices, listScopedClientErrors } from '@/lib/observability.server';
import { observabilityPageResponseSchema, observabilityResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.observability, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams);
  const proxied = await proxyCatalogRequest(`/admin/observability${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? observabilityPageResponseSchema : observabilityResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  const items = await listObservabilityServices();
  const clientErrors = await listScopedClientErrors(context.scope);
  if (isPagedRequest) {
    const query = parseObservabilityListQuery(request.nextUrl.searchParams);
    return NextResponse.json(
      observabilityPageResponseSchema.parse({
        ...paginateItems(filterObservabilityItems(items, query), query),
        clientErrors: filterClientErrors(clientErrors, query),
      }),
    );
  }

  return NextResponse.json(
    observabilityResponseSchema.parse({
      items,
      clientErrors,
    }),
  );
});
