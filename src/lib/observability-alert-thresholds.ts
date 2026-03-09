import { z } from 'zod';

import type { DashboardEnv } from '@/lib/env';
import type {
  HealthStatus,
  ServiceAlertThresholds,
  ServiceHealth,
  ServiceThresholdAlert,
} from '@/types/platform';

const METRIC_LABELS = {
  cpuPercent: 'CPU',
  memoryPercent: 'Memory',
  restarts24h: 'Restarts / 24h',
} as const;

const DEFAULT_THRESHOLDS: Required<ServiceAlertThresholds> = {
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

type ObservabilityThresholdConfig = {
  defaults: Required<ServiceAlertThresholds>;
  services: Record<string, ServiceAlertThresholds>;
};

function normalizeServiceKey(value: string) {
  return value.trim().toLowerCase().replace(/^\//, '').replace(/[_./\s]+/g, '-');
}

function mergeThresholds(base: ServiceAlertThresholds, override?: ServiceAlertThresholds): Required<ServiceAlertThresholds> {
  return {
    cpuPercent: { ...DEFAULT_THRESHOLDS.cpuPercent, ...base.cpuPercent, ...override?.cpuPercent },
    memoryPercent: { ...DEFAULT_THRESHOLDS.memoryPercent, ...base.memoryPercent, ...override?.memoryPercent },
    restarts24h: { ...DEFAULT_THRESHOLDS.restarts24h, ...base.restarts24h, ...override?.restarts24h },
  };
}

function maxStatus(left: HealthStatus, right: HealthStatus): HealthStatus {
  const rank = { healthy: 0, degraded: 1, critical: 2 } as const;
  return rank[right] > rank[left] ? right : left;
}

export function parseObservabilityThresholdConfig(
  rawValue: Pick<DashboardEnv, 'OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON'>['OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON'],
): ObservabilityThresholdConfig {
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
      services: Object.fromEntries(
        Object.entries(parsed.data.services ?? {}).map(([serviceName, thresholds]) => [normalizeServiceKey(serviceName), thresholds]),
      ),
    };
  } catch {
    return { defaults: DEFAULT_THRESHOLDS, services: {} };
  }
}

export function resolveServiceAlertThresholds(serviceName: string, config: ObservabilityThresholdConfig) {
  return mergeThresholds(config.defaults, config.services[normalizeServiceKey(serviceName)]);
}

export function applyObservabilityAlertThresholds(
  services: ServiceHealth[],
  rawValue: Pick<DashboardEnv, 'OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON'>['OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON'],
) {
  const config = parseObservabilityThresholdConfig(rawValue);

  return services.map((service) => {
    const thresholds = resolveServiceAlertThresholds(service.name, config);
    const alerts = (Object.keys(METRIC_LABELS) as Array<keyof typeof METRIC_LABELS>).flatMap<ServiceThresholdAlert>((metric) => {
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
      status: alerts.reduce<HealthStatus>((status, alert) => maxStatus(status, alert.severity), service.status),
      thresholds,
      alerts,
    };
  });
}

export function formatServiceThresholdMetric(metric: keyof typeof METRIC_LABELS) {
  return METRIC_LABELS[metric];
}