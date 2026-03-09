import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricsCards } from '@/components/dashboard/MetricsCards';
import type { MetricCard } from '@/types/platform';

const items: MetricCard[] = [
  {
    label: 'Active Tenants',
    value: '18',
    delta: '+2',
    trend: 'up',
    description: 'Enterprise and growth tenants across edge regions.',
  },
  {
    label: 'Queue Backlog',
    value: '482',
    delta: '-11%',
    trend: 'down',
    description: 'Pending tasks waiting for orchestration capacity.',
  },
];

describe('MetricsCards', () => {
  it('renders each metric label, value, delta, and description', () => {
    render(<MetricsCards items={items} />);

    expect(screen.getByText('Active Tenants')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText(/enterprise and growth tenants/i)).toBeInTheDocument();

    expect(screen.getByText('Queue Backlog')).toBeInTheDocument();
    expect(screen.getByText('482')).toBeInTheDocument();
    expect(screen.getByText('-11%')).toBeInTheDocument();
    expect(screen.getByText(/pending tasks waiting for orchestration capacity/i)).toBeInTheDocument();
  });
});

