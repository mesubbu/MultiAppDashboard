import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  enrichObservabilityServices,
  loadPrometheusServiceMetrics,
} from './prometheus-observability.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('control-plane prometheus observability ingestion', () => {
  it('loads Prometheus vector samples into a service metrics map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(new Response(
          JSON.stringify({
            status: 'success',
            data: {
              resultType: 'vector',
              result: [{ metric: { container: 'agent-runtime' }, value: [0, '44.4'] }],
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )),
      ),
    );

    const metrics = await loadPrometheusServiceMetrics({
      prometheusApiUrl: 'https://prometheus.example.com',
      prometheusCpuQuery: 'cpu',
      prometheusMemoryQuery: 'memory',
      prometheusRestartsQuery: 'restarts',
      prometheusTimeoutMs: 3_000,
    });

    expect(metrics.get('agent-runtime')).toEqual({
      cpuPercent: 44,
      memoryPercent: 44,
      restarts24h: 44,
    });
  });

  it('merges Prometheus values into service health rows', () => {
    const items = enrichObservabilityServices(
      [{ name: 'control-plane-api', status: 'healthy', cpuPercent: 10, memoryPercent: 20, restarts24h: 0, layer: 'orchestration', endpoint: 'https://cp' }],
      new Map([['control_plane_api', { cpuPercent: 90, memoryPercent: 80, restarts24h: 2 }]]),
    );

    expect(items[0]).toMatchObject({ cpuPercent: 90, memoryPercent: 80, restarts24h: 2 });
  });
});

