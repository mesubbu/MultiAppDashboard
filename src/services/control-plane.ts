import {
  analyticsResponseSchema,
  appListResponseSchema,
  appPageResponseSchema,
  agentListResponseSchema,
  agentPageResponseSchema,
  eventListResponseSchema,
  eventPageResponseSchema,
  knowledgeGraphResponseSchema,
  memoryListResponseSchema,
  memoryPageResponseSchema,
  modelListResponseSchema,
  observabilityResponseSchema,
  observabilityPageResponseSchema,
  overviewResponseSchema,
  systemResponseSchema,
  tenantListResponseSchema,
  tenantPageResponseSchema,
  auditPageResponseSchema,
  agentPerformanceListResponseSchema,
  toolListResponseSchema,
  toolPageResponseSchema,
  userListResponseSchema,
  userPageResponseSchema,
  recommendationListResponseSchema,
} from '@/types/contracts';
import {
  graphEdgesData,
  graphNodesData,
  memoryData,
  overviewData,
  toolsData,
  analyticsData,
  recommendationsData,
  agentPerformanceData,
} from '@/mocks/platform-data';
import { getCurrentSessionUser } from '@/lib/session';
import {
  type AgentListQuery,
  type AppListQuery,
  type AuditListQuery,
  type EventListQuery,
  type MemoryListQuery,
  type ObservabilityListQuery,
  type TenantListQuery,
  type ToolListQuery,
  type UserListQuery,
  paginateItems,
} from '@/lib/catalog-list-query';
import {
  filterScopedItems,
  getScopeFilters,
} from '@/lib/scope';
import {
  CircuitBreakerOpenError,
  CONTROL_PLANE_REMOTE_CIRCUIT_KEY,
  runWithCircuitBreaker,
} from '@/lib/circuit-breaker';
import {
  filterScopedAnalytics,
  filterScopedKnowledgeGraph,
  filterScopedOverview,
} from '@/lib/control-plane-fallbacks';
import {
  applyKnowledgeGraphQuery,
  buildKnowledgeGraphPath,
  type KnowledgeGraphQuery,
} from '@/lib/knowledge-graph';
import {
  filterAgents,
  filterAuditLogs,
  filterClientErrors,
  filterEvents,
  filterMemory,
  filterObservabilityItems,
  filterTools,
} from '@/lib/control-plane-list-filters';
import { listObservabilityServices, listScopedClientErrors } from '@/lib/observability.server';

type FetchOrMockOptions<T> = {
  includeScopeQuery?: boolean;
  filterFallback?: (fallback: T, filters: ReturnType<typeof getScopeFilters>) => T;
};

export class ControlPlaneServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ControlPlaneServiceError';
  }
}

async function parseErrorPayload(response: Response) {
  return response.json().catch(() => null) as Promise<
    | { error?: { code?: string; message?: string } }
    | null
  >;
}

function getFriendlyControlPlaneMessage(path: string, statusCode?: number) {
  if (statusCode === 401) {
    return 'Your session expired while loading the control plane. Sign in again and retry.';
  }
  if (statusCode === 403) {
    return 'You do not have permission to view this control-plane resource.';
  }
  if (statusCode === 429) {
    return 'The control plane is temporarily rate limited. Wait a moment, then retry.';
  }
  if (statusCode && statusCode >= 500) {
    return 'The control plane is temporarily unavailable. Retry in a moment.';
  }
  return `Unable to load the latest control-plane data for ${path}. Retry in a moment.`;
}

function getInvalidControlPlaneResponseMessage() {
  return 'The control plane returned an invalid response. Retry in a moment.';
}

function getCircuitOpenControlPlaneMessage(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `The control plane circuit breaker is open after repeated failures. Retry in about ${retryAfterSeconds}s.`;
}

function shouldTripControlPlaneCircuit(error: unknown) {
  return error instanceof ControlPlaneServiceError
    ? error.statusCode === 429 || (error.statusCode ?? 0) >= 500
    : true;
}

