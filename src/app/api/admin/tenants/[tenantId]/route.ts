import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  withPermission,
  type AuthorizedAdminContext,
} from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { updateCatalogTenant } from '@/lib/admin-catalog.server';
import { tenantMutationResponseSchema, tenantUpdateRequestSchema } from '@/types/contracts';

export const PATCH = withPermission<{ tenantId: string }>(
  adminRoutePermissions.tenantMutations,
  async (request: NextRequest, context: AuthorizedAdminContext<{ tenantId: string }>) => {
    try {
      const body = tenantUpdateRequestSchema.parse(await request.json());
      const { tenantId } = await context.params;
      const proxied = await proxyCatalogRequest(`/admin/tenants/${tenantId}`, context, {
        method: 'PATCH',
        body,
        responseSchema: tenantMutationResponseSchema,
      });
      if (proxied) {
        return proxied;
      }

      return NextResponse.json(
        tenantMutationResponseSchema.parse({
          ok: true,
          item: await updateCatalogTenant(context.session.user, tenantId, body),
        }),
      );
    } catch (error) {
      return createCatalogErrorResponse(error, 'INVALID_TENANT_REQUEST', 'Provide a valid tenant update payload.');
    }
  },
);