import { describe, expect, it } from 'vitest';

import {
  appendObservabilitySnapshot,
  buildObservabilityLiveSnapshot,
} from '@/lib/observability-live-charts';

describe('observability live chart helpers', () => {
  it('builds a snapshot with sorted service and model series', () => {
    const snapshot = buildObservabilityLiveSnapshot({
      capturedAt: '2026-03-09T12:00:00.000Z',
      overview: { metrics: [], alerts: [], queueBacklog: 42, runningAgents: 7, healthyServices: 2, liveEventsPerMinute: 18 },
      observability: {
        items: [
          { name: 'edge-router', layer: 'edge', status: 'healthy', cpuPercent: 31, memoryPercent: 44, restarts24h: 0, endpoint: 'https://edge' },
          { name: 'control-plane-api', layer: 'orchestration', status: 'degraded', cpuPercent: 79, memoryPercent: 61, restarts24h: 1, endpoint: 'https://cp' },
        ],
      },
      models: {
        items: [
          { key: 'planner', service: 'planner', activeModel: 'gpt-5', provider: 'openai', fallbackModel: 'gpt-4.1', latencyMs: 920, tokenUsage1h: 10_000, errorRate: 0.01, candidates: [] },
          { key: 'embedding', service: 'embedding', activeModel: 'text-embedding-3-large', provider: 'openai', fallbackModel: 'text-embedding-3-small', latencyMs: 240, tokenUsage1h: 20_000, errorRate: 0.002, candidates: [] },
        ],
      },
    });

    expect(snapshot.queueBacklog).toBe(42);
    expect(snapshot.services.map((service) => service.name)).toEqual(['control-plane-api', 'edge-router']);
    expect(snapshot.models.map((model) => model.key)).toEqual(['planner', 'embedding']);
  });

  it('caps retained history to the latest samples', () => {
    const base = Array.from({ length: 12 }, (_, index) => ({
      capturedAt: `2026-03-09T12:${String(index).padStart(2, '0')}:00.000Z`,
      queueBacklog: index,
      runningAgents: index,
      liveEventsPerMinute: index,
      services: [],
      models: [],
    }));

    const next = appendObservabilitySnapshot(base, {
      capturedAt: '2026-03-09T12:12:00.000Z',
      queueBacklog: 12,
      runningAgents: 12,
      liveEventsPerMinute: 12,
      services: [],
      models: [],
    });

    expect(next).toHaveLength(12);
    expect(next[0]?.queueBacklog).toBe(1);
    expect(next.at(-1)?.queueBacklog).toBe(12);
  });
});