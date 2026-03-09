import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from '@/components/dashboard/PageHeader';

describe('PageHeader', () => {
  it('renders the title, description, brand label, and actions', () => {
    render(
      <PageHeader
        title="Observability"
        description="Track service health, queue depth, and recent failures."
        actions={<button type="button">Refresh</button>}
      />,
    );

    expect(screen.getByText('AI Platform Control')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observability' })).toBeInTheDocument();
    expect(screen.getByText(/track service health, queue depth, and recent failures/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});

