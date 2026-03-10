import type {
  AgentLogRecord,
  AgentRecord,
  AppRecord,
  AuditRecord,
  ClientErrorRecord,
  MetricCard,
  PlatformEvent,
  ServiceHealth,
  SystemSettingItem,
  SystemSettingSection,
} from '@/types/platform';

type AppObservationInput = {
  app: AppRecord;
  agents: AgentRecord[];
  services: ServiceHealth[];
  events: PlatformEvent[];
  actions: AuditRecord[];
  clientErrors: ClientErrorRecord[];
  systemSections: SystemSettingSection[];
};

export type AppObservationModel = {
  summary: string;
  services: ServiceHealth[];
  metrics: MetricCard[];
  logs: AgentLogRecord[];
  recentEvents: PlatformEvent[];
  recentActions: AuditRecord[];
  configuration: SystemSettingItem[];
  agents: AgentRecord[];
  clientErrors: ClientErrorRecord[];
};

const runtimeServicesByApp: Record<AppRecord['runtime'], string[]> = {
  pwa: ['cloudflare-workers-gateway'],
  flutter: ['cloudflare-workers-gateway'],
  admin: ['cloudflare-workers-gateway'],
  api: [],
};

function sortByTimestampDesc<T>(items: T[], getTimestamp: (item: T) => string) {
  return [...items].sort(
    (left, right) =>
      new Date(getTimestamp(right)).getTime() -
      new Date(getTimestamp(left)).getTime(),
  );
}

