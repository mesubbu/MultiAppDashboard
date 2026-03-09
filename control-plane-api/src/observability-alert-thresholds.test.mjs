import { describe, expect, it } from 'vitest';

import {
  applyObservabilityAlertThresholds,
  parseObservabilityThresholdConfig,
  resolveServiceAlertThresholds,
} from './observability-alert-thresholds.mjs';

describe('control-plane observability alert thresholds', () => {
  it('parses defaults and per-service overrides', () => {
    const config = parseObservabilityThresholdConfig(
      JSON.stringify({
        defaults: { memoryPercent: { degraded: 72, critical: 84 } },
        services: { 'observability-api': { cpuPercent: { degraded: 65, critical: 80 } } },
      }),
    );

    expect(resolveServiceAlertThresholds('observability_api', config)).toMatchObject({
      cpuPercent: { degraded: 65, critical: 80 },
      memoryPercent: { degraded: 72, critical: 84 },
      restarts24h: { degraded: 1, critical: 3 },
    });
  });

  it('derives alert metadata and escalated service health', () => {
    const [service] = applyObservabilityAlertThresholds(
      [{ name: 'agent-runtime', status: 'healthy', cpuPercent: 77, memoryPercent: 92, restarts24h: 0, layer: 'orchestration', endpoint: 'https://runtime' }],
      '',
    );

    expect(service).toMatchObject({
      status: 'critical',
      alerts: [
        { metric: 'cpuPercent', severity: 'degraded', actualValue: 77, thresholdValue: 75 },
        { metric: 'memoryPercent', severity: 'critical', actualValue: 92, thresholdValue: 90 },
      ],
    });
  });
});