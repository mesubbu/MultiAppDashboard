import { HttpError } from './http.mjs';

const allowedTypes = new Set(['user', 'vendor', 'category', 'listing', 'agent', 'skill', 'location']);

function buildAdjacency(edges, visibleNodeIds) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) continue;
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), { nodeId: edge.target, edge }]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), { nodeId: edge.source, edge }]);
  }
  return adjacency;
}

function subsetGraph(graph, visibleNodeIds) {
  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
  };
}

function extractShortestPath(graph, pathFrom, pathTo) {
  const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!visibleNodeIds.has(pathFrom) || !visibleNodeIds.has(pathTo)) return { nodes: [], edges: [] };
  if (pathFrom === pathTo) return subsetGraph(graph, new Set([pathFrom]));

  const adjacency = buildAdjacency(graph.edges, visibleNodeIds);
  const queue = [pathFrom];
  const visited = new Set(queue);
  const previous = new Map();

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
  const pathNodeIds = new Set([pathTo]);
  const pathEdgeIds = new Set();
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

function extractDepthLimitedSubgraph(graph, centerId, depth) {
  const visibleNodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!visibleNodeIds.has(centerId)) return { nodes: [], edges: [] };

  const adjacency = buildAdjacency(graph.edges, visibleNodeIds);
  const queue = [{ nodeId: centerId, level: 0 }];
  const visited = new Set([centerId]);

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

export function parseKnowledgeGraphQuery(searchParams) {
  const types = searchParams
    .get('types')
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const pathFrom = searchParams.get('path_from') ?? undefined;
  const pathTo = searchParams.get('path_to') ?? undefined;
  const centerId = searchParams.get('center_id') ?? undefined;
  const depthValue = searchParams.get('depth');
  const depth = depthValue == null ? undefined : Number(depthValue);

  if (types?.some((type) => !allowedTypes.has(type))) {
    throw new HttpError(400, 'INVALID_KNOWLEDGE_GRAPH_QUERY', 'Provide only supported graph node types.');
  }

  if ((pathFrom && !pathTo) || (!pathFrom && pathTo)) {
    throw new HttpError(400, 'INVALID_KNOWLEDGE_GRAPH_QUERY', 'Provide both path_from and path_to when querying a graph path.');
  }
  if (depthValue != null && (!Number.isInteger(depth) || depth < 0 || depth > 6)) {
    throw new HttpError(400, 'INVALID_KNOWLEDGE_GRAPH_QUERY', 'Depth must be an integer between 0 and 6.');
  }
  if (depth != null && !centerId) {
    throw new HttpError(400, 'INVALID_KNOWLEDGE_GRAPH_QUERY', 'Provide center_id when depth is specified.');
  }
  if ((pathFrom || pathTo) && centerId) {
    throw new HttpError(400, 'INVALID_KNOWLEDGE_GRAPH_QUERY', 'Choose either a path query or a center/depth query, not both.');
  }

  return { types, pathFrom, pathTo, centerId, depth };
}

export function applyKnowledgeGraphQuery(graph, query = {}) {
  const scoped = query.types?.length
    ? subsetGraph(graph, new Set(graph.nodes.filter((node) => query.types.includes(node.type)).map((node) => node.id)))
    : graph;

  if (query.pathFrom && query.pathTo) return extractShortestPath(scoped, query.pathFrom, query.pathTo);
  if (query.centerId) return extractDepthLimitedSubgraph(scoped, query.centerId, query.depth ?? 1);
  return scoped;
}