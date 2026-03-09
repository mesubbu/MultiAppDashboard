import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, parseAppListQuery } from '@/lib/catalog-list-query';
import { createCatalogApp, listCatalogApps, listCatalogAppsPage } from '@/lib/admin-catalog.server';
import {
  appCreateRequestSchema,
  appListResponseSchema,
  appPageResponseSchema,
  appMutationResponseSchema,
} from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.apps, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams, ['environment']);
  const proxied = await proxyCatalogRequest(`/admin/apps${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? appPageResponseSchema : appListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  if (isPagedRequest) {
    return NextResponse.json(
      appPageResponseSchema.parse(
        await listCatalogAppsPage(context.session.user, parseAppListQuery(request.nextUrl.searchParams)),
      ),
    );
  }

  return NextResponse.json(appListResponseSchema.parse({ items: await listCatalogApps(context.session.user) }));
});

export const POST = withPermission(adminRoutePermissions.appMutations, async (request: NextRequest, context) => {
  try {
    const body = appCreateRequestSchema.parse(await request.json());
    const proxied = await proxyCatalogRequest('/admin/apps', context, {
      method: 'POST',
      body,
      responseSchema: appMutationResponseSchema,
    });
    if (proxied) {
      return proxied;
    }

    return NextResponse.json(
      appMutationResponseSchema.parse({ ok: true, item: await createCatalogApp(context.session.user, body) }),
    );
  } catch (error) {
    return createCatalogErrorResponse(error, 'INVALID_APP_REQUEST', 'Provide a valid app payload.');
  }
});
