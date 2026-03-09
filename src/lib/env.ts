import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    if (!value) {
      return false;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  });

const dashboardEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    SESSION_SECRET: z.string().min(32).optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
    SESSION_ROTATION_WINDOW_SECONDS: z.coerce.number().int().positive().default(60 * 30),
    DATABASE_URL: z.string().optional().or(z.literal('')),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
    DATABASE_RETRY_BACKOFF_MS: z.coerce.number().int().positive().default(250),
    DATABASE_SSL: booleanish,
    AUTH_STATE_FILE: z.string().optional().or(z.literal('')),
    ADMIN_CATALOG_STATE_FILE: z.string().optional().or(z.literal('')),
    CONTROL_PLANE_STATE_FILE: z.string().optional().or(z.literal('')),
    CONTROL_PLANE_API_BASE_URL: z.string().url().optional().or(z.literal('')),
    NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL: z.string().url().optional().or(z.literal('')),
    CONTROL_PLANE_API_TOKEN: z.string().optional(),
    OBSERVABILITY_GRAFANA_DASHBOARD_URL: z.string().url().optional().or(z.literal('')),
    OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: z.string().url().optional().or(z.literal('')),
    OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: z.string().url().optional().or(z.literal('')),
    OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: z.string().optional().or(z.literal('')),
    OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: z.string().optional().or(z.literal('')),
    OBSERVABILITY_PROMETHEUS_URL: z.string().url().optional().or(z.literal('')),
    OBSERVABILITY_PROMETHEUS_API_URL: z.string().url().optional().or(z.literal('')),
    OBSERVABILITY_PROMETHEUS_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
    OBSERVABILITY_PROMETHEUS_CPU_QUERY: z.string().optional().or(z.literal('')),
    OBSERVABILITY_PROMETHEUS_MEMORY_QUERY: z.string().optional().or(z.literal('')),
    OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY: z.string().optional().or(z.literal('')),
    OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON: z.string().optional().or(z.literal('')),
    ADMIN_MFA_TEST_CODE: z.string().min(6).default('000000'),
  })
  .transform((env) => ({
    ...env,
    DATABASE_URL: env.DATABASE_URL || undefined,
    AUTH_STATE_FILE:
      env.AUTH_STATE_FILE || (env.NODE_ENV === 'test' ? undefined : '.data/dashboard-auth.json'),
    ADMIN_CATALOG_STATE_FILE:
      env.ADMIN_CATALOG_STATE_FILE || (env.NODE_ENV === 'test' ? undefined : '.data/dashboard-admin-catalog.json'),
    CONTROL_PLANE_STATE_FILE:
      env.CONTROL_PLANE_STATE_FILE || (env.NODE_ENV === 'test' ? undefined : '.data/control-plane-state.json'),
    CONTROL_PLANE_API_BASE_URL: env.CONTROL_PLANE_API_BASE_URL || undefined,
    NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL: env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL || undefined,
    OBSERVABILITY_GRAFANA_DASHBOARD_URL: env.OBSERVABILITY_GRAFANA_DASHBOARD_URL || undefined,
    OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: env.OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL || undefined,
    OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: env.OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL || undefined,
    OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: env.OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE || undefined,
    OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: env.OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE || undefined,
    OBSERVABILITY_PROMETHEUS_URL: env.OBSERVABILITY_PROMETHEUS_URL || undefined,
    OBSERVABILITY_PROMETHEUS_API_URL: env.OBSERVABILITY_PROMETHEUS_API_URL || undefined,
    OBSERVABILITY_PROMETHEUS_CPU_QUERY: env.OBSERVABILITY_PROMETHEUS_CPU_QUERY || undefined,
    OBSERVABILITY_PROMETHEUS_MEMORY_QUERY: env.OBSERVABILITY_PROMETHEUS_MEMORY_QUERY || undefined,
    OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY: env.OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY || undefined,
    OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON: env.OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON || undefined,
    SESSION_SECRET:
      env.SESSION_SECRET ||
      (env.NODE_ENV === 'production'
        ? undefined
        : 'local-dev-session-secret-change-me-1234567890'),
  }));

export type DashboardEnv = z.infer<typeof dashboardEnvSchema>;

let cachedDashboardEnv: DashboardEnv | null = null;

export function getDashboardEnv() {
  if (cachedDashboardEnv) {
    return cachedDashboardEnv;
  }

  const parsed = dashboardEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid dashboard environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  if (!parsed.data.SESSION_SECRET) {
    throw new Error(
      'Invalid dashboard environment configuration: SESSION_SECRET is required in production and must be at least 32 characters.',
    );
  }

  cachedDashboardEnv = parsed.data;
  return cachedDashboardEnv;
}

export function resetDashboardEnvForTests() {
  cachedDashboardEnv = null;
}