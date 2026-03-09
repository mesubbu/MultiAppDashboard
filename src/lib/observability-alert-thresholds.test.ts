import { describe, expect, it } from 'vitest';

import {
  applyObservabilityAlertThresholds,
  parseObservabilityThresholdConfig,
  resolveServiceAlertThresholds,
} from '@/lib/observability-alert-thresholds';

describe('observability alert thresholds', () => {
  it('parses defaults and per-service overrides from JSON config', () => {
    const config = parseObservabilityThresholdConfig(
      JSON.stringify({
        defaults: { cpuPercent: { degraded: 70, critical: 88 } },
        services: { 'agent-runtime': { restarts24h: { degraded: 2, critical: 4 } } },
      }),
    );

    expect(resolveServiceAlertThresholds('agent_runtime', config)).toMatchObject({
      cpuPercent: { degraded: 70, critical: 88 },
      restarts24h: { degraded: 2, critical: 4 },
      memoryPercent: { degraded: 80, critical: 90 },
    });
  });

  it('applies derived alerts and escalates service status', () => {
    const [service] = applyObservabilityAlertThresholds(
      [{ name: 'control-plane-api', layer: 'orchestration', status: 'healthy', cpuPercent: 93, memoryPercent: 74, restarts24h: 1, endpoint: 'https://cp' }],
      JSON.stringify({ services: { 'control-plane-api': { restarts24h: { degraded: 1, critical: 2 } } } }),
    );

    expect(service?.status).toBe('critical');
    expect(service?.alerts).toEqual([
      { metric: 'cpuPercent', severity: 'critical', actualValue: 93, thresholdValue: 90 },
      { metric: 'restarts24h', severity: 'degraded', actualValue: 1, thresholdValue: 1 },
    ]);
    expect(service?.thresholds?.memoryPercent).toEqual({ degraded: 80, critical: 90 });
  });
});