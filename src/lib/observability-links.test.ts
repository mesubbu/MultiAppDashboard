import { describe, expect, it } from 'vitest';

import {
  buildObservabilityIntegrationConfig,
  buildServiceObservabilityLinks,
} from '@/lib/observability-links';
import type { ServiceHealth } from '@/types/platform';

const service: ServiceHealth = {
  name: 'control-plane-api',
  layer: 'orchestration',
  status: 'healthy',
  cpuPercent: 41,
  memoryPercent: 58,
  restarts24h: 0,
  endpoint: 'https://control-plane.internal',
};

describe('observability link helpers', () => {
  it('builds embed panels from configured Grafana URLs', () => {
    const config = buildObservabilityIntegrationConfig({
      OBSERVABILITY_GRAFANA_DASHBOARD_URL: 'https://grafana.example.com/d/platform/platform-health',
      OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: 'https://grafana.example.com/d-solo/platform/platform-health?panelId=1',
      OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: 'https://grafana.example.com/d-solo/platform/platform-health?panelId=2',
      OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: '',
      OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: '',
      OBSERVABILITY_PROMETHEUS_URL: 'https://prometheus.example.com/graph',
    });

    expect(config.grafanaEmbeds).toHaveLength(2);
    expect(config.grafanaEmbeds[0]?.title).toContain('overview');
    expect(config.grafanaDashboardUrl).toContain('grafana.example.com');
  });

  it('builds service-scoped Grafana and Loki links from templates', () => {
    const config = buildObservabilityIntegrationConfig({
      OBSERVABILITY_GRAFANA_DASHBOARD_URL: '',
      OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: '',
      OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: '',
      OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: 'https://grafana.example.com/d/service-health?var-service={service}&var-layer={layer}',
      OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: 'https://grafana.example.com/explore?query={service}&endpoint={endpoint}',
      OBSERVABILITY_PROMETHEUS_URL: 'https://prometheus.example.com/graph',
    });

    const links = buildServiceObservabilityLinks(service, config);

    expect(links.grafana).toBe(
      'https://grafana.example.com/d/service-health?var-service=control-plane-api&var-layer=orchestration',
    );
    expect(links.loki).toBe(
      'https://grafana.example.com/explore?query=control-plane-api&endpoint=https%3A%2F%2Fcontrol-plane.internal',
    );
    expect(links.prometheus).toBe('https://prometheus.example.com/graph');
  });

  it('omits service links when templates are not configured', () => {
    const config = buildObservabilityIntegrationConfig({
      OBSERVABILITY_GRAFANA_DASHBOARD_URL: '',
      OBSERVABILITY_GRAFANA_OVERVIEW_EMBED_URL: '',
      OBSERVABILITY_GRAFANA_ALERTS_EMBED_URL: '',
      OBSERVABILITY_GRAFANA_SERVICE_URL_TEMPLATE: '',
      OBSERVABILITY_LOKI_SERVICE_URL_TEMPLATE: '',
      OBSERVABILITY_PROMETHEUS_URL: '',
    });

    expect(buildServiceObservabilityLinks(service, config)).toEqual({
      grafana: undefined,
      loki: undefined,
      prometheus: undefined,
    });
  });
});

