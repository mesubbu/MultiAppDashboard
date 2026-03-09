import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OverviewHealthTable } from '@/components/dashboard/OverviewHealthTable';
import type { ServiceHealth } from '@/types/platform';

const items: ServiceHealth[] = [
  { name: 'api-gateway', layer: 'edge', status: 'healthy', cpuPercent: 10, memoryPercent: 20, restarts24h: 0, endpoint: 'https://a' },
  { name: 'planner', layer: 'orchestration', status: 'degraded', cpuPercent: 20, memoryPercent: 30, restarts24h: 1, endpoint: 'https://b' },
  { name: 'observer', layer: 'observability', status: 'healthy', cpuPercent: 15, memoryPercent: 25, restarts24h: 0, endpoint: 'https://c' },
  { name: 'queue', layer: 'orchestration', status: 'critical', cpuPercent: 30, memoryPercent: 40, restarts24h: 3, endpoint: 'https://d' },
  { name: 'worker', layer: 'orchestration', status: 'healthy', cpuPercent: 40, memoryPercent: 50, restarts24h: 2, endpoint: 'https://e' },
];

describe('OverviewHealthTable', () => {
  it('renders the first page and supports paging through service rows', () => {
    render(<OverviewHealthTable items={items} />);

    const table = screen.getByRole('table', { name: /overview service health table/i });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByText('queue')).toBeInTheDocument();
    expect(screen.queryByText('worker')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText('worker')).toBeInTheDocument();
    expect(screen.getByText(/page 2 \/ 2/i)).toBeInTheDocument();
  });
});