async function fetchOrMock<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  fallback: T,
  options: FetchOrMockOptions<T> = {},
) {
  const baseUrl = process.env.CONTROL_PLANE_API_BASE_URL || process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    throw new ControlPlaneServiceError('Your session expired. Sign in again to continue.', 401, 'UNAUTHORIZED');
  }
  const scopeFilters = getScopeFilters(sessionUser);

  if (!baseUrl) {
    try {
      const scopedFallback = options.filterFallback
        ? options.filterFallback(fallback, scopeFilters)
        : fallback;
      return schema.parse(scopedFallback);
    } catch {
      throw new ControlPlaneServiceError(
        'The dashboard generated an invalid fallback response. Retry in a moment.',
        500,
        'INVALID_FALLBACK_RESPONSE',
      );
    }
  }

  const url = new URL(path, baseUrl);
  if (options.includeScopeQuery) {
    if (scopeFilters.tenantId) {
      url.searchParams.set('tenant_id', scopeFilters.tenantId);
    }
    if (scopeFilters.appId) {
      url.searchParams.set('app_id', scopeFilters.appId);
    }
  }

  try {
    return await runWithCircuitBreaker(
      CONTROL_PLANE_REMOTE_CIRCUIT_KEY,
      async () => {
        const response = await fetch(url.toString(), {
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.CONTROL_PLANE_API_TOKEN ?? ''}`,
            'x-tenant-id': sessionUser.tenantId,
            'x-app-id': sessionUser.appId,
            'x-user-id': sessionUser.userId,
            'x-user-roles': sessionUser.roles.join(','),
          },
          next: { revalidate: 15 },
        });

        if (!response.ok) {
          const payload = await parseErrorPayload(response);
          throw new ControlPlaneServiceError(
            payload?.error?.message ?? getFriendlyControlPlaneMessage(path, response.status),
            response.status,
            payload?.error?.code ?? 'CONTROL_PLANE_REQUEST_FAILED',
          );
        }

        const payload = await response.json().catch(() => {
          throw new ControlPlaneServiceError(
            getInvalidControlPlaneResponseMessage(),
            502,
            'INVALID_CONTROL_PLANE_RESPONSE',
          );
        });

        try {
          return schema.parse(payload);
        } catch {
          throw new ControlPlaneServiceError(
            getInvalidControlPlaneResponseMessage(),
            502,
            'INVALID_CONTROL_PLANE_RESPONSE',
          );
        }
      },
      { shouldTrip: shouldTripControlPlaneCircuit },
    );
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      throw new ControlPlaneServiceError(
        getCircuitOpenControlPlaneMessage(error.retryAfterMs),
        503,
        'CONTROL_PLANE_CIRCUIT_OPEN',
      );
    }

    if (error instanceof ControlPlaneServiceError) {
      throw error;
    }

    throw new ControlPlaneServiceError(
      getFriendlyControlPlaneMessage(path, 502),
      502,
      'CONTROL_PLANE_UNAVAILABLE',
    );
  }
}

async function getLocalOrRemote<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  getLocal: (user: NonNullable<Awaited<ReturnType<typeof getCurrentSessionUser>>>) => Promise<T>,
  options: { includeScopeQuery?: boolean } = {},
) {
  const baseUrl = process.env.CONTROL_PLANE_API_BASE_URL || process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    throw new ControlPlaneServiceError('Your session expired. Sign in again to continue.', 401, 'UNAUTHORIZED');
  }

  if (!baseUrl) {
    try {
      return schema.parse(await getLocal(sessionUser));
    } catch (error) {
      if (error instanceof ControlPlaneServiceError) {
        throw error;
      }

      throw new ControlPlaneServiceError(
        getFriendlyControlPlaneMessage(path, 500),
        500,
        'LOCAL_CONTROL_PLANE_REQUEST_FAILED',
      );
    }
  }

  return fetchOrMock(path, schema, await getLocal(sessionUser), { includeScopeQuery: options.includeScopeQuery });
}

function buildCatalogListPath(
  path: string,
  query: {
    page: number;
    pageSize: number;
    cursor?: string;
    query?: string;
    tenantId?: string;
    appId?: string;
    status?: string;
    timeRange?: string;
    environment?: string;
    role?: string;
    eventType?: string;
    scope?: string;
    actor?: string;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
  },
) {
  const url = new URL(path, 'https://dashboard.local');
  url.searchParams.set('page', `${query.page}`);
  url.searchParams.set('page_size', `${query.pageSize}`);
  if (query.cursor) {
    url.searchParams.set('cursor', query.cursor);
  }
  if (query.query) {
    url.searchParams.set('q', query.query);
  }
  if (query.tenantId) {
    url.searchParams.set('tenant_id', query.tenantId);
  }
  if (query.appId) {
    url.searchParams.set('app_id', query.appId);
  }
  if (query.status) {
    url.searchParams.set('status', query.status);
  }
  if (query.timeRange) {
    url.searchParams.set('time_range', query.timeRange);
  }
  if (query.environment) {
    url.searchParams.set('environment', query.environment);
  }
  if (query.role) {
    url.searchParams.set('role', query.role);
  }
  if (query.eventType) {
    url.searchParams.set('event_type', query.eventType);
  }
  if (query.scope) {
    url.searchParams.set('scope', query.scope);
  }
  if (query.actor) {
    url.searchParams.set('actor', query.actor);
  }
  if (query.action) {
    url.searchParams.set('action', query.action);
  }
  if (query.resourceType) {
    url.searchParams.set('resource_type', query.resourceType);
  }
  if (query.from) {
    url.searchParams.set('from', query.from);
  }
  if (query.to) {
    url.searchParams.set('to', query.to);
  }
  return `${url.pathname}${url.search}`;
}

export const controlPlaneService = {
  getOverview: () =>
    fetchOrMock('/admin/overview', overviewResponseSchema, overviewData, {
      includeScopeQuery: true,
      filterFallback: filterScopedOverview,
    }),
  getTenants: async () =>
    getLocalOrRemote('/admin/tenants', tenantListResponseSchema, async (sessionUser) => {
      const { listCatalogTenants } = await import('@/lib/admin-catalog.server');
      return { items: await listCatalogTenants(sessionUser) };
    }, { includeScopeQuery: true }),
  getApps: async () =>
    getLocalOrRemote('/admin/apps', appListResponseSchema, async (sessionUser) => {
      const { listCatalogApps } = await import('@/lib/admin-catalog.server');
      return { items: await listCatalogApps(sessionUser) };
    }, { includeScopeQuery: true }),
  getUsers: async () =>
    getLocalOrRemote('/admin/users', userListResponseSchema, async (sessionUser) => {
      const { listCatalogUsers } = await import('@/lib/admin-catalog.server');
      return { items: await listCatalogUsers(sessionUser) };
    }, { includeScopeQuery: true }),
  getTenantPage: async (query: TenantListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/tenants', query), tenantPageResponseSchema, async (sessionUser) => {
      const { listCatalogTenantsPage } = await import('@/lib/admin-catalog.server');
      return listCatalogTenantsPage(sessionUser, query);
    }, { includeScopeQuery: true }),
  getAppPage: async (query: AppListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/apps', query), appPageResponseSchema, async (sessionUser) => {
      const { listCatalogAppsPage } = await import('@/lib/admin-catalog.server');
      return listCatalogAppsPage(sessionUser, query);
    }, { includeScopeQuery: true }),
  getUserPage: async (query: UserListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/users', query), userPageResponseSchema, async (sessionUser) => {
      const { listCatalogUsersPage } = await import('@/lib/admin-catalog.server');
      return listCatalogUsersPage(sessionUser, query);
    }, { includeScopeQuery: true }),
  getAgents: async () =>
    getLocalOrRemote('/admin/agents', agentListResponseSchema, async (sessionUser) => {
      const { listLocalControlPlaneAgents } = await import('@/lib/control-plane-state.server');
      return { items: await listLocalControlPlaneAgents(sessionUser) };
    }, { includeScopeQuery: true }),
  getAgentPage: async (query: AgentListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/agents', query), agentPageResponseSchema, async (sessionUser) => {
      const { listLocalControlPlaneAgents } = await import('@/lib/control-plane-state.server');
      return paginateItems(filterAgents(await listLocalControlPlaneAgents(sessionUser), query), query);
    }, { includeScopeQuery: true }),
  getTools: () => fetchOrMock('/admin/tools', toolListResponseSchema, { items: toolsData }),
  getToolPage: async (query: ToolListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/tools', query), toolPageResponseSchema, async () =>
      paginateItems(filterTools(toolsData, query), query), { includeScopeQuery: true }),
  getModels: async () =>
    getLocalOrRemote('/admin/models', modelListResponseSchema, async () => {
      const { listLocalControlPlaneModels } = await import('@/lib/control-plane-state.server');
      return { items: await listLocalControlPlaneModels() };
    }),
  getMemory: () =>
    fetchOrMock('/admin/memory', memoryListResponseSchema, { items: memoryData }, {
      includeScopeQuery: true,
      filterFallback: (fallback, filters) => ({ items: filterScopedItems(fallback.items, filters) }),
    }),
  getMemoryPage: async (query: MemoryListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/memory', query), memoryPageResponseSchema, async (sessionUser) =>
      paginateItems(filterMemory(filterScopedItems(memoryData, getScopeFilters(sessionUser)), query), query), { includeScopeQuery: true }),
  getKnowledgeGraph: (query: KnowledgeGraphQuery = {}) =>
    fetchOrMock(
      buildKnowledgeGraphPath('/admin/knowledge-graph', query),
      knowledgeGraphResponseSchema,
      { nodes: graphNodesData, edges: graphEdgesData },
      {
        includeScopeQuery: true,
        filterFallback: (fallback, filters) =>
          applyKnowledgeGraphQuery(filterScopedKnowledgeGraph(fallback, filters), query),
      },
    ),
  getEvents: async () =>
    getLocalOrRemote('/admin/events', eventListResponseSchema, async (sessionUser) => {
      const { listLocalControlPlaneEvents } = await import('@/lib/control-plane-state.server');
      return { items: await listLocalControlPlaneEvents(sessionUser) };
    }, { includeScopeQuery: true }),
  getEventPage: async (query: EventListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/events', query), eventPageResponseSchema, async (sessionUser) => {
      const { listLocalControlPlaneEvents } = await import('@/lib/control-plane-state.server');
      return paginateItems(filterEvents(await listLocalControlPlaneEvents(sessionUser), query), query);
    }, { includeScopeQuery: true }),
  getAnalytics: () =>
    fetchOrMock('/admin/analytics', analyticsResponseSchema, analyticsData, {
      includeScopeQuery: true,
      filterFallback: filterScopedAnalytics,
    }),
  getRecommendations: () =>
    fetchOrMock('/admin/recommendations?limit=6', recommendationListResponseSchema, { items: recommendationsData }, {
      includeScopeQuery: true,
      filterFallback: (fallback, filters) => ({ items: filterScopedItems(fallback.items, filters) }),
    }),
  getAgentPerformance: () =>
    fetchOrMock('/admin/agent-performance?limit=6', agentPerformanceListResponseSchema, {
      items: agentPerformanceData,
      summary: {
        totalOutcomes: 32,
        averageSuccessRate: 0.77,
        averageFeedbackScore: 0.75,
        improvingAgents: 1,
        topPerformers: agentPerformanceData.slice(0, 2),
      },
    }, {
      includeScopeQuery: true,
      filterFallback: (fallback, filters) => ({
        ...fallback,
        items: filterScopedItems(fallback.items, filters),
        summary: {
          ...fallback.summary,
          topPerformers: filterScopedItems(fallback.summary.topPerformers, filters),
        },
      }),
    }),
  getObservability: async () =>
    getLocalOrRemote('/admin/observability', observabilityResponseSchema, async (sessionUser) => ({
      items: await listObservabilityServices(),
      clientErrors: await listScopedClientErrors(sessionUser),
    }), { includeScopeQuery: true }),
  getObservabilityPage: async (query: ObservabilityListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/observability', query), observabilityPageResponseSchema, async (sessionUser) => {
      const items = await listObservabilityServices();
      const clientErrors = await listScopedClientErrors(sessionUser);
      return {
        ...paginateItems(filterObservabilityItems(items, query), query),
        clientErrors: filterClientErrors(clientErrors, query),
      };
    }, { includeScopeQuery: true }),
  getAuditPage: async (query: AuditListQuery) =>
    getLocalOrRemote(buildCatalogListPath('/admin/audit', query), auditPageResponseSchema, async (sessionUser) => {
      const { listLocalControlPlaneAuditLogs } = await import('@/lib/control-plane-state.server');
      return paginateItems(filterAuditLogs(await listLocalControlPlaneAuditLogs(sessionUser), query), query);
    }, { includeScopeQuery: true }),
  getSystemSettings: async () =>
    getLocalOrRemote('/admin/system', systemResponseSchema, async () => {
      const { getLocalControlPlaneSystem } = await import('@/lib/control-plane-state.server');
      return { sections: await getLocalControlPlaneSystem() };
    }),
};
