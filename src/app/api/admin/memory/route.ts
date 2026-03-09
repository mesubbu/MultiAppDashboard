import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseMemoryListQuery } from '@/lib/catalog-list-query';
import { filterMemory } from '@/lib/control-plane-list-filters';
import { getScopeFilters, filterScopedItems } from '@/lib/scope';
import { memoryData } from '@/mocks/platform-data';
import { memoryListResponseSchema, memoryPageResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.memory, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams, ['scope']);
  const proxied = await proxyCatalogRequest(`/admin/memory${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? memoryPageResponseSchema : memoryListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  const items = filterScopedItems(memoryData, getScopeFilters(context.scope));
  if (isPagedRequest) {
    const query = parseMemoryListQuery(request.nextUrl.searchParams);
    return NextResponse.json(memoryPageResponseSchema.parse(paginateItems(filterMemory(items, query), query)));
  }

  return NextResponse.json(memoryListResponseSchema.parse({ items }));
});
