import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  withPermission,
  type AuthorizedAdminContext,
} from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { updateCatalogUser } from '@/lib/admin-catalog.server';
import { userMutationResponseSchema, userUpdateRequestSchema } from '@/types/contracts';

export const PATCH = withPermission<{ userId: string }>(
  adminRoutePermissions.userMutations,
  async (request: NextRequest, context: AuthorizedAdminContext<{ userId: string }>) => {
    try {
      const body = userUpdateRequestSchema.parse(await request.json());
      const { userId } = await context.params;
      const proxied = await proxyCatalogRequest(`/admin/users/${userId}`, context, {
        method: 'PATCH',
        body,
        responseSchema: userMutationResponseSchema,
      });
      if (proxied) {
        return proxied;
      }

      return NextResponse.json(
        userMutationResponseSchema.parse({
          ok: true,
          item: await updateCatalogUser(context.session.user, userId, body),
        }),
      );
    } catch (error) {
      return createCatalogErrorResponse(error, 'INVALID_USER_REQUEST', 'Provide a valid user update payload.');
    }
  },
);