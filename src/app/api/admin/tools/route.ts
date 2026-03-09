import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseToolListQuery } from '@/lib/catalog-list-query';
import { filterTools } from '@/lib/control-plane-list-filters';
import { toolsData } from '@/mocks/platform-data';
import { toolListResponseSchema, toolPageResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.tools, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams);
  const proxied = await proxyCatalogRequest(`/admin/tools${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? toolPageResponseSchema : toolListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  if (isPagedRequest) {
    const query = parseToolListQuery(request.nextUrl.searchParams);
    return NextResponse.json(toolPageResponseSchema.parse(paginateItems(filterTools(toolsData, query), query)));
  }

  return NextResponse.json(toolListResponseSchema.parse({ items: toolsData }));
});
