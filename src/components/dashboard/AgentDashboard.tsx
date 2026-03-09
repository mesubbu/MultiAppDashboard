'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BrainCircuit,
  Clock3,
  PauseCircle,
  RotateCcw,
  Search,
  Wallet,
  Workflow,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { cn, formatCompactNumber, formatCurrency, formatDateTime } from '@/lib/utils';
import type {
  AgentExecutionRecord,
  AgentLogLevel,
  AgentRecord,
  AgentTaskRecord,
} from '@/types/platform';

function toneForLog(level: AgentLogLevel) {
  if (level === 'error') return 'text-rose-300';
  if (level === 'warn') return 'text-amber-300';
  return 'text-emerald-300';
}

type AgentActionPayload =
  | { action: 'pause' | 'restart' }
  | { action: 'update_budget'; budgetUsd: number }
  | { action: 'update_workflow'; workflowVersion: string };

export function AgentDashboard({ agents, canOperate }: { agents: AgentRecord[]; canOperate: boolean }) {
  const router = useRouter();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const searchInputId = useId();
  const stateFilterId = useId();
  const budgetInputId = useId();
  const workflowInputId = useId();
  const [localAgents, setLocalAgents] = useState(agents);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? '');
  const [stateFilter, setStateFilter] = useState<'all' | AgentRecord['state']>('all');
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { budget: number; workflow: string }>>({});
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const filteredAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return localAgents.filter((agent) => {
      const stateMatch = stateFilter === 'all' || agent.state === stateFilter;
      const queryMatch =
        !normalizedQuery ||
        agent.name.toLowerCase().includes(normalizedQuery) ||
        agent.queue.toLowerCase().includes(normalizedQuery) ||
        agent.tenantId.toLowerCase().includes(normalizedQuery) ||
        agent.appId.toLowerCase().includes(normalizedQuery);
      return stateMatch && queryMatch;
    });
  }, [localAgents, query, stateFilter]);

  const selectedAgent =
    filteredAgents.find((agent) => agent.id === selectedAgentId) ??
    localAgents.find((agent) => agent.id === selectedAgentId) ??
    filteredAgents[0] ??
    localAgents[0] ??
    null;

  const hasActiveFilters = query.trim().length > 0 || stateFilter !== 'all';

  function clearFilters() {
    setQuery('');
    setStateFilter('all');
  }

  async function applyAction(agentId: string, payload: AgentActionPayload) {
    const previousAgents = localAgents;
    if (
      payload.action === 'pause' &&
      !window.confirm('Pause this agent and stop further execution until it is resumed?')
    ) {
      return;
    }
    if (
      payload.action === 'restart' &&
      !window.confirm('Restart this agent and enqueue a fresh execution run?')
    ) {
      return;
    }

    setFeedback(null);
    setSaving(agentId);

    setLocalAgents((current) =>
      current.map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }

        const nextLogs = [...agent.logs];
        const nextHistory = [...agent.executionHistory];
        const now = new Date().toISOString();

        if (payload.action === 'pause') {
          nextLogs.unshift({
            id: `log_${now}`,
            level: 'warn',
            source: 'control-dashboard',
            message: 'Agent paused by an administrator from the control dashboard.',
            timestamp: now,
          });
          return { ...agent, state: 'paused', logs: nextLogs };
        }

        if (payload.action === 'restart') {
          nextLogs.unshift({
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: 'Agent restart requested by an administrator.',
            timestamp: now,
          });
          nextHistory.unshift({
            id: `run_${now}`,
            workflowVersion: agent.workflowVersion,
            status: 'running',
            startedAt: now,
            endedAt: now,
            costUsd: 0,
            outputSummary: 'Restart initiated from the control dashboard.',
          });
          return {
            ...agent,
            state: 'running',
            lastHeartbeatAt: now,
            logs: nextLogs,
            executionHistory: nextHistory,
          };
        }

        if (payload.action === 'update_budget') {
          nextLogs.unshift({
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: `Budget changed to $${payload.budgetUsd}.`,
            timestamp: now,
          });
          return {
            ...agent,
            budgetUsd:
              typeof payload.budgetUsd === 'number' ? payload.budgetUsd : agent.budgetUsd,
            logs: nextLogs,
          };
        }

        if (payload.action === 'update_workflow') {
          nextLogs.unshift({
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: `Workflow updated to ${payload.workflowVersion}.`,
            timestamp: now,
          });
          return {
            ...agent,
            workflowVersion: payload.workflowVersion,
            logs: nextLogs,
          };
        }

        return agent;
      }),
    );

    try {
      const response = await fetch(`/api/admin/agents/${agentId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responsePayload = (await response.json().catch(() => null)) as
        | { agent?: AgentRecord; audit?: { summary?: string }; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(responsePayload?.error?.message ?? 'Unable to update agent.');
      }

      if (responsePayload?.agent) {
        setLocalAgents((current) =>
          current.map((agent) => (agent.id === agentId ? responsePayload.agent ?? agent : agent)),
        );
      }

      const successText =
        responsePayload?.audit?.summary ??
        (payload.action === 'pause'
          ? 'Agent paused.'
          : payload.action === 'restart'
            ? 'Agent restarted.'
            : payload.action === 'update_budget'
              ? 'Budget saved.'
              : 'Workflow saved.');

      setFeedback({
        tone: 'success',
        text: successText,
      });
      pushSuccessToast('Agent updated', successText);
      router.refresh();
    } catch (error) {
      setLocalAgents(previousAgents);
      const errorText = error instanceof Error ? error.message : 'Unable to update agent.';
      setFeedback({
        tone: 'error',
        text: errorText,
      });
      pushErrorToast('Unable to update agent', errorText);
    } finally {
      setSaving(null);
    }
  }

  if (!selectedAgent) {
    return (
      <SectionCard title="Agent dashboard" description="Operator controls, execution telemetry, and workflow management for the active fleet.">
        <EmptyState
          title="No agents are available"
          description="The control plane did not return any agents for this tenant yet. Refresh to retry once agents are provisioned."
          actions={
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
            >
              Retry fleet load
            </button>
          }
        />
      </SectionCard>
    );
  }

  const draftBudget = drafts[selectedAgent.id]?.budget ?? selectedAgent.budgetUsd;
  const draftWorkflow = drafts[selectedAgent.id]?.workflow ?? selectedAgent.workflowVersion;

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <SectionCard title="Agent fleet" description="Filter by state, select an agent, and jump into tasks, decisions, logs, and execution history.">
        <div className="space-y-4">
          <div className="relative">
            <label htmlFor={searchInputId} className="sr-only">
              Search agents
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id={searchInputId}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agent, queue, tenant, or app"
              className="w-full rounded-xl border border-white/10 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-100"
            />
          </div>
          <label htmlFor={stateFilterId} className="sr-only">
            Filter agents by state
          </label>
          <select
            id={stateFilterId}
            value={stateFilter}
            onChange={(event) =>
              setStateFilter(event.target.value as 'all' | AgentRecord['state'])
            }
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-100"
          >
            <option value="all">All states</option>
            <option value="running">running</option>
            <option value="paused">paused</option>
            <option value="throttled">throttled</option>
            <option value="error">error</option>
          </select>
          <div className="space-y-3">
            {filteredAgents.length > 0 ? (
              filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  aria-pressed={agent.id === selectedAgent.id}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition',
                    agent.id === selectedAgent.id
                      ? 'border-cyan-400/40 bg-cyan-400/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{agent.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{agent.tenantId} • {agent.appId}</p>
                    </div>
                    <StatusBadge value={agent.state} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-300">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Queue</p>
                      <p className="mt-1">{agent.queueDepth}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Latency</p>
                      <p className="mt-1">{agent.avgLatencyMs} ms</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{agent.lastTask}</p>
                </button>
              ))
            ) : (
              <EmptyState
                compact
                title="No agents match the current filters"
                description="Clear the search or state filter to bring the fleet list back into view."
                actions={
                  hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                    >
                      Clear filters
                    </button>
                  ) : null
                }
              />
            )}
          </div>
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard title={selectedAgent.name} description={`${selectedAgent.tenantId} • ${selectedAgent.appId} • queue ${selectedAgent.queue}`}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={selectedAgent.state} />
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                  {selectedAgent.workflowVersion}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                  heartbeat {formatDateTime(selectedAgent.lastHeartbeatAt)}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><Activity className="h-4 w-4" />Queue depth</div>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAgent.queueDepth}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><Clock3 className="h-4 w-4" />Avg latency</div>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAgent.avgLatencyMs} ms</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><BrainCircuit className="h-4 w-4" />Tokens / 1h</div>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCompactNumber(selectedAgent.tokenUsage1h)}</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><Wallet className="h-4 w-4" />Budget used</div>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAgent.budgetUtilizationPercent}%</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Current objective</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{selectedAgent.lastTask}</p>
              </div>
            </div>
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              {feedback ? (
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm',
                    feedback.tone === 'success'
                      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-400/30 bg-rose-500/10 text-rose-200',
                  )}
                >
                  {feedback.text}
                </div>
              ) : null}
              <div>
                <label htmlFor={budgetInputId} className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Budget (USD)
                </label>
                <input
                  id={budgetInputId}
                  value={draftBudget}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [selectedAgent.id]: {
                        budget: Number(event.target.value),
                        workflow: current[selectedAgent.id]?.workflow ?? selectedAgent.workflowVersion,
                      },
                    }))
                  }
                  type="number"
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
                />
                <button
                  onClick={() => applyAction(selectedAgent.id, { action: 'update_budget', budgetUsd: draftBudget })}
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save budget
                </button>
              </div>
              <div>
                <label htmlFor={workflowInputId} className="text-xs uppercase tracking-[0.25em] text-slate-500">
                  Workflow version
                </label>
                <input
                  id={workflowInputId}
                  value={draftWorkflow}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [selectedAgent.id]: {
                        budget: current[selectedAgent.id]?.budget ?? selectedAgent.budgetUsd,
                        workflow: event.target.value,
                      },
                    }))
                  }
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100"
                />
                <button
                  onClick={() =>
                    applyAction(selectedAgent.id, {
                      action: 'update_workflow',
                      workflowVersion: draftWorkflow,
                    })
                  }
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="mt-2 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save workflow
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={() => applyAction(selectedAgent.id, { action: 'pause' })}
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause
                </button>
                <button
                  onClick={() => applyAction(selectedAgent.id, { action: 'restart' })}
                  disabled={!canOperate || saving === selectedAgent.id}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {!canOperate
                  ? 'You have read-only access for agent operations.'
                  : saving === selectedAgent.id
                    ? 'Applying update…'
                    : 'All changes are routed through the control-plane API.'}
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="grid gap-6 2xl:grid-cols-2">
          <SectionCard title="Agent tasks" description="Running, queued, and review-bound tasks in the active workflow.">
            <div className="space-y-3">
              {selectedAgent.tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Agent decisions" description="Recent decisions and routing outcomes produced by the selected agent.">
            <div className="space-y-3">
              {selectedAgent.decisions.map((decision) => (
                <div key={decision.id} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{decision.summary}</p>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                      {Math.round(decision.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{decision.rationale}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{decision.outcome.replaceAll('_', ' ')}</span>
                    <span>{formatDateTime(decision.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Live logs" description="Most recent agent-runtime, tool-executor, and control-plane events.">
            <div className="space-y-3">
              {selectedAgent.logs.map((log) => (
                <div key={log.id} className="rounded-2xl bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span className={toneForLog(log.level)}>{log.level}</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-white">{log.source}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{log.message}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Execution history" description="Recent workflow executions and their cost / output summaries.">
            <div className="space-y-3">
              {selectedAgent.executionHistory.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: AgentTaskRecord }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-white">{task.title}</p>
          <p className="mt-1 text-sm text-slate-400">{task.summary}</p>
        </div>
        <StatusBadge value={task.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>priority {task.priority}</span>
        <span>owner {task.owner}</span>
        <span>updated {formatDateTime(task.updatedAt)}</span>
      </div>
    </div>
  );
}

function ExecutionRow({ execution }: { execution: AgentExecutionRecord }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <Workflow className="h-4 w-4 text-cyan-300" />
          <p className="font-medium">{execution.workflowVersion}</p>
        </div>
        <StatusBadge value={execution.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{execution.outputSummary}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{formatDateTime(execution.startedAt)}</span>
        <span>{formatDateTime(execution.endedAt)}</span>
        <span>{formatCurrency(execution.costUsd)}</span>
      </div>
    </div>
  );
}
