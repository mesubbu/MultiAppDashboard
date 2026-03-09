import { analyticsData, appsData, agentsData, eventsData, graphEdgesData, graphNodesData, overviewData, tenantsData } from '@/mocks/platform-data';
import { filterScopedApps, filterScopedItems, filterScopedTenants, type ScopeFilters } from '@/lib/scope';

export function filterScopedKnowledgeGraph(
  fallback: { nodes: typeof graphNodesData; edges: typeof graphEdgesData },
  filters: ScopeFilters,
) {
  const nodes = filterScopedItems(fallback.nodes, filters);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: fallback.edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
    ),
  };
}

export function filterScopedOverview(
  fallback: typeof overviewData,
  filters: ScopeFilters,
) {
  if (!filters.tenantId && !filters.appId) {
    return fallback;
  }

  const scopedTenants = filterScopedTenants(tenantsData, filters);
  const scopedAgents = filterScopedItems(agentsData, filters);
  const scopedEvents = filterScopedItems(eventsData, filters);
  const runningAgents = scopedAgents.filter((agent) => agent.state === 'running').length;
  const queueBacklog = scopedAgents.reduce((sum, agent) => sum + agent.queueDepth, 0);

  return {
    ...fallback,
    metrics: [
      { ...fallback.metrics[0], value: `${scopedTenants.length}` },
      { ...fallback.metrics[1], value: `${runningAgents}` },
      { ...fallback.metrics[2], value: `${queueBacklog}` },
      fallback.metrics[3],
    ],
    runningAgents,
    queueBacklog,
    liveEventsPerMinute: scopedEvents.length * 12,
  };
}

export function filterScopedAnalytics(
  fallback: typeof analyticsData,
  filters: ScopeFilters,
) {
  if (!filters.tenantId && !filters.appId) {
    return fallback;
  }

  const scopedTenants = filterScopedTenants(tenantsData, filters);
  const scopedApps = filterScopedApps(appsData, filters);
  const scopedAgents = filterScopedItems(agentsData, filters);

  return {
    ...fallback,
    kpis: [
      { label: 'Scoped tenants', value: `${scopedTenants.length}`, change: 'context aware' },
      { label: 'Scoped apps', value: `${scopedApps.length}`, change: 'context aware' },
      {
        label: 'Scoped agent decisions',
        value: `${scopedAgents.reduce((sum, agent) => sum + agent.decisionsToday, 0)}`,
        change: 'context aware',
      },
    ],
    tenantGrowth: scopedTenants.map((tenant) => ({ label: tenant.name, value: tenant.apps })),
  };
}