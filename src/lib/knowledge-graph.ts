import { z } from 'zod';

import type { GraphEdgeRecord, GraphNodeRecord, GraphNodeType } from '@/types/platform';

const graphNodeTypeValues = ['user', 'vendor', 'category', 'listing', 'agent', 'skill', 'location'] as const;

const knowledgeGraphQuerySchema = z
  .object({
    types: z.array(z.enum(graphNodeTypeValues)).optional(),
    pathFrom: z.string().trim().min(1).optional(),
    pathTo: z.string().trim().min(1).optional(),
    centerId: z.string().trim().min(1).optional(),
    depth: z.coerce.number().int().min(0).max(6).optional(),
  })
  .superRefine((value, context) => {
    if ((value.pathFrom && !value.pathTo) || (!value.pathFrom && value.pathTo)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide both path_from and path_to when querying a graph path.',
        path: [value.pathFrom ? 'pathTo' : 'pathFrom'],
      });
    }
    if (value.depth != null && !value.centerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide center_id when depth is specified.',
        path: ['centerId'],
      });
    }
    if ((value.pathFrom || value.pathTo) && value.centerId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Choose either a path query or a center/depth query, not both.',
        path: ['centerId'],
      });
    }
  });

export type KnowledgeGraphQuery = {
  types?: GraphNodeType[];
  pathFrom?: string;
  pathTo?: string;
  centerId?: string;
  depth?: number;
};

type KnowledgeGraphPayload = { nodes: GraphNodeRecord[]; edges: GraphEdgeRecord[] };

function buildAdjacency(edges: GraphEdgeRecord[], visibleNodeIds: Set<string>) {
  const adjacency = new Map<string, Array<{ nodeId: string; edge: GraphEdgeRecord }>>();
  for (const edge of edges) {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue;
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), { nodeId: edge.target, edge }]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), { nodeId: edge.source, edge }]);
  }
  return adjacency;
}

function subsetGraph(graph: KnowledgeGraphPayload, visibleNodeIds: Set<string>) {
  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
  };
}

function extractShortestPath(graph: KnowledgeGraphPayload, pathFrom: string, pathTo: string): KnowledgeGraphPayload {
  const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!visibleNodeIds.has(pathFrom) || !visibleNodeIds.has(pathTo)) return { nodes: [], edges: [] };
  if (pathFrom === pathTo) return subsetGraph(graph, new Set([pathFrom]));

  const adjacency = buildAdjacency(graph.edges, visibleNodeIds);
  const previous = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = [pathFrom];
  const visited = new Set(queue);

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    if (current === pathTo) break;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      visited.add(neighbor.nodeId);
      previous.set(neighbor.nodeId, { nodeId: current, edgeId: neighbor.edge.id });
      queue.push(neighbor.nodeId);
    }
  }

  if (!previous.has(pathTo)) return { nodes: [], edges: [] };
  const pathNodeIds = new Set<string>([pathTo]);
  const pathEdgeIds = new Set<string>();
  let current = pathTo;

  while (current !== pathFrom) {
    const step = previous.get(current);
    if (!step) break;
    pathNodeIds.add(step.nodeId);
    pathEdgeIds.add(step.edgeId);
    current = step.nodeId;
  }

  return {
    nodes: graph.nodes.filter((node) => pathNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => pathEdgeIds.has(edge.id)),
  };
}

function extractDepthLimitedSubgraph(graph: KnowledgeGraphPayload, centerId: string, depth: number): KnowledgeGraphPayload {
  const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!visibleNodeIds.has(centerId)) return { nodes: [], edges: [] };

  const adjacency = buildAdjacency(graph.edges, visibleNodeIds);
  const queue: Array<{ nodeId: string; level: number }> = [{ nodeId: centerId, level: 0 }];
  const visited = new Set<string>([centerId]);

  while (queue.length) {
    const current = queue.shift();
    if (!current || current.level >= depth) continue;
    for (const neighbor of adjacency.get(current.nodeId) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      visited.add(neighbor.nodeId);
      queue.push({ nodeId: neighbor.nodeId, level: current.level + 1 });
    }
  }

  return subsetGraph(graph, visited);
}

export function parseKnowledgeGraphQuery(searchParams: URLSearchParams | Record<string, string | string[] | undefined>): KnowledgeGraphQuery {
  const getValue = (key: string) => {
    const value = searchParams instanceof URLSearchParams ? searchParams.get(key) ?? undefined : searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const types = getValue('types')
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return knowledgeGraphQuerySchema.parse({
    types: types?.length ? types : undefined,
    pathFrom: getValue('path_from'),
    pathTo: getValue('path_to'),
    centerId: getValue('center_id'),
    depth: getValue('depth'),
  });
}

export function buildKnowledgeGraphPath(path: string, query: KnowledgeGraphQuery = {}) {
  const url = new URL(path, 'https://dashboard.local');
  if (query.types?.length) url.searchParams.set('types', query.types.join(','));
  if (query.pathFrom) url.searchParams.set('path_from', query.pathFrom);
  if (query.pathTo) url.searchParams.set('path_to', query.pathTo);
  if (query.centerId) url.searchParams.set('center_id', query.centerId);
  if (query.depth != null) url.searchParams.set('depth', `${query.depth}`);
  return `${url.pathname}${url.search}`;
}

export function applyKnowledgeGraphQuery(graph: KnowledgeGraphPayload, query: KnowledgeGraphQuery = {}): KnowledgeGraphPayload {
  const scoped = query.types?.length
    ? subsetGraph(graph, new Set(graph.nodes.filter((node) => query.types?.includes(node.type)).map((node) => node.id)))
    : graph;

  if (query.pathFrom && query.pathTo) return extractShortestPath(scoped, query.pathFrom, query.pathTo);
  if (query.centerId) return extractDepthLimitedSubgraph(scoped, query.centerId, query.depth ?? 1);
  return scoped;
}