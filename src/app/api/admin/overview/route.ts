import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { filterScopedOverview } from '@/lib/control-plane-fallbacks';
import { getScopeFilters } from '@/lib/scope';
import { overviewData } from '@/mocks/platform-data';
import { overviewResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.overview, async (_request, context) => {
  const proxied = await proxyCatalogRequest('/admin/overview', context, { responseSchema: overviewResponseSchema });
  if (proxied) {
    return proxied;
  }

  return NextResponse.json(overviewResponseSchema.parse(filterScopedOverview(overviewData, getScopeFilters(context.scope))));
});
