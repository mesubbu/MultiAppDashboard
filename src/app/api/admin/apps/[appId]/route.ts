import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  withPermission,
  type AuthorizedAdminContext,
} from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { updateCatalogApp } from '@/lib/admin-catalog.server';
import { appMutationResponseSchema, appUpdateRequestSchema } from '@/types/contracts';

export const PATCH = withPermission<{ appId: string }>(
  adminRoutePermissions.appMutations,
  async (request: NextRequest, context: AuthorizedAdminContext<{ appId: string }>) => {
    try {
      const body = appUpdateRequestSchema.parse(await request.json());
      const { appId } = await context.params;
      const proxied = await proxyCatalogRequest(`/admin/apps/${appId}`, context, {
        method: 'PATCH',
        body,
        responseSchema: appMutationResponseSchema,
      });
      if (proxied) {
        return proxied;
      }

      return NextResponse.json(
        appMutationResponseSchema.parse({
          ok: true,
          item: await updateCatalogApp(context.session.user, appId, body),
        }),
      );
    } catch (error) {
      return createCatalogErrorResponse(error, 'INVALID_APP_REQUEST', 'Provide a valid app update payload.');
    }
  },
);