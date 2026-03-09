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

const controlPlaneConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(0).max(65535),
  token: z.string().min(8),
  allowedOrigin: z.string().min(1),
  environment: z.enum(['development', 'test', 'production']).default('development'),
  databaseUrl: z.string().optional().or(z.literal('')),
  databasePoolMax: z.coerce.number().int().positive().default(10),
  databaseRetryAttempts: z.coerce.number().int().positive().default(3),
  databaseRetryBackoffMs: z.coerce.number().int().positive().default(250),
  databaseSsl: booleanish,
  prometheusApiUrl: z.string().url().optional().or(z.literal('')),
  prometheusTimeoutMs: z.coerce.number().int().positive().default(3000),
  prometheusCpuQuery: z.string().optional().or(z.literal('')),
  prometheusMemoryQuery: z.string().optional().or(z.literal('')),
  prometheusRestartsQuery: z.string().optional().or(z.literal('')),
  observabilityServiceAlertThresholdsJson: z.string().optional().or(z.literal('')),
  reasoningProvider: z.enum(['local', 'ollama']).default('local'),
  reasoningApiUrl: z.string().url().optional().or(z.literal('')),
  reasoningModel: z.string().optional().or(z.literal('')),
  reasoningTimeoutMs: z.coerce.number().int().positive().default(4000),
  embeddingProvider: z.enum(['local', 'ollama']).default('local'),
  embeddingApiUrl: z.string().url().optional().or(z.literal('')),
  embeddingModel: z.enum(['bge-small-en-v1.5', 'gte-small']).default('bge-small-en-v1.5'),
  embeddingDimensions: z.coerce.number().int().positive().default(1536),
  embeddingTimeoutMs: z.coerce.number().int().positive().default(4000),
  stateFile: z.string().optional().or(z.literal('')),
});

export function getControlPlaneConfig(overrides = {}) {
  const parsed = controlPlaneConfigSchema.safeParse({
    host: overrides.host ?? process.env.CONTROL_PLANE_API_HOST ?? '127.0.0.1',
    port: overrides.port ?? process.env.CONTROL_PLANE_API_PORT ?? 4100,
    token: overrides.token ?? process.env.CONTROL_PLANE_API_TOKEN ?? 'local-control-plane-token',
    allowedOrigin:
      overrides.allowedOrigin ??
      process.env.CONTROL_PLANE_ALLOWED_ORIGIN ??
      'http://localhost:3000',
    environment: overrides.environment ?? process.env.NODE_ENV ?? 'development',
    databaseUrl: overrides.databaseUrl ?? process.env.DATABASE_URL ?? '',
    databasePoolMax: overrides.databasePoolMax ?? process.env.DATABASE_POOL_MAX ?? 10,
    databaseRetryAttempts: overrides.databaseRetryAttempts ?? process.env.DATABASE_RETRY_ATTEMPTS ?? 3,
    databaseRetryBackoffMs: overrides.databaseRetryBackoffMs ?? process.env.DATABASE_RETRY_BACKOFF_MS ?? 250,
    databaseSsl: overrides.databaseSsl ?? process.env.DATABASE_SSL ?? false,
    prometheusApiUrl: overrides.prometheusApiUrl ?? process.env.OBSERVABILITY_PROMETHEUS_API_URL ?? '',
    prometheusTimeoutMs: overrides.prometheusTimeoutMs ?? process.env.OBSERVABILITY_PROMETHEUS_TIMEOUT_MS ?? 3000,
    prometheusCpuQuery: overrides.prometheusCpuQuery ?? process.env.OBSERVABILITY_PROMETHEUS_CPU_QUERY ?? '',
    prometheusMemoryQuery: overrides.prometheusMemoryQuery ?? process.env.OBSERVABILITY_PROMETHEUS_MEMORY_QUERY ?? '',
    prometheusRestartsQuery:
      overrides.prometheusRestartsQuery ?? process.env.OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY ?? '',
    observabilityServiceAlertThresholdsJson:
      overrides.observabilityServiceAlertThresholdsJson ?? process.env.OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON ?? '',
    reasoningProvider: overrides.reasoningProvider ?? process.env.REASONING_PROVIDER ?? 'local',
    reasoningApiUrl: overrides.reasoningApiUrl ?? process.env.REASONING_API_URL ?? '',
    reasoningModel: overrides.reasoningModel ?? process.env.REASONING_MODEL ?? '',
    reasoningTimeoutMs: overrides.reasoningTimeoutMs ?? process.env.REASONING_TIMEOUT_MS ?? 4000,
    embeddingProvider: overrides.embeddingProvider ?? process.env.EMBEDDING_PROVIDER ?? 'local',
    embeddingApiUrl: overrides.embeddingApiUrl ?? process.env.EMBEDDING_API_URL ?? '',
    embeddingModel: overrides.embeddingModel ?? process.env.EMBEDDING_MODEL ?? 'bge-small-en-v1.5',
    embeddingDimensions: overrides.embeddingDimensions ?? process.env.EMBEDDING_DIMENSIONS ?? 1536,
    embeddingTimeoutMs: overrides.embeddingTimeoutMs ?? process.env.EMBEDDING_TIMEOUT_MS ?? 4000,
    stateFile:
      overrides.stateFile ??
      (process.env.CONTROL_PLANE_STATE_FILE ||
      ((overrides.environment ?? process.env.NODE_ENV ?? 'development') === 'test'
        ? undefined
        : '.data/control-plane-state.json')),
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid control plane configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  return {
    ...parsed.data,
    databaseUrl: parsed.data.databaseUrl || undefined,
    prometheusApiUrl: parsed.data.prometheusApiUrl || undefined,
    prometheusCpuQuery: parsed.data.prometheusCpuQuery || undefined,
    prometheusMemoryQuery: parsed.data.prometheusMemoryQuery || undefined,
    prometheusRestartsQuery: parsed.data.prometheusRestartsQuery || undefined,
    reasoningApiUrl: parsed.data.reasoningApiUrl || undefined,
    reasoningModel: parsed.data.reasoningModel || undefined,
    embeddingApiUrl: parsed.data.embeddingApiUrl || undefined,
    observabilityServiceAlertThresholdsJson:
      parsed.data.observabilityServiceAlertThresholdsJson || undefined,
  };
}
