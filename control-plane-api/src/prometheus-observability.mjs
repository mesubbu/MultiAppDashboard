const LABEL_KEYS = ['service', 'container', 'container_name', 'name', 'job', 'instance', 'container_label_com_docker_compose_service'];

function normalizeKey(value) {
  return value?.trim().toLowerCase().replace(/^\//, '').replace(/[_./\s]+/g, '-');
}

function resolveServiceKey(metric) {
  for (const key of LABEL_KEYS) {
    const value = normalizeKey(metric?.[key]);
    if (value) {
      return key === 'instance' ? value.split(':')[0] : value;
    }
  }
  return undefined;
}

function coerceMetricValue(field, rawValue) {
  const value = Number.parseFloat(rawValue ?? '');
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return field === 'restarts24h' ? Math.max(0, Math.round(value)) : Math.max(0, Math.min(100, Math.round(value)));
}

async function queryPrometheus(apiUrl, query, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(`/api/v1/query?${new URLSearchParams({ query })}`, apiUrl), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Prometheus query failed with status ${response.status}.`);
    }
    const payload = await response.json();
    if (payload.status !== 'success' || payload.data?.resultType !== 'vector') {
      throw new Error('Prometheus query did not return a vector response.');
    }
    return payload.data.result ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function loadPrometheusServiceMetrics(config) {
  if (!config.prometheusApiUrl) {
    return new Map();
  }

  const queries = [
    ['cpuPercent', config.prometheusCpuQuery],
    ['memoryPercent', config.prometheusMemoryQuery],
    ['restarts24h', config.prometheusRestartsQuery],
  ];
  const metrics = new Map();
  const settled = await Promise.allSettled(
    queries.filter(([, query]) => query).map(async ([field, query]) => ({
      field,
      result: await queryPrometheus(config.prometheusApiUrl, query, config.prometheusTimeoutMs ?? 3000),
    })),
  );

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    for (const sample of outcome.value.result) {
      const serviceKey = resolveServiceKey(sample.metric);
      const value = coerceMetricValue(outcome.value.field, sample.value?.[1]);
      if (!serviceKey || value === undefined) continue;
      metrics.set(serviceKey, { ...metrics.get(serviceKey), [outcome.value.field]: value });
    }
  }

  return metrics;
}

export function enrichObservabilityServices(services, metrics) {
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

