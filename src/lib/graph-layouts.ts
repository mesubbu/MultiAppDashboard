import type { GraphEdgeRecord, GraphNodeRecord } from '@/types/platform';

export type GraphLayoutMode = 'radial' | 'hierarchical' | 'force-directed';

const VIEWPORT_WIDTH = 820;
const VIEWPORT_HEIGHT = 520;
const CENTER_X = VIEWPORT_WIDTH / 2;
const CENTER_Y = VIEWPORT_HEIGHT / 2;

type Position = { x: number; y: number };

function clampPosition(position: Position): Position {
  return {
    x: Math.min(VIEWPORT_WIDTH - 70, Math.max(70, position.x)),
    y: Math.min(VIEWPORT_HEIGHT - 60, Math.max(60, position.y)),
  };
}

function buildAdjacency(nodes: GraphNodeRecord[], edges: GraphEdgeRecord[]) {
  const visibleIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  }
  return adjacency;
}

function orderNodes(nodes: GraphNodeRecord[], selectedNodeId?: string | null) {
  const selected = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : undefined;
  return selected ? [selected, ...nodes.filter((node) => node.id !== selected.id)] : nodes;
}

function buildRadialLayout(nodes: GraphNodeRecord[], selectedNodeId?: string | null) {
  if (nodes.length <= 1) {
    return new Map(nodes.map((node) => [node.id, { x: CENTER_X, y: CENTER_Y }]));
  }

  const ordered = orderNodes(nodes, selectedNodeId);
  const [anchor, ...orbiting] = ordered;
  const positions = new Map<string, Position>([[anchor.id, { x: CENTER_X, y: CENTER_Y }]]);
  orbiting.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / orbiting.length;
    const radius = orbiting.length <= 4 ? 180 : 235;
    positions.set(node.id, clampPosition({ x: CENTER_X + Math.cos(angle) * radius, y: CENTER_Y + Math.sin(angle) * radius }));
  });
  return positions;
}

function buildHierarchicalLayout(nodes: GraphNodeRecord[], edges: GraphEdgeRecord[], selectedNodeId?: string | null) {
  const ordered = orderNodes(nodes, selectedNodeId);
  const rootId = ordered[0]?.id;
  if (!rootId) return new Map<string, Position>();

  const adjacency = buildAdjacency(nodes, edges);
  const levels = new Map<string, number>([[rootId, 0]]);
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const currentLevel = levels.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (levels.has(neighbor)) continue;
      levels.set(neighbor, currentLevel + 1);
      queue.push(neighbor);
    }
  }

  const fallbackLevel = Math.max(...levels.values(), 0) + 1;
  const columns = new Map<number, GraphNodeRecord[]>();
  ordered.forEach((node) => {
    const level = levels.get(node.id) ?? fallbackLevel;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  });

  const layout = new Map<string, Position>();
  const maxLevel = Math.max(...columns.keys(), 0);
  Array.from(columns.entries())
    .sort(([left], [right]) => left - right)
    .forEach(([level, columnNodes]) => {
      const x = maxLevel === 0 ? CENTER_X : 120 + (level / maxLevel) * 580;
      const spacing = VIEWPORT_HEIGHT / (columnNodes.length + 1);
      columnNodes.forEach((node, index) => {
        layout.set(node.id, clampPosition({ x, y: spacing * (index + 1) }));
      });
    });

  return layout;
}

function buildForceDirectedLayout(nodes: GraphNodeRecord[], edges: GraphEdgeRecord[], selectedNodeId?: string | null) {
  const positions = buildRadialLayout(nodes, selectedNodeId);
  const nodeIds = nodes.map((node) => node.id);
  const area = VIEWPORT_WIDTH * VIEWPORT_HEIGHT;
  const k = Math.sqrt(area / Math.max(nodeIds.length, 1));

  for (let iteration = 0; iteration < 28; iteration += 1) {
    const displacement = new Map(nodeIds.map((id) => [id, { x: 0, y: 0 }]));

    for (let left = 0; left < nodeIds.length; left += 1) {
      for (let right = left + 1; right < nodeIds.length; right += 1) {
        const source = positions.get(nodeIds[left]);
        const target = positions.get(nodeIds[right]);
        if (!source || !target) continue;
        const deltaX = source.x - target.x;
        const deltaY = source.y - target.y;
        const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
        const force = (k * k) / distance;
        const pushX = (deltaX / distance) * force;
        const pushY = (deltaY / distance) * force;
        displacement.get(nodeIds[left])!.x += pushX;
        displacement.get(nodeIds[left])!.y += pushY;
        displacement.get(nodeIds[right])!.x -= pushX;
        displacement.get(nodeIds[right])!.y -= pushY;
      }
    }

    for (const edge of edges) {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) continue;
      const deltaX = source.x - target.x;
      const deltaY = source.y - target.y;
      const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
      const force = ((distance * distance) / (k * 3)) * edge.strength;
      const pullX = (deltaX / distance) * force;
      const pullY = (deltaY / distance) * force;
      displacement.get(edge.source)!.x -= pullX;
      displacement.get(edge.source)!.y -= pullY;
      displacement.get(edge.target)!.x += pullX;
      displacement.get(edge.target)!.y += pullY;
    }

    const temperature = 24 * (1 - iteration / 28);
    for (const nodeId of nodeIds) {
      const current = positions.get(nodeId);
      const delta = displacement.get(nodeId);
      if (!current || !delta) continue;
      const magnitude = Math.max(Math.hypot(delta.x, delta.y), 1);
      const next = clampPosition({
        x: current.x + (delta.x / magnitude) * Math.min(magnitude, temperature) * 0.12,
        y: current.y + (delta.y / magnitude) * Math.min(magnitude, temperature) * 0.12,
      });
      positions.set(
        nodeId,
        nodeId === selectedNodeId
          ? { x: (next.x + CENTER_X * 5) / 6, y: (next.y + CENTER_Y * 5) / 6 }
          : next,
      );
    }
  }

  return positions;
}

export function buildGraphLayout(
  nodes: GraphNodeRecord[],
  edges: GraphEdgeRecord[],
  layoutMode: GraphLayoutMode,
  selectedNodeId?: string | null,
) {
  if (layoutMode === 'hierarchical') return buildHierarchicalLayout(nodes, edges, selectedNodeId);
  if (layoutMode === 'force-directed') return buildForceDirectedLayout(nodes, edges, selectedNodeId);
  return buildRadialLayout(nodes, selectedNodeId);
}