import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ToolRegistryTable } from '@/components/dashboard/ToolRegistryTable';
import { toolsData } from '@/mocks/platform-data';

describe('ToolRegistryTable', () => {
  it('renders tool contracts with schema, permissions, and risk badges', () => {
    render(<ToolRegistryTable tools={toolsData} />);

    expect(screen.getByText('Tool contracts')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /tool registry table/i });
    expect(within(table).getByText('Schema')).toBeInTheDocument();
    expect(within(table).getByText('Mode')).toBeInTheDocument();
    expect(within(table).getByText('Guards')).toBeInTheDocument();
    expect(within(table).getByText('Permissions')).toBeInTheDocument();
    expect(within(table).getByText('statistics.calculate.summary')).toBeInTheDocument();
    expect(within(table).getAllByText('tools:read').length).toBeGreaterThan(0);
  });
});