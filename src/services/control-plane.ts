import {
  analyticsResponseSchema,
  appListResponseSchema,
  agentListResponseSchema,
  eventListResponseSchema,
  knowledgeGraphResponseSchema,
  memoryListResponseSchema,
  modelListResponseSchema,
  observabilityResponseSchema,
  overviewResponseSchema,
  systemResponseSchema,
  tenantListResponseSchema,
  toolListResponseSchema,
  userListResponseSchema,
} from '@/types/contracts';
import {
  analyticsData,
  appsData,
  agentsData,
  eventsData,
  graphEdgesData,
  graphNodesData,
  memoryData,
  modelsData,
  observabilityData,
  overviewData,
  systemData,
  tenantsData,
  toolsData,
  usersData,
} from '@/mocks/platform-data';

async function fetchOrMock<T>(path: string, schema: { parse: (value: unknown) => T }, fallback: T) {
  const baseUrl = process.env.CONTROL_PLANE_API_BASE_URL || process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  if (!baseUrl) {
    return schema.parse(fallback);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CONTROL_PLANE_API_TOKEN ?? ''}`,
      'x-tenant-id': 'platform-root',
      'x-app-id': 'control-dashboard',
      'x-user-id': 'usr_platform_admin',
    },
    next: { revalidate: 15 },
  });

  if (!response.ok) {
    throw new Error(`Control Plane request failed for ${path} (${response.status})`);
  }

  const payload = await response.json();
  return schema.parse(payload);
}

export const controlPlaneService = {
  getOverview: () => fetchOrMock('/admin/overview', overviewResponseSchema, overviewData),
  getTenants: () => fetchOrMock('/admin/tenants', tenantListResponseSchema, { items: tenantsData }),
  getApps: () => fetchOrMock('/admin/apps', appListResponseSchema, { items: appsData }),
  getUsers: () => fetchOrMock('/admin/users', userListResponseSchema, { items: usersData }),
  getAgents: () => fetchOrMock('/admin/agents', agentListResponseSchema, { items: agentsData }),
  getTools: () => fetchOrMock('/admin/tools', toolListResponseSchema, { items: toolsData }),
  getModels: () => fetchOrMock('/admin/models', modelListResponseSchema, { items: modelsData }),
  getMemory: () => fetchOrMock('/admin/memory', memoryListResponseSchema, { items: memoryData }),
  getKnowledgeGraph: () => fetchOrMock('/admin/knowledge-graph', knowledgeGraphResponseSchema, { nodes: graphNodesData, edges: graphEdgesData }),
  getEvents: () => fetchOrMock('/admin/events', eventListResponseSchema, { items: eventsData }),
  getAnalytics: () => fetchOrMock('/admin/analytics', analyticsResponseSchema, analyticsData),
  getObservability: () => fetchOrMock('/admin/observability', observabilityResponseSchema, { items: observabilityData }),
  getSystemSettings: () => fetchOrMock('/admin/system', systemResponseSchema, { sections: systemData }),
};
