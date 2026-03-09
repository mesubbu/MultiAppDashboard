import type { ModelRecord, PlatformOverview, ServiceHealth } from '@/types/platform';

export type LiveServiceResource = Pick<ServiceHealth, 'name' | 'status'> & {
  cpuPercent: number;
  memoryPercent: number;
};

export type LiveModelLatency = Pick<ModelRecord, 'key' | 'service' | 'activeModel' | 'latencyMs' | 'errorRate'>;

export type ObservabilityLiveSnapshot = {
  capturedAt: string;
  queueBacklog: number;
  runningAgents: number;
  liveEventsPerMinute: number;
  services: LiveServiceResource[];
  models: LiveModelLatency[];
};

export function buildObservabilityLiveSnapshot(input: {
  overview: PlatformOverview;
  observability: { items: ServiceHealth[] };
  models: { items: ModelRecord[] };
  capturedAt?: string;
}): ObservabilityLiveSnapshot {
  return {
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    queueBacklog: input.overview.queueBacklog,
    runningAgents: input.overview.runningAgents,
    liveEventsPerMinute: input.overview.liveEventsPerMinute,
    services: [...input.observability.items]
      .sort((left, right) => Math.max(right.cpuPercent, right.memoryPercent) - Math.max(left.cpuPercent, left.memoryPercent))
      .map((service) => ({
        name: service.name,
        status: service.status,
        cpuPercent: service.cpuPercent,
        memoryPercent: service.memoryPercent,
      })),
    models: [...input.models.items]
      .sort((left, right) => right.latencyMs - left.latencyMs)
      .map((model) => ({
        key: model.key,
        service: model.service,
        activeModel: model.activeModel,
        latencyMs: model.latencyMs,
        errorRate: model.errorRate,
      })),
  };
}

export function appendObservabilitySnapshot(
  history: ObservabilityLiveSnapshot[],
  next: ObservabilityLiveSnapshot,
  maxItems = 12,
) {
  return [...history, next].slice(-maxItems);
}