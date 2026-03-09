import type { DashboardEnv } from '@/lib/env';
import type { ServiceHealth } from '@/types/platform';

const LABEL_KEYS = ['service', 'container', 'container_name', 'name', 'job', 'instance', 'container_label_com_docker_compose_service'] as const;

type MetricField = 'cpuPercent' | 'memoryPercent' | 'restarts24h';
type PrometheusConfig = Pick<DashboardEnv, 'OBSERVABILITY_PROMETHEUS_API_URL' | 'OBSERVABILITY_PROMETHEUS_TIMEOUT_MS' | 'OBSERVABILITY_PROMETHEUS_CPU_QUERY' | 'OBSERVABILITY_PROMETHEUS_MEMORY_QUERY' | 'OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY'>;
type PrometheusVectorResponse = { status: 'success' | 'error'; data?: { resultType?: string; result?: Array<{ metric?: Record<string, string>; value?: [number | string, string] }> } };

function normalizeKey(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/^\//, '').replace(/[_./\s]+/g, '-');
}

function resolveServiceKey(metric: Record<string, string> | undefined) {
  for (const key of LABEL_KEYS) {
    const value = normalizeKey(metric?.[key]);
    if (value) {
      return key === 'instance' ? value.split(':')[0] : value;
    }
  }
  return undefined;
}

function coerceMetricValue(field: MetricField, rawValue: string | undefined) {
  const value = Number.parseFloat(rawValue ?? '');
  if (!Number.isFinite(value)) {
    return undefined;
  }
  if (field === 'restarts24h') {
    return Math.max(0, Math.round(value));
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function queryPrometheus(apiUrl: string, query: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(`/api/v1/query?${new URLSearchParams({ query })}`, apiUrl), { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Prometheus query failed with status ${response.status}.`);
    }
    const payload = (await response.json()) as PrometheusVectorResponse;
    if (payload.status !== 'success' || payload.data?.resultType !== 'vector') {
      throw new Error('Prometheus query did not return a vector response.');
    }
    return payload.data.result ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPrometheusServiceMetrics(config: PrometheusConfig) {
  if (!config.OBSERVABILITY_PROMETHEUS_API_URL) {
    return new Map<string, Partial<Record<MetricField, number>>>();
  }

  const queries: Array<[MetricField, string | undefined]> = [
    ['cpuPercent', config.OBSERVABILITY_PROMETHEUS_CPU_QUERY],
    ['memoryPercent', config.OBSERVABILITY_PROMETHEUS_MEMORY_QUERY],
    ['restarts24h', config.OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY],
  ];
  const timeoutMs = config.OBSERVABILITY_PROMETHEUS_TIMEOUT_MS ?? 3_000;
  const metrics = new Map<string, Partial<Record<MetricField, number>>>();
  const settled = await Promise.allSettled(
    queries.filter(([, query]) => query).map(async ([field, query]) => {
      const result = await queryPrometheus(config.OBSERVABILITY_PROMETHEUS_API_URL!, query!, timeoutMs);
      return { field, result };
    }),
  );

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') {
      continue;
    }
    for (const sample of outcome.value.result) {
      const serviceKey = resolveServiceKey(sample.metric);
      const value = coerceMetricValue(outcome.value.field, sample.value?.[1]);
      if (!serviceKey || value === undefined) {
        continue;
      }
      metrics.set(serviceKey, { ...metrics.get(serviceKey), [outcome.value.field]: value });
    }
  }

  return metrics;
}

export function enrichObservabilityServices(
  services: ServiceHealth[],
  metrics: Map<string, Partial<Record<MetricField, number>>>,
) {
  return services.map((service) => {
    const key = normalizeKey(service.name);
    const match = key
      ? metrics.get(key) ??
        [...metrics.entries()].find(([candidate]) => {
          const normalizedCandidate = normalizeKey(candidate);
          return normalizedCandidate ? normalizedCandidate.includes(key) || key.includes(normalizedCandidate) : false;
        })?.[1]
      : undefined;
    return match
      ? {
          ...service,
          cpuPercent: match.cpuPercent ?? service.cpuPercent,
          memoryPercent: match.memoryPercent ?? service.memoryPercent,
          restarts24h: match.restarts24h ?? service.restarts24h,
        }
      : service;
  });
}

