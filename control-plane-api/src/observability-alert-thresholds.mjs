import { z } from 'zod';

const DEFAULT_THRESHOLDS = {
  cpuPercent: { degraded: 75, critical: 90 },
  memoryPercent: { degraded: 80, critical: 90 },
  restarts24h: { degraded: 1, critical: 3 },
};

const metricThresholdSchema = z
  .object({ degraded: z.number().nonnegative().optional(), critical: z.number().nonnegative().optional() })
  .refine((value) => value.degraded === undefined || value.critical === undefined || value.critical >= value.degraded, {
    message: 'critical must be greater than or equal to degraded',
  });

const thresholdProfileSchema = z.object({
  cpuPercent: metricThresholdSchema.optional(),
  memoryPercent: metricThresholdSchema.optional(),
  restarts24h: metricThresholdSchema.optional(),
});

const thresholdConfigSchema = z.object({
  defaults: thresholdProfileSchema.optional(),
  services: z.record(z.string(), thresholdProfileSchema).optional(),
});

function normalizeServiceKey(value) {
  return value.trim().toLowerCase().replace(/^\//, '').replace(/[_./\s]+/g, '-');
}

function mergeThresholds(base, override) {
  return {
    cpuPercent: { ...DEFAULT_THRESHOLDS.cpuPercent, ...base?.cpuPercent, ...override?.cpuPercent },
    memoryPercent: { ...DEFAULT_THRESHOLDS.memoryPercent, ...base?.memoryPercent, ...override?.memoryPercent },
    restarts24h: { ...DEFAULT_THRESHOLDS.restarts24h, ...base?.restarts24h, ...override?.restarts24h },
  };
}

function maxStatus(left, right) {
  const rank = { healthy: 0, degraded: 1, critical: 2 };
  return rank[right] > rank[left] ? right : left;
}

export function parseObservabilityThresholdConfig(rawValue) {
  if (!rawValue) {
    return { defaults: DEFAULT_THRESHOLDS, services: {} };
  }

  try {
    const parsed = thresholdConfigSchema.safeParse(JSON.parse(rawValue));
    if (!parsed.success) {
      return { defaults: DEFAULT_THRESHOLDS, services: {} };
    }
    return {
      defaults: mergeThresholds(DEFAULT_THRESHOLDS, parsed.data.defaults),
      services: Object.fromEntries(Object.entries(parsed.data.services ?? {}).map(([serviceName, thresholds]) => [normalizeServiceKey(serviceName), thresholds])),
    };
  } catch {
    return { defaults: DEFAULT_THRESHOLDS, services: {} };
  }
}

export function resolveServiceAlertThresholds(serviceName, config) {
  return mergeThresholds(config.defaults, config.services[normalizeServiceKey(serviceName)]);
}

export function applyObservabilityAlertThresholds(services, rawValue) {
  const config = parseObservabilityThresholdConfig(rawValue);
  return services.map((service) => {
    const thresholds = resolveServiceAlertThresholds(service.name, config);
    const alerts = ['cpuPercent', 'memoryPercent', 'restarts24h'].flatMap((metric) => {
      const threshold = thresholds[metric];
      const actualValue = service[metric];
      if (threshold.critical !== undefined && actualValue >= threshold.critical) {
        return [{ metric, severity: 'critical', actualValue, thresholdValue: threshold.critical }];
      }
      if (threshold.degraded !== undefined && actualValue >= threshold.degraded) {
        return [{ metric, severity: 'degraded', actualValue, thresholdValue: threshold.degraded }];
      }
      return [];
    });
    return {
      ...service,
      status: alerts.reduce((status, alert) => maxStatus(status, alert.severity), service.status),
      thresholds,
      alerts,
    };
  });
}