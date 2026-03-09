import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemoryRegistryTable } from '@/components/dashboard/MemoryRegistryTable';
import { memoryData } from '@/mocks/platform-data';

describe('MemoryRegistryTable', () => {
  it('renders memory records with scope and vector metrics', () => {
    render(<MemoryRegistryTable items={memoryData} />);

    const table = screen.getByRole('table', { name: /memory registry table/i });
    expect(within(table).getByText('Memory ID')).toBeInTheDocument();
    expect(within(table).getByText('Vectors')).toBeInTheDocument();
    expect(within(table).getByText('mem_tenant_acme')).toBeInTheDocument();
    expect(within(table).getByText('14.2K')).toBeInTheDocument();
  });
});