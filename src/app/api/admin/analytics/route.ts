import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { filterScopedAnalytics } from '@/lib/control-plane-fallbacks';
import { getScopeFilters } from '@/lib/scope';
import { analyticsData } from '@/mocks/platform-data';
import { analyticsResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.analytics, async (_request, context) => {
  const proxied = await proxyCatalogRequest('/admin/analytics', context, { responseSchema: analyticsResponseSchema });
  if (proxied) {
    return proxied;
  }

  return NextResponse.json(analyticsResponseSchema.parse(filterScopedAnalytics(analyticsData, getScopeFilters(context.scope))));
});
