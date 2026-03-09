import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { getLocalControlPlaneSystem } from '@/lib/control-plane-state.server';
import { systemResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.system, async (_request, context) => {
  const proxied = await proxyCatalogRequest('/admin/system', context, { responseSchema: systemResponseSchema });
  if (proxied) {
    return proxied;
  }

  return NextResponse.json(systemResponseSchema.parse({ sections: await getLocalControlPlaneSystem() }));
});
