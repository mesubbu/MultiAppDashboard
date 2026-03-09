import type { DashboardEnv } from '@/lib/env';
import type { ServiceHealth } from '@/types/platform';

export type ServiceObservabilityLinks = {
  grafana?: string;
  loki?: string;
  prometheus?: string;
};

export type ObservabilityIntegrationConfig = {
  grafanaDashboardUrl?: string;
  grafanaEmbeds: Array<{ title: string; description: string; src: string }>;
  grafanaServiceUrlTemplate?: string;
  lokiServiceUrlTemplate?: string;
  prometheusUrl?: string;
};

const templateTokenPattern = /\{(service|endpoint|layer|status)\}/g;

function normalizeOptionalValue(value: string | undefined) {
  return value || undefined;
}

function interpolateTemplate(template: string | undefined, service: ServiceHealth) {
  const normalizedTemplate = normalizeOptionalValue(template);
  if (!normalizedTemplate) {
    return undefined;
  }

  return normalizedTemplate.replace(templateTokenPattern, (_, token: string) => {
    const value =
      token === 'service'
        ? service.name
        : token === 'endpoint'
          ? service.endpoint
          : token === 'layer'
            ? service.layer
            : service.status;

    return encodeURIComponent(String(value));
  });
}

export function buildObservabilityIntegrationConfig(
  env: Pick<
    DashboardEnv,
    | 'OBSERVABILITY_GRAFANA_DASHBOARD_URL'
    | 'OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL'
    | 'OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL'
    | 'OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE'
    | 'OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE'
    | 'OBSERVABILITY_PROMETHEUS_URL'
  >,
): ObservabilityIntegrationConfig {
  return {
    grafanaDashboardUrl: normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_DASHBOARD_URL),
    grafanaEmbeds: [
      normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL)
        ? {
            title: 'Grafana overview panel',
            description: 'Live fleet health and saturation signals from Grafana.',
            src: normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL)!,
          }
        : null,
      normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL)
        ? {
            title: 'Grafana alerts panel',
            description: 'Current incidents, restarts, and alert-rule state from Grafana.',
            src: normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL)!,
          }
        : null,
    ].filter((value): value is NonNullable<typeof value> => Boolean(value)),
    grafanaServiceUrlTemplate: normalizeOptionalValue(env.OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE),
    lokiServiceUrlTemplate: normalizeOptionalValue(env.OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE),
    prometheusUrl: normalizeOptionalValue(env.OBSERVABILITY_PROMETHEUS_URL),
  };
}

export function buildServiceObservabilityLinks(
  service: ServiceHealth,
  config: ObservabilityIntegrationConfig,
): ServiceObservabilityLinks {
  return {
    grafana: interpolateTemplate(config.grafanaServiceUrlTemplate, service),
    loki: interpolateTemplate(config.lokiServiceUrlTemplate, service),
    prometheus: config.prometheusUrl,
  };
}

