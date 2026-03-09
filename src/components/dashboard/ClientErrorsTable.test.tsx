import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClientErrorsTable } from '@/components/dashboard/ClientErrorsTable';
import type { ClientErrorRecord } from '@/types/platform';

const items: ClientErrorRecord[] = Array.from({ length: 6 }, (_, index) => ({
  id: `err_${index + 1}`,
  kind: index % 2 === 0 ? 'window-error' : 'boundary',
  source: `ui-${index + 1}`,
  message: `Message ${index + 1}`,
  name: `Error ${index + 1}`,
  pathname: index === 5 ? null : `/route-${index + 1}`,
  digest: index === 5 ? 'digest-1' : null,
  occurredAt: `2026-03-09T0${index}:00:00.000Z`,
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'user_1',
}));

describe('ClientErrorsTable', () => {
  it('sorts newest errors first and can expand the visible page size', () => {
    render(<ClientErrorsTable items={items} />);

    const table = screen.getByRole('table', { name: /recent client errors/i });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByText('Error 6')).toBeInTheDocument();
    expect(screen.queryByText('Error 1')).not.toBeInTheDocument();
    expect(screen.getByText(/digest: digest-1/i)).toBeInTheDocument();
    expect(screen.getByText(/no route captured/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } });

    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText(/showing 1-6 of 6/i)).toBeInTheDocument();
  });
});

