import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, parseTenantListQuery } from '@/lib/catalog-list-query';
import { createCatalogTenant, listCatalogTenants, listCatalogTenantsPage } from '@/lib/admin-catalog.server';
import {
  tenantCreateRequestSchema,
  tenantListResponseSchema,
  tenantPageResponseSchema,
  tenantMutationResponseSchema,
} from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.tenants, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams);
  const proxied = await proxyCatalogRequest(`/admin/tenants${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? tenantPageResponseSchema : tenantListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  if (isPagedRequest) {
    return NextResponse.json(
      tenantPageResponseSchema.parse(
        await listCatalogTenantsPage(context.session.user, parseTenantListQuery(request.nextUrl.searchParams)),
      ),
    );
  }

  return NextResponse.json(tenantListResponseSchema.parse({ items: await listCatalogTenants(context.session.user) }));
});

export const POST = withPermission(adminRoutePermissions.tenantMutations, async (request: NextRequest, context) => {
  try {
    const body = tenantCreateRequestSchema.parse(await request.json());
    const proxied = await proxyCatalogRequest('/admin/tenants', context, {
      method: 'POST',
      body,
      responseSchema: tenantMutationResponseSchema,
    });
    if (proxied) {
      return proxied;
    }

    return NextResponse.json(tenantMutationResponseSchema.parse({ ok: true, item: await createCatalogTenant(body) }));
  } catch (error) {
    return createCatalogErrorResponse(error, 'INVALID_TENANT_REQUEST', 'Provide a valid tenant payload.');
  }
});
