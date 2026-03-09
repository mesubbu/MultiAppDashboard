import { describe, expect, it } from 'vitest';

import {
  applyKnowledgeGraphQuery,
  buildKnowledgeGraphPath,
  parseKnowledgeGraphQuery,
} from '@/lib/knowledge-graph';
import { graphEdgesData, graphNodesData } from '@/mocks/platform-data';

const graph = { nodes: graphNodesData, edges: graphEdgesData };

describe('knowledge graph helpers', () => {
  it('extracts the shortest visible path between two nodes', () => {
    const result = applyKnowledgeGraphQuery(graph, {
      pathFrom: 'user:anaya',
      pathTo: 'location:mumbai',
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      'user:anaya',
      'listing:tractor301',
      'location:mumbai',
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual(['edge-3', 'edge-6']);
  });

  it('extracts a depth-limited subgraph around a center node', () => {
    const result = applyKnowledgeGraphQuery(graph, {
      centerId: 'agent:growth',
      depth: 1,
    });

    expect(result.nodes.map((node) => node.id)).toEqual([
      'category:farm',
      'agent:growth',
      'skill:analytics',
    ]);
    expect(result.edges.map((edge) => edge.id)).toEqual(['edge-4', 'edge-5']);
  });

  it('parses and builds knowledge graph query params', () => {
    const query = parseKnowledgeGraphQuery(
      new URLSearchParams({
        types: 'agent,skill',
        center_id: 'agent:growth',
        depth: '1',
      }),
    );

    expect(query).toEqual({
      types: ['agent', 'skill'],
      centerId: 'agent:growth',
      depth: 1,
    });
    expect(buildKnowledgeGraphPath('/admin/knowledge-graph', query)).toBe(
      '/admin/knowledge-graph?types=agent%2Cskill&center_id=agent%3Agrowth&depth=1',
    );
  });
});