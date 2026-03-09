import { isWithinDateRange, isWithinTimeRange } from '@/lib/catalog-list-query';
import type {
  AgentRecord,
  AgentState,
  AuditRecord,
  ClientErrorRecord,
  MemoryRecord,
  PlatformEvent,
  ServiceHealth,
  ToolRecord,
} from '@/types/platform';
import type {
  AgentListQuery,
  AuditListQuery,
  EventListQuery,
  MemoryListQuery,
  ObservabilityListQuery,
  ToolListQuery,
} from '@/lib/catalog-list-query';

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) {
    return true;
  }
  const normalizedQuery = query.toLowerCase();
  return values.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function filterAgents(items: AgentRecord[], query: AgentListQuery) {
  return items.filter((item) => {
    if (query.tenantId && item.tenantId !== query.tenantId) return false;
    if (query.appId && item.appId !== query.appId) return false;
    if (query.status && item.state !== query.status) return false;
    if (!isWithinTimeRange(item.lastHeartbeatAt, query.timeRange)) return false;
    return includesQuery([item.id, item.name, item.queue, item.workflowVersion], query.query);
  });
}

export function filterTools(items: ToolRecord[], query: ToolListQuery) {
  return items.filter((item) =>
    includesQuery([item.name, item.description, item.schema.join(' '), item.permissions.join(' '), item.riskLevel, item.executionMode, item.safetyGuards.join(' ')], query.query),
  );
}

export function filterEvents(items: PlatformEvent[], query: EventListQuery) {
  return items.filter((item) => {
    if (query.tenantId && item.tenantId !== query.tenantId) return false;
    if (query.appId && item.appId !== query.appId) return false;
    if (query.eventType && item.type !== query.eventType) return false;
    if (!isWithinTimeRange(item.timestamp, query.timeRange)) return false;
    return includesQuery([item.id, item.type, item.actor, item.summary], query.query);
  });
}

export function filterMemory(items: MemoryRecord[], query: MemoryListQuery) {
  return items.filter((item) => {
    if (query.tenantId && item.tenantId !== query.tenantId) return false;
    if (query.appId && item.appId !== query.appId) return false;
    if (query.scope && item.scope !== query.scope) return false;
    if (!isWithinTimeRange(item.lastCompactionAt, query.timeRange)) return false;
    return includesQuery([item.id, item.scope, item.tenantId, item.appId ?? undefined], query.query);
  });
}

export function filterObservabilityItems(items: ServiceHealth[], query: ObservabilityListQuery) {
  return items.filter((item) => {
    if (query.status && item.status !== query.status) return false;
    return includesQuery([item.name, item.layer, item.endpoint], query.query);
  });
}

export function filterClientErrors(items: ClientErrorRecord[], query: ObservabilityListQuery) {
  return items.filter((item) => {
    if (query.tenantId && item.tenantId !== query.tenantId) return false;
    if (query.appId && item.appId !== query.appId) return false;
    if (!isWithinTimeRange(item.occurredAt, query.timeRange)) return false;
    return includesQuery([item.id, item.kind, item.source, item.message, item.pathname ?? undefined], query.query);
  });
}

export function filterAuditLogs(items: AuditRecord[], query: AuditListQuery) {
  return items.filter((item) => {
    if (query.tenantId && item.tenantId !== query.tenantId) return false;
    if (query.appId && item.appId !== query.appId) return false;
    if (query.actor && item.actor !== query.actor) return false;
    if (query.action && item.action !== query.action) return false;
    if (query.resourceType && item.resourceType !== query.resourceType) return false;
    if (!isWithinDateRange(item.timestamp, query.from, query.to)) return false;
    return includesQuery([item.actor, item.actorDisplay, item.resourceId, item.summary], query.query);
  });
}

export function countAgentsByState(items: AgentRecord[], state: AgentState) {
  return items.filter((item) => item.state === state).length;
}