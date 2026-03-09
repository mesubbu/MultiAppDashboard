import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, parseUserListQuery } from '@/lib/catalog-list-query';
import { createCatalogUser, listCatalogUsers, listCatalogUsersPage } from '@/lib/admin-catalog.server';
import {
  userCreateRequestSchema,
  userListResponseSchema,
  userPageResponseSchema,
  userMutationResponseSchema,
} from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.users, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams, ['role']);
  const proxied = await proxyCatalogRequest(`/admin/users${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? userPageResponseSchema : userListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  if (isPagedRequest) {
    return NextResponse.json(
      userPageResponseSchema.parse(
        await listCatalogUsersPage(context.session.user, parseUserListQuery(request.nextUrl.searchParams)),
      ),
    );
  }

  return NextResponse.json(userListResponseSchema.parse({ items: await listCatalogUsers(context.session.user) }));
});

export const POST = withPermission(adminRoutePermissions.userMutations, async (request: NextRequest, context) => {
  try {
    const body = userCreateRequestSchema.parse(await request.json());
    const proxied = await proxyCatalogRequest('/admin/users', context, {
      method: 'POST',
      body,
      responseSchema: userMutationResponseSchema,
    });
    if (proxied) {
      return proxied;
    }

    return NextResponse.json(
      userMutationResponseSchema.parse({ ok: true, item: await createCatalogUser(context.session.user, body) }),
    );
  } catch (error) {
    return createCatalogErrorResponse(error, 'INVALID_USER_REQUEST', 'Provide a valid user payload.');
  }
});
