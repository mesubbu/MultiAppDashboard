import { describe, expect, it } from 'vitest';

import { buildGraphLayout } from '@/lib/graph-layouts';
import { graphEdgesData, graphNodesData } from '@/mocks/platform-data';

describe('graph layouts', () => {
  it('builds a hierarchical layout that places connected nodes in deeper columns', () => {
    const positions = buildGraphLayout(
      graphNodesData,
      graphEdgesData,
      'hierarchical',
      'user:anaya',
    );

    expect(positions.get('user:anaya')?.x).toBeLessThan(positions.get('listing:tractor301')?.x ?? 0);
    expect(positions.get('listing:tractor301')?.x).toBeLessThan(
      positions.get('location:mumbai')?.x ?? 0,
    );
  });

  it('keeps the selected node near the center in force-directed mode', () => {
    const positions = buildGraphLayout(
      graphNodesData,
      graphEdgesData,
      'force-directed',
      'agent:growth',
    );

    for (const position of positions.values()) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    }

    const selected = positions.get('agent:growth');
    expect(selected?.x).toBeGreaterThan(320);
    expect(selected?.x).toBeLessThan(500);
    expect(selected?.y).toBeGreaterThan(170);
    expect(selected?.y).toBeLessThan(350);
  });
});