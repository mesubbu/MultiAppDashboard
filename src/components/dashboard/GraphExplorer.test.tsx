import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { graphEdgesData, graphNodesData } from '@/mocks/platform-data';

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReactFlow: ({ nodes, onNodeClick }: { nodes: Array<{ id: string; data: { label: string } }>; onNodeClick?: (_event: unknown, node: { id: string }) => void }) => (
    <div data-testid="react-flow-mock">
      {nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onNodeClick?.(undefined, { id: node.id })}>
          {node.data.label}
        </button>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

import { GraphExplorer } from '@/components/dashboard/GraphExplorer';

describe('GraphExplorer', () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };

    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    });
  });

  it('filters the graph by search query and can reset back to the full graph', () => {
    render(
      <GraphExplorer nodes={graphNodesData} edges={graphEdgesData} sessionUserId="user_owner_01" />,
    );

    const searchInput = screen.getByRole('searchbox', { name: /search graph entities/i });
    const focusSelect = screen.getByRole('combobox', { name: /focus a visible node/i });

    fireEvent.change(searchInput, { target: { value: 'nova foods' } });

    expect(within(focusSelect).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Nova Foods' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset graph filters/i }));

    expect(within(focusSelect).getAllByRole('option')).toHaveLength(graphNodesData.length);
    expect(screen.getByRole('heading', { name: 'Anaya Patel' })).toBeInTheDocument();
  });

  it('shows an empty state when no graph nodes match the current query', () => {
    render(
      <GraphExplorer nodes={graphNodesData} edges={graphEdgesData} sessionUserId="user_owner_01" />,
    );

    fireEvent.change(screen.getByRole('searchbox', { name: /search graph entities/i }), {
      target: { value: 'does-not-exist' },
    });

    expect(screen.getByText(/no nodes match the current graph query/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reset graph filters/i })).toHaveLength(2);
  });

  it('saves and reloads per-user graph views', async () => {
    const firstRender = render(
      <GraphExplorer nodes={graphNodesData} edges={graphEdgesData} sessionUserId="user_owner_01" />,
    );

    const searchInput = screen.getByRole('searchbox', { name: /search graph entities/i });
    fireEvent.click(screen.getByRole('button', { name: /^hierarchical$/i }));
    fireEvent.change(searchInput, { target: { value: 'nova foods' } });
    fireEvent.change(screen.getByRole('textbox', { name: /preset name/i }), {
      target: { value: 'Vendor watch' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save current view/i }));

    expect(
      JSON.parse(window.localStorage.getItem('knowledge-graph-presets:user_owner_01') ?? '[]'),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Vendor watch',
          query: 'nova foods',
          layoutMode: 'hierarchical',
        }),
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: /reset graph filters/i }));
    expect(searchInput).toHaveValue('');
    expect(screen.getByRole('button', { name: /^radial$/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /^Vendor watch/i }));
    expect(searchInput).toHaveValue('nova foods');
    expect(screen.getByRole('button', { name: /^hierarchical$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    firstRender.unmount();

    const secondRender = render(
      <GraphExplorer nodes={graphNodesData} edges={graphEdgesData} sessionUserId="other_user" />,
    );
    expect(screen.queryByRole('button', { name: /^Vendor watch/i })).not.toBeInTheDocument();

    secondRender.unmount();

    render(
      <GraphExplorer nodes={graphNodesData} edges={graphEdgesData} sessionUserId="user_owner_01" />,
    );
    expect(await screen.findByRole('button', { name: /^Vendor watch/i })).toBeInTheDocument();
  });
});