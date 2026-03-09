import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardPageSkeleton } from '@/components/dashboard/DashboardPageSkeleton';

describe('DashboardPageSkeleton', () => {
  it('renders the table loading layout by default', () => {
    render(<DashboardPageSkeleton />);

    expect(screen.getByText('Loading table')).toBeInTheDocument();
    expect(screen.getByText(/fetching dashboard records and operational metadata/i)).toBeInTheDocument();
  });

  it('renders the detail loading layout', () => {
    render(<DashboardPageSkeleton variant="detail" />);

    expect(screen.getByText('Loading agents')).toBeInTheDocument();
    expect(screen.getByText('Loading details')).toBeInTheDocument();
  });

  it('renders the board loading layout', () => {
    render(<DashboardPageSkeleton variant="board" />);

    expect(screen.getByText('Loading board')).toBeInTheDocument();
    expect(screen.getByText('Loading dependency focus')).toBeInTheDocument();
  });
});