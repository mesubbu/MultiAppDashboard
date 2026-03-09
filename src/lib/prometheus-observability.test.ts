import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  enrichObservabilityServices,
  loadPrometheusServiceMetrics,
} from '@/lib/prometheus-observability';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('prometheus observability ingestion', () => {
  it('loads cpu, memory, and restart metrics keyed by service labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(
          JSON.stringify({
            status: 'success',
            data: {
              resultType: 'vector',
              result: [{ metric: { service: 'control-plane-api' }, value: [0, '71.6'] }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )),
      ),
    );

    const metrics = await loadPrometheusServiceMetrics({
      OBSERVABILITY_PROMETHEUS_API_URL: 'https://prometheus.example.com',
      OBSERVABILITY_PROMETHEUS_TIMEOUT_MS: 3_000,
      OBSERVABILITY_PROMETHEUS_CPU_QUERY: 'cpu_query',
      OBSERVABILITY_PROMETHEUS_MEMORY_QUERY: 'memory_query',
      OBSERVABILITY_PROMETHEUS_RESTARTS_QUERY: 'restart_query',
    });

    expect(metrics.get('control-plane-api')).toEqual({
      cpuPercent: 72,
      memoryPercent: 72,
      restarts24h: 72,
    });
  });

  it('enriches service rows with normalized Prometheus metrics', () => {
    const items = enrichObservabilityServices(
      [
        { name: 'agent-runtime', layer: 'orchestration', status: 'healthy', cpuPercent: 10, memoryPercent: 20, restarts24h: 0, endpoint: 'https://runtime' },
        { name: 'control-plane-api', layer: 'orchestration', status: 'healthy', cpuPercent: 30, memoryPercent: 40, restarts24h: 1, endpoint: 'https://cp' },
      ],
      new Map([
        ['agent-runtime', { cpuPercent: 55, memoryPercent: 65, restarts24h: 2 }],
        ['control_plane_api', { cpuPercent: 81, memoryPercent: 77 }],
      ] as const),
    );

    expect(items[0]?.cpuPercent).toBe(55);
    expect(items[0]?.restarts24h).toBe(2);
    expect(items[1]?.cpuPercent).toBe(81);
    expect(items[1]?.memoryPercent).toBe(77);
    expect(items[1]?.restarts24h).toBe(1);
  });
});

