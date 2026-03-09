import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { listLocalControlPlaneModels } from '@/lib/control-plane-state.server';
import { modelListResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.models, async (_request, context) => {
  const proxied = await proxyCatalogRequest('/admin/models', context, { responseSchema: modelListResponseSchema });
  if (proxied) {
    return proxied;
  }

  return NextResponse.json(modelListResponseSchema.parse({ items: await listLocalControlPlaneModels() }));
});
