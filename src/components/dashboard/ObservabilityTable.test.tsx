import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ObservabilityTable } from '@/components/dashboard/ObservabilityTable';
import type { ServiceHealth } from '@/types/platform';

const items: ServiceHealth[] = [
  {
    name: 'control-plane',
    layer: 'orchestration',
    status: 'critical',
    cpuPercent: 94,
    memoryPercent: 77,
    restarts24h: 4,
    endpoint: 'https://control-plane.internal',
    thresholds: { cpuPercent: { degraded: 70, critical: 90 }, restarts24h: { critical: 3 } },
    alerts: [{ metric: 'cpuPercent', severity: 'critical', actualValue: 94, thresholdValue: 90 }],
  },
  {
    name: 'edge-gateway',
    layer: 'edge',
    status: 'healthy',
    cpuPercent: 22,
    memoryPercent: 31,
    restarts24h: 0,
    endpoint: 'https://edge.internal',
  },
];

describe('ObservabilityTable', () => {
  it('renders thresholds, active alerts, defaults, and external ops links', () => {
    render(
      <ObservabilityTable
        items={items}
        linksByService={{
          'control-plane': { grafana: 'https://grafana.example/control-plane', prometheus: 'https://prom.example/control-plane' },
        }}
      />,
    );

    expect(screen.getByRole('table', { name: /service health table/i })).toBeInTheDocument();
    expect(screen.getByText('CPU 70/90')).toBeInTheDocument();
    expect(screen.getByText('Restarts / 24h —/3')).toBeInTheDocument();
    expect(screen.getByText('CPU critical')).toBeInTheDocument();
    expect(screen.getByText('Within threshold')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grafana' })).toHaveAttribute('href', 'https://grafana.example/control-plane');
    expect(screen.getByRole('link', { name: 'Prometheus' })).toHaveAttribute('href', 'https://prom.example/control-plane');
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });
});