function roundMetric(value: number) {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function buildSummary(
  app: AppRecord,
  services: ServiceHealth[],
  agents: AgentRecord[],
) {
  const unhealthyServices = services.filter(
    (service) => service.status !== 'healthy',
  ).length;
  const healthyClause =
    unhealthyServices > 0
      ? `${unhealthyServices} linked service${unhealthyServices === 1 ? '' : 's'} need attention`
      : 'all linked services are healthy';

  return `Single-operator inspection for ${app.name} on the private VPS. ${services.length} linked services and ${agents.length} attached automations are in scope, and ${healthyClause}.`;
}

function buildRelatedServices(app: AppRecord, services: ServiceHealth[]) {
  const serviceNames = new Set([
    'control-plane-api',
    'observability-api',
    ...runtimeServicesByApp[app.runtime],
    ...(app.agentsAttached > 0 ? ['agent-runtime'] : []),
  ]);

  return services.filter((service) => serviceNames.has(service.name));
}

function buildMetrics(
  services: ServiceHealth[],
  agents: AgentRecord[],
  events: PlatformEvent[],
  actions: AuditRecord[],
  clientErrors: ClientErrorRecord[],
): MetricCard[] {
  const serviceCount = services.length;
  const healthyCount = services.filter(
    (service) => service.status === 'healthy',
  ).length;
  const avgCpu = serviceCount
    ? roundMetric(
        services.reduce((sum, service) => sum + service.cpuPercent, 0) /
          serviceCount,
      )
    : 0;
  const peakCpu = services.reduce(
    (max, service) => Math.max(max, service.cpuPercent),
    0,
  );
  const queueDepth = agents.reduce((sum, agent) => sum + agent.queueDepth, 0);
  const activityCount = events.length + actions.length;

  return [
    {
      label: 'Linked services',
      value: `${healthyCount}/${serviceCount || 0}`,
      delta: `${Math.max(serviceCount - healthyCount, 0)} alerting`,
      trend: healthyCount === serviceCount ? 'up' : 'down',
      description:
        'Healthy linked runtime services across edge, control-plane, and observability layers.',
    },
    {
      label: 'Average CPU',
      value: `${avgCpu}%`,
      delta: `${roundMetric(peakCpu)}% peak`,
      trend: avgCpu >= 75 ? 'down' : 'up',
      description:
        'Average CPU load across the services that support this app.',
    },
    {
      label: 'Queue backlog',
      value: `${queueDepth}`,
      delta: `${agents.length} agents`,
      trend: queueDepth > Math.max(agents.length * 10, 10) ? 'down' : 'up',
      description:
        'Current automation backlog across agents attached to this app.',
    },
    {
      label: 'Recent activity',
      value: `${activityCount}`,
      delta: `${clientErrors.length} client errors`,
      trend: clientErrors.length > 0 ? 'down' : 'up',
      description: 'Recent events and operator actions captured for this app.',
    },
  ];
}

function buildLogs(
  agents: AgentRecord[],
  events: PlatformEvent[],
  actions: AuditRecord[],
  clientErrors: ClientErrorRecord[],
) {
  const agentLogs = agents.flatMap((agent) =>
    agent.logs.map((log) => ({
      ...log,
      source: `${agent.name} · ${log.source}`,
    })),
  );
  const eventLogs: AgentLogRecord[] = events.map((event) => ({
    id: `event-${event.id}`,
    level: 'info',
    source: 'event-stream',
    message: event.summary,
    timestamp: event.timestamp,
  }));
  const actionLogs: AgentLogRecord[] = actions.map((action) => ({
    id: `action-${action.id}`,
    level: action.action.includes('update') ? 'warn' : 'info',
    source: 'operator-action',
    message:
      action.summary ??
      `${action.action.replaceAll('_', ' ')} on ${action.resourceId}`,
    timestamp: action.timestamp,
  }));
  const errorLogs: AgentLogRecord[] = clientErrors.map((clientError) => ({
    id: `client-${clientError.id}`,
    level: 'error',
    source: clientError.source,
    message: clientError.message,
    timestamp: clientError.occurredAt,
  }));

  return sortByTimestampDesc(
    [...errorLogs, ...agentLogs, ...eventLogs, ...actionLogs],
    (item) => item.timestamp,
  ).slice(0, 12);
}

function buildConfiguration(
  app: AppRecord,
  services: ServiceHealth[],
  systemSections: SystemSettingSection[],
): SystemSettingItem[] {
  const pinnedSystemItems = new Set([
    'edge_api_timeout_ms',
    'service_mesh_policy',
    'prometheus_scrape_interval',
    'loki_retention_days',
  ]);

  const systemItems = systemSections
    .flatMap((section) => section.items)
    .filter((item) => pinnedSystemItems.has(item.key));

  return [
    {
      key: 'deployment_mode',
      value: 'single-operator',
      description:
        'This dashboard is operating in private VPS single-user mode.',
    },
    {
      key: 'app_id',
      value: app.id,
      description: 'Internal app identifier used for routing and inspection.',
    },
    {
      key: 'runtime',
      value: app.runtime,
      description: 'Primary runtime family for this service.',
    },
    {
      key: 'environment',
      value: app.environment,
      description: 'Deployment environment currently under observation.',
    },
    {
      key: 'region',
      value: app.region,
      description: 'Operator-defined region or placement label.',
    },
    {
      key: 'agents_attached',
      value: `${app.agentsAttached}`,
      description: 'Automation workflows currently attached to this app.',
    },
    {
      key: 'linked_services',
      value: services.map((service) => service.name).join(', ') || 'none',
      description:
        'Runtime services currently mapped into this app inspection view.',
    },
    ...systemItems,
  ];
}

export function buildAppObservationModel(
  input: AppObservationInput,
): AppObservationModel {
  const services = buildRelatedServices(input.app, input.services);
  const agents = sortByTimestampDesc(
    input.agents,
    (agent) => agent.lastHeartbeatAt,
  );
  const recentEvents = sortByTimestampDesc(
    input.events,
    (event) => event.timestamp,
  ).slice(0, 8);
  const recentActions = sortByTimestampDesc(
    input.actions,
    (action) => action.timestamp,
  ).slice(0, 8);
  const clientErrors = sortByTimestampDesc(
    input.clientErrors,
    (item) => item.occurredAt,
  ).slice(0, 8);

  return {
    summary: buildSummary(input.app, services, agents),
    services,
    metrics: buildMetrics(
      services,
      agents,
      recentEvents,
      recentActions,
      clientErrors,
    ),
    logs: buildLogs(agents, recentEvents, recentActions, clientErrors),
    recentEvents,
    recentActions,
    configuration: buildConfiguration(
      input.app,
      services,
      input.systemSections,
    ),
    agents,
    clientErrors,
  };
}
