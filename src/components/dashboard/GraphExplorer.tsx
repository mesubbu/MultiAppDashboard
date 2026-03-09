'use client';

import { useId, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import { Focus, Network, Save, Search, Sparkles, Trash2 } from 'lucide-react';

import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { buildGraphLayout, type GraphLayoutMode } from '@/lib/graph-layouts';
import {
  getSavedGraphPresetStorageKey,
  parseSavedGraphPresets,
  type SavedGraphPreset,
} from '@/lib/graph-presets';
import { cn } from '@/lib/utils';
import type { GraphEdgeRecord, GraphNodeRecord, GraphNodeType } from '@/types/platform';

const typeColors: Record<GraphNodeType, string> = {
  user: '#38bdf8',
  vendor: '#a78bfa',
  category: '#22c55e',
  listing: '#f59e0b',
  agent: '#f97316',
  skill: '#14b8a6',
  location: '#fb7185',
};

const presets: Array<{
  id: string;
  title: string;
  types: GraphNodeType[];
  focusId?: string;
}> = [
  {
    id: 'all',
    title: 'Platform map',
    types: ['user', 'vendor', 'category', 'listing', 'agent', 'skill', 'location'],
  },
  {
    id: 'agent-intelligence',
    title: 'Agent intelligence',
    types: ['agent', 'skill', 'category', 'location'],
    focusId: 'agent:growth',
  },
  {
    id: 'market-demand',
    title: 'Market demand',
    types: ['user', 'category', 'listing', 'location'],
    focusId: 'user:anaya',
  },
  {
    id: 'supply-network',
    title: 'Supply network',
    types: ['vendor', 'listing', 'location'],
    focusId: 'vendor:novafoods',
  },
];

function createPresetId() {
  return globalThis.crypto?.randomUUID?.() ?? `graph-preset-${Date.now()}`;
}

function GraphCanvas({
  nodes,
  edges,
  sessionUserId,
}: {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  sessionUserId?: string | null;
}) {
  const searchInputId = useId();
  const focusNodeId = useId();
  const graphSummaryId = useId();
  const presetNameId = useId();
  const [query, setQuery] = useState('');
  const [presetId, setPresetId] = useState('all');
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('radial');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(nodes[0]?.id ?? null);
  const [presetName, setPresetName] = useState('');
  const [savedPresetsState, setSavedPresetsState] = useState<Record<string, SavedGraphPreset[]>>({});

  const storageKey = sessionUserId ? getSavedGraphPresetStorageKey(sessionUserId) : null;
  const savedPresets = useMemo(() => {
    if (!storageKey || typeof window === 'undefined') {
      return [];
    }

    return savedPresetsState[storageKey] ?? parseSavedGraphPresets(window.localStorage.getItem(storageKey));
  }, [savedPresetsState, storageKey]);

  function persistSavedPresets(nextPresets: SavedGraphPreset[]) {
    if (storageKey) {
      setSavedPresetsState((current) => ({
        ...current,
        [storageKey]: nextPresets,
      }));
    }
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(nextPresets));
  }

  const preset = useMemo(() => {
    return presets.find((item) => item.id === presetId) ?? presets[0];
  }, [presetId]);
  const activeTypes = useMemo(() => preset.types, [preset]);

  const filteredNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return nodes.filter((node) => {
      const typeMatch = activeTypes.includes(node.type);
      const queryMatch =
        !normalizedQuery ||
        node.label.toLowerCase().includes(normalizedQuery) ||
        node.metadata.toLowerCase().includes(normalizedQuery) ||
        node.description.toLowerCase().includes(normalizedQuery) ||
        node.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      return typeMatch && queryMatch;
    });
  }, [activeTypes, nodes, query]);

  const filteredEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map((node) => node.id));
    return edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  }, [edges, filteredNodes]);

  const selectedNode =
    filteredNodes.find((node) => node.id === selectedNodeId) ??
    filteredNodes.find((node) => node.id === preset.focusId) ??
    filteredNodes[0] ??
    null;

  const neighborIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNode) {
      return ids;
    }
    filteredEdges.forEach((edge) => {
      if (edge.source === selectedNode.id) ids.add(edge.target);
      if (edge.target === selectedNode.id) ids.add(edge.source);
    });
    return ids;
  }, [filteredEdges, selectedNode]);

  const nodePositions = useMemo(
    () => buildGraphLayout(filteredNodes, filteredEdges, layoutMode, selectedNode?.id),
    [filteredEdges, filteredNodes, layoutMode, selectedNode?.id],
  );

  const graphNodes = useMemo<Node[]>(() => {
    return filteredNodes.map((node, index) => {
      const isSelected = node.id === selectedNode?.id;
      const isNeighbor = neighborIds.has(node.id);
      const shouldDim = selectedNode && !isSelected && !isNeighbor;
      return {
        id: node.id,
        data: { label: node.label },
        position: nodePositions.get(node.id) ?? { x: 320 + index * 24, y: 240 },
        style: {
          background: '#020617',
          color: '#e2e8f0',
          border: `2px solid ${typeColors[node.type]}`,
          borderRadius: 18,
          padding: 12,
          width: 190,
          opacity: shouldDim ? 0.3 : 1,
          boxShadow: isSelected ? `0 0 0 2px ${typeColors[node.type]}33` : 'none',
        },
      };
    });
  }, [filteredNodes, neighborIds, nodePositions, selectedNode]);

  const graphEdges = useMemo<Edge[]>(() => {
    return filteredEdges.map((edge) => {
      const isConnected =
        !selectedNode || edge.source === selectedNode.id || edge.target === selectedNode.id;
      return {
        ...edge,
        animated: edge.category === 'intelligence',
        labelStyle: { fill: '#cbd5e1', fontSize: 12 },
        style: {
          stroke: isConnected ? '#67e8f9' : '#334155',
          strokeWidth: edge.strength * 3,
          opacity: isConnected ? 0.85 : 0.35,
        },
      };
    });
  }, [filteredEdges, selectedNode]);

  const relationshipBreakdown = useMemo(() => {
    return filteredEdges.reduce<Record<string, number>>((accumulator, edge) => {
      accumulator[edge.label] = (accumulator[edge.label] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [filteredEdges]);

  const relatedEdges = filteredEdges.filter(
    (edge) => edge.source === selectedNode?.id || edge.target === selectedNode?.id,
  );
  const hasActiveFilters = query.trim().length > 0 || presetId !== 'all' || layoutMode !== 'radial';

  function applyBuiltInPreset(nextPresetId: string) {
    const nextPreset = presets.find((item) => item.id === nextPresetId) ?? presets[0];
    setPresetId(nextPreset.id);
    setSelectedNodeId(nextPreset.focusId ?? nodes[0]?.id ?? null);
  }

  function applySavedPreset(savedPreset: SavedGraphPreset) {
    const nextPreset = presets.find((item) => item.id === savedPreset.presetId) ?? presets[0];
    setPresetId(nextPreset.id);
    setLayoutMode(savedPreset.layoutMode);
    setQuery(savedPreset.query);
    setSelectedNodeId(savedPreset.focusId ?? nextPreset.focusId ?? nodes[0]?.id ?? null);
  }

  function saveCurrentPreset() {
    const title = presetName.trim();
    if (!title || !storageKey) return;
    const nextPreset: SavedGraphPreset = {
      id: createPresetId(),
      title,
      presetId,
      query,
      focusId: selectedNode?.id,
      layoutMode,
      savedAt: new Date().toISOString(),
    };
    const deduped = savedPresets.filter((item) => item.title.toLowerCase() !== title.toLowerCase());
    persistSavedPresets([nextPreset, ...deduped].slice(0, 8));
    setPresetName('');
  }

  function deleteSavedPreset(presetToDelete: SavedGraphPreset) {
    persistSavedPresets(savedPresets.filter((item) => item.id !== presetToDelete.id));
  }

  function resetFilters() {
    setQuery('');
    setPresetId('all');
    setLayoutMode('radial');
    setSelectedNodeId(nodes[0]?.id ?? null);
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Graph query workbench" description="Search entities, pivot by graph preset, and inspect connected relationships for the selected node.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid max-w-4xl flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative max-w-xl flex-1">
                  <label htmlFor={searchInputId} className="sr-only">
                    Search graph entities
                  </label>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id={searchInputId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by label, metadata, description, or tags"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-100"
                  />
                </div>
                <div>
                  <label htmlFor={focusNodeId} className="sr-only">
                    Focus a visible node
                  </label>
                  <select
                    id={focusNodeId}
                    value={selectedNode?.id ?? ''}
                    onChange={(event) => setSelectedNodeId(event.target.value || null)}
                    disabled={filteredNodes.length === 0}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {filteredNodes.length === 0 ? <option value="">No visible nodes</option> : null}
                    {filteredNodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        Focus {node.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3 xl:items-end">
                <div role="group" aria-label="Graph presets" className="flex flex-wrap gap-2">
                  {presets.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => applyBuiltInPreset(item.id)}
                      aria-pressed={item.id === presetId}
                      className={cn(
                        'rounded-full border px-3 py-2 text-sm transition',
                        item.id === presetId
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                          : 'border-white/10 text-slate-300 hover:bg-white/5',
                      )}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
                <div role="group" aria-label="Graph layouts" className="flex flex-wrap gap-2">
                  {(['radial', 'hierarchical', 'force-directed'] satisfies GraphLayoutMode[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLayoutMode(mode)}
                        aria-pressed={mode === layoutMode}
                        className={cn(
                          'rounded-full border px-3 py-2 text-sm capitalize transition',
                          mode === layoutMode
                            ? 'border-violet-400 bg-violet-400/10 text-violet-200'
                            : 'border-white/10 text-slate-300 hover:bg-white/5',
                        )}
                      >
                        {mode.replace('-', ' ')}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {hasActiveFilters ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                  >
                    Reset graph filters
                  </button>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Nodes</p>
                <p className="mt-2 text-2xl font-semibold text-white">{filteredNodes.length}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Edges</p>
                <p className="mt-2 text-2xl font-semibold text-white">{filteredEdges.length}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Neighbors</p>
                <p className="mt-2 text-2xl font-semibold text-white">{neighborIds.size}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Selected score</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {selectedNode ? `${Math.round(selectedNode.score * 100)}%` : '—'}
                </p>
              </div>
            </div>
            <p id={graphSummaryId} className="sr-only">
              Visible graph with {filteredNodes.length} nodes and {filteredEdges.length} edges. Use the focus node select or click nodes in the canvas to inspect relationships.
            </p>
            <div role="region" aria-label="Knowledge graph canvas" aria-describedby={graphSummaryId} className="h-[560px] rounded-2xl border border-white/10 bg-slate-900/80">
              <ReactFlow
                nodes={graphNodes}
                edges={graphEdges}
                fitView
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              >
                <MiniMap />
                <Controls />
                <Background color="#1e293b" gap={18} />
              </ReactFlow>
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-cyan-300">
                <Focus className="h-4 w-4" />
                <p className="text-sm font-medium">Selected node</p>
              </div>
              {selectedNode ? (
                <div role="status" aria-live="polite" className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={selectedNode.health} />
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                        {selectedNode.type}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">{selectedNode.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{selectedNode.description}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Metadata</p>
                    <p className="mt-2 text-sm text-slate-300">{selectedNode.metadata}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedNode.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Connected relations</p>
                    <div className="mt-2 space-y-2">
                      {relatedEdges.map((edge) => {
                        const counterpartId = edge.source === selectedNode.id ? edge.target : edge.source;
                        const counterpart = filteredNodes.find((node) => node.id === counterpartId);
                        return (
                          <div key={edge.id} className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                            <p className="font-medium text-white">{edge.label}</p>
                            <p className="mt-1 text-slate-400">
                              {counterpart?.label ?? counterpartId} • strength {Math.round(edge.strength * 100)}% • evidence {edge.evidenceCount}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  className="mt-4"
                  title={hasActiveFilters ? 'No nodes match the current graph query' : 'No graph data available yet'}
                  description={
                    hasActiveFilters
                      ? 'Reset the search or switch back to the platform map preset to restore the broader topology.'
                      : 'The knowledge graph is ready, but no nodes have been published for this tenant yet.'
                  }
                  actions={
                    hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                      >
                        Reset graph filters
                      </button>
                    ) : null
                  }
                />
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-emerald-300">
                <Save className="h-4 w-4" />
                <p className="text-sm font-medium">Saved views</p>
              </div>
              {sessionUserId ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-col gap-3">
                    <label htmlFor={presetNameId} className="sr-only">
                      Preset name
                    </label>
                    <input
                      id={presetNameId}
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="Save the current graph view"
                      className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={saveCurrentPreset}
                      disabled={!presetName.trim()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      Save current view
                    </button>
                  </div>
                  {savedPresets.length ? (
                    <div className="space-y-3">
                      {savedPresets.map((savedPreset) => (
                        <div key={savedPreset.id} className="rounded-xl bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => applySavedPreset(savedPreset)}
                              className="text-left"
                            >
                              <p className="font-medium text-white">{savedPreset.title}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {savedPreset.layoutMode.replace('-', ' ')} • {savedPreset.query ? `query “${savedPreset.query}”` : 'full topology'}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedPreset(savedPreset)}
                              aria-label={`Delete preset ${savedPreset.title}`}
                              className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-rose-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Saved graph views are scoped to your user session and stay available on this browser.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Saved views become available once a user session is loaded.
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div className="flex items-center gap-2 text-violet-300">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-medium">Relationship legend</p>
              </div>
              <div className="mt-4 space-y-2">
                {Object.entries(relationshipBreakdown).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                    <span className="text-slate-300">{label}</span>
                    <span className="text-white">{count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-400">
                <div className="flex items-center gap-2 text-slate-200">
                  <Network className="h-4 w-4 text-cyan-300" />
                  Visual query examples
                </div>
                <ul className="mt-2 space-y-1 leading-6">
                  <li>• Find buyer intent clusters around a category surge.</li>
                  <li>• Trace which agents monitor a specific location or listing.</li>
                  <li>• Identify supply nodes connected to a high-value listing.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function GraphExplorer(props: {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  sessionUserId?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
