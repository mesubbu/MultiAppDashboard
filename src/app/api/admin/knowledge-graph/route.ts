import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withPermission } from '@/app/api/admin/_helpers';
import { createCatalogErrorResponse, proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { filterScopedKnowledgeGraph } from '@/lib/control-plane-fallbacks';
import { applyKnowledgeGraphQuery, parseKnowledgeGraphQuery } from '@/lib/knowledge-graph';
import { getScopeFilters } from '@/lib/scope';
import { graphEdgesData, graphNodesData } from '@/mocks/platform-data';
import { knowledgeGraphResponseSchema } from '@/types/contracts';

export const GET = withPermission(adminRoutePermissions.knowledgeGraph, async (request: NextRequest, context) => {
  try {
    const query = parseKnowledgeGraphQuery(request.nextUrl.searchParams);
    const proxied = await proxyCatalogRequest(`/admin/knowledge-graph${request.nextUrl.search}`, context, {
      responseSchema: knowledgeGraphResponseSchema,
    });
    if (proxied) {
      return proxied;
    }

    return NextResponse.json(
      knowledgeGraphResponseSchema.parse(
        applyKnowledgeGraphQuery(
          filterScopedKnowledgeGraph({ nodes: graphNodesData, edges: graphEdgesData }, getScopeFilters(context.scope)),
          query,
        ),
      ),
    );
  } catch (error) {
    return createCatalogErrorResponse(
      error,
      'INVALID_KNOWLEDGE_GRAPH_REQUEST',
      'Provide a valid knowledge graph query.',
    );
  }
});
