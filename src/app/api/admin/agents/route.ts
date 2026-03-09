import { NextResponse } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { hasListQuery, paginateItems, parseAgentListQuery } from '@/lib/catalog-list-query';
import { filterAgents } from '@/lib/control-plane-list-filters';
import { listLocalControlPlaneAgents } from '@/lib/control-plane-state.server';
import { agentListResponseSchema, agentPageResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.agents, async (request, context) => {
  const isPagedRequest = hasListQuery(request.nextUrl.searchParams);
  const proxied = await proxyCatalogRequest(`/admin/agents${request.nextUrl.search}`, context, {
    responseSchema: isPagedRequest ? agentPageResponseSchema : agentListResponseSchema,
  });
  if (proxied) {
    return proxied;
  }

  const items = await listLocalControlPlaneAgents(context.session.user);
  if (isPagedRequest) {
    const query = parseAgentListQuery(request.nextUrl.searchParams);
    return NextResponse.json(agentPageResponseSchema.parse(paginateItems(filterAgents(items, query), query)));
  }

  return NextResponse.json(agentListResponseSchema.parse({ items }));
});
