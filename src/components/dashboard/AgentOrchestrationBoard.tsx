'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  GitBranchPlus,
  GripVertical,
  Layers3,
  RefreshCw,
  Route,
  ShieldAlert,
  Unlock,
  Workflow,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import {
  canMoveToStage,
  getAllowedNextStages,
  getInvalidTransitionMessage,
  getNextDependencyState,
} from '@/lib/agent-orchestration';
import { formatAgentActionLabel } from '@/lib/agent-audit';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { cn, formatDateTime } from '@/lib/utils';
import type { AgentOrchestrationStage, AgentRecord, AuditRecord } from '@/types/platform';

const stageConfig: Array<{ key: AgentOrchestrationStage; label: string; description: string }> = [
  { key: 'intake', label: 'Intake', description: 'Signal collection and queue intake.' },
  { key: 'reason', label: 'Reason', description: 'Planning and multi-step reasoning.' },
  { key: 'review', label: 'Review', description: 'Human or policy review gates.' },
  { key: 'act', label: 'Act', description: 'Tool execution and outbound actions.' },
  { key: 'observe', label: 'Observe', description: 'Telemetry, memory, and follow-up.' },
];

const defaultLaneByStage: Record<AgentOrchestrationStage, string> = {
  intake: 'Signal and queue intake',
  reason: 'Reasoning and planning',
  review: 'Human and policy review',
  act: 'Tool execution',
  observe: 'Monitoring and follow-up',
};

function formatAutonomy(value: AgentRecord['orchestration']['autonomyLevel']) {
  return value.replaceAll('_', ' ');
}

export function AgentOrchestrationBoard({ agents, canOperate }: { agents: AgentRecord[]; canOperate: boolean }) {
  const router = useRouter();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const keyboardHelpId = useId();
  const rerouteSelectId = useId();
  const [localAgents, setLocalAgents] = useState(agents);
  const [auditTrailByAgent, setAuditTrailByAgent] = useState<Record<string, AuditRecord[]>>({});
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? '');
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [activeDropStage, setActiveDropStage] = useState<AgentOrchestrationStage | null>(null);
  const [invalidDropStage, setInvalidDropStage] = useState<AgentOrchestrationStage | null>(null);
  const [movingAgentId, setMovingAgentId] = useState<string | null>(null);
  const [rerouteTarget, setRerouteTarget] = useState<AgentOrchestrationStage | ''>('');
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: 'retry_queue' | 'unblock' | 'reroute';
    title: string;
    description: string;
    confirmLabel: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalAgents(agents);
  }, [agents]);

  const agentsById = useMemo(
    () => new Map(localAgents.map((agent) => [agent.id, agent])),
    [localAgents],
  );
  const draggedAgent = draggedAgentId ? agentsById.get(draggedAgentId) ?? null : null;
  const selectedAgent = agentsById.get(selectedAgentId) ?? localAgents[0] ?? null;
  const allowedSelectedStages = useMemo(() => {
    if (!selectedAgent) {
      return [];
    }
    return getAllowedNextStages({
      currentStage: selectedAgent.orchestration.stage,
      dependencyState: selectedAgent.orchestration.dependencyState,
    });
  }, [selectedAgent]);
  const selectedAuditEntries = selectedAgent ? auditTrailByAgent[selectedAgent.id] ?? [] : [];

  useEffect(() => {
    setRerouteTarget((current) => {
      if (current && allowedSelectedStages.includes(current)) {
        return current;
      }
      return allowedSelectedStages[0] ?? '';
    });
  }, [allowedSelectedStages]);

  useEffect(() => {
    setPendingConfirmation(null);
  }, [selectedAgentId]);

  const stageLanes = useMemo(
    () =>
      stageConfig.map((stage) => ({
        ...stage,
        items: localAgents.filter((agent) => agent.orchestration.stage === stage.key),
      })),
    [localAgents],
  );

  const dependencyEdges = useMemo(
    () =>
      localAgents.flatMap((agent) =>
        agent.orchestration.upstreamAgentIds
          .map((upstreamAgentId) => {
            const upstream = agentsById.get(upstreamAgentId);
            if (!upstream) return null;
            return { upstream, downstream: agent };
          })
          .filter((edge): edge is { upstream: AgentRecord; downstream: AgentRecord } => edge !== null),
      ),
    [localAgents, agentsById],
  );

  const blockedAgents = localAgents.filter(
    (agent) =>
      agent.orchestration.dependencyState === 'blocked' || agent.orchestration.blockers.length > 0,
  );

  async function commitAgentAction(options: {
    agentId: string;
    payload: Record<string, string>;
    updateAgent: (agent: AgentRecord, now: string) => AgentRecord;
    rollbackMessage: string;
  }) {
    const { agentId, payload, updateAgent, rollbackMessage } = options;
    const previousAgents = localAgents;
    const now = new Date().toISOString();

    setErrorMessage(null);
    setSuccessMessage(null);
    setMovingAgentId(agentId);
    setLocalAgents((current) =>
      current.map((item) => (item.id === agentId ? updateAgent(item, now) : item)),
    );

    try {
      const response = await fetch(`/api/admin/agents/${agentId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => null)) as
        | { error?: { message?: string }; audit?: AuditRecord; agent?: AgentRecord }
        | null;

      if (!response.ok) {
        throw new Error(responsePayload?.error?.message ?? `Failed with status ${response.status}`);
      }

      if (responsePayload?.agent) {
        setLocalAgents((current) =>
          current.map((item) => (item.id === agentId ? responsePayload.agent ?? item : item)),
        );
      }
      if (responsePayload?.audit) {
        setAuditTrailByAgent((current) => ({
          ...current,
          [agentId]: [responsePayload.audit!, ...(current[agentId] ?? [])].slice(0, 6),
        }));
        const successText = responsePayload.audit.summary ?? 'Agent action applied.';
        setSuccessMessage(successText);
        pushSuccessToast('Agent action applied', successText);
      }
      router.refresh();
    } catch (error) {
      setLocalAgents(previousAgents);
      const errorText = error instanceof Error ? `${error.message} ${rollbackMessage}` : rollbackMessage;
      setErrorMessage(errorText);
      pushErrorToast('Unable to update orchestration state', errorText);
    } finally {
      setMovingAgentId(null);
    }
  }

  async function handleStageMove(agentId: string, targetStage: AgentOrchestrationStage) {
    if (!canOperate) {
      return;
    }
    const agent = agentsById.get(agentId);
    if (!agent || agent.orchestration.stage === targetStage) {
      return;
    }

    const transitionContext = {
      currentStage: agent.orchestration.stage,
      dependencyState: agent.orchestration.dependencyState,
    };
    if (!canMoveToStage(transitionContext, targetStage)) {
      const errorText = getInvalidTransitionMessage(transitionContext, targetStage);
      setErrorMessage(errorText);
      pushErrorToast('Invalid stage transition', errorText);
      setDraggedAgentId(null);
      setActiveDropStage(null);
      setInvalidDropStage(targetStage);
      return;
    }

    const nextLane = defaultLaneByStage[targetStage];
    await commitAgentAction({
      agentId,
      payload: {
        action: 'move_stage',
        stage: targetStage,
        lane: nextLane,
        currentStage: agent.orchestration.stage,
        dependencyState: agent.orchestration.dependencyState,
      },
      updateAgent: (item, now) => ({
        ...item,
        orchestration: {
          ...item.orchestration,
          stage: targetStage,
          lane: nextLane,
          stageEnteredAt: now,
          dependencyState: getNextDependencyState(targetStage, item.orchestration.blockers.length),
        },
      }),
      rollbackMessage: 'The lane change was rolled back.',
    });

    setDraggedAgentId(null);
    setActiveDropStage(null);
    setInvalidDropStage(null);
  }

  async function handleRetryQueue() {
    if (!canOperate) {
      return;
    }
    if (!selectedAgent) {
      return;
    }
    if (selectedAgent.orchestration.dependencyState === 'blocked') {
      const errorText = 'Blocked agents must be unblocked before retrying the queue.';
      setErrorMessage(errorText);
      pushErrorToast('Queue retry blocked', errorText);
      return;
    }

    await commitAgentAction({
      agentId: selectedAgent.id,
      payload: {
        action: 'retry_queue',
        currentStage: selectedAgent.orchestration.stage,
        dependencyState: selectedAgent.orchestration.dependencyState,
      },
      updateAgent: (item, now) => ({
        ...item,
        state: 'running',
        lastHeartbeatAt: now,
        queueDepth: Math.max(item.queueDepth, 1),
        logs: [
          {
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: 'Queue retry requested from orchestration board.',
            timestamp: now,
          },
          ...item.logs,
        ],
        executionHistory: [
          {
            id: `run_${now}`,
            workflowVersion: item.workflowVersion,
            status: 'running',
            startedAt: now,
            endedAt: now,
            costUsd: 0,
            outputSummary: 'Queue retry initiated from orchestration board.',
          },
          ...item.executionHistory,
        ],
      }),
      rollbackMessage: 'The queue retry was rolled back.',
    });
  }

  async function handleUnblock() {
    if (!canOperate) {
      return;
    }
    if (!selectedAgent) {
      return;
    }

    await commitAgentAction({
      agentId: selectedAgent.id,
      payload: { action: 'unblock' },
      updateAgent: (item, now) => ({
        ...item,
        orchestration: {
          ...item.orchestration,
          blockers: [],
          dependencyState: getNextDependencyState(item.orchestration.stage, 0),
        },
        logs: [
          {
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: 'Agent unblock requested from orchestration board.',
            timestamp: now,
          },
          ...item.logs,
        ],
      }),
      rollbackMessage: 'The unblock action was rolled back.',
    });
  }

  async function handleReroute() {
    if (!canOperate) {
      return;
    }
    if (!selectedAgent || !rerouteTarget) {
      return;
    }

    const transitionContext = {
      currentStage: selectedAgent.orchestration.stage,
      dependencyState: selectedAgent.orchestration.dependencyState,
    };
    if (!canMoveToStage(transitionContext, rerouteTarget)) {
      const errorText = getInvalidTransitionMessage(transitionContext, rerouteTarget);
      setErrorMessage(errorText);
      pushErrorToast('Invalid reroute target', errorText);
      return;
    }

    const nextLane = defaultLaneByStage[rerouteTarget];
    await commitAgentAction({
      agentId: selectedAgent.id,
      payload: {
        action: 'reroute',
        stage: rerouteTarget,
        lane: nextLane,
        currentStage: selectedAgent.orchestration.stage,
        dependencyState: selectedAgent.orchestration.dependencyState,
      },
      updateAgent: (item, now) => ({
        ...item,
        orchestration: {
          ...item.orchestration,
          stage: rerouteTarget,
          lane: nextLane,
          stageEnteredAt: now,
          dependencyState: getNextDependencyState(rerouteTarget, item.orchestration.blockers.length),
        },
        logs: [
          {
            id: `log_${now}`,
            level: 'info',
            source: 'control-dashboard',
            message: `Agent rerouted to ${rerouteTarget} from orchestration board.`,
            timestamp: now,
          },
          ...item.logs,
        ],
      }),
      rollbackMessage: 'The reroute was rolled back.',
    });
  }

  async function confirmPendingAction() {
    if (!pendingConfirmation) {
      return;
    }

    const action = pendingConfirmation.action;
    setPendingConfirmation(null);

    if (action === 'retry_queue') {
      await handleRetryQueue();
      return;
    }
    if (action === 'unblock') {
      await handleUnblock();
      return;
    }
    await handleReroute();
  }

  const isSelectedAgentUpdating = movingAgentId === selectedAgent?.id;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <SectionCard
        title="Multi-agent orchestration board"
        description="Track queue stages, agent handoffs, and dependency health across the orchestration pipeline."
      >
        {errorMessage ? (
          <div role="alert" className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div role="status" aria-live="polite" className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}
        {!canOperate ? (
          <div role="status" className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
            You have read-only access for orchestration controls.
          </div>
        ) : null}
        <p id={keyboardHelpId} className="mb-4 text-sm text-slate-400">
          Keyboard tip: tab to an agent card to select it, then use the reroute controls below to move the selected agent without drag and drop.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <MetricTile label="Active stages" value={`${stageLanes.filter((lane) => lane.items.length > 0).length}`} />
          <MetricTile label="Queued work" value={`${localAgents.reduce((sum, agent) => sum + agent.queueDepth, 0)}`} />
          <MetricTile label="Blocked agents" value={`${blockedAgents.length}`} tone="rose" />
          <MetricTile label="Dependency edges" value={`${dependencyEdges.length}`} />
        </div>
        <div className="mt-5 grid gap-4 2xl:grid-cols-5 lg:grid-cols-3 sm:grid-cols-2">
          {stageLanes.map((lane) => (
            <div
              key={lane.key}
              onDragOver={(event) => {
                if (!canOperate) {
                  return;
                }
                if (!draggedAgent || draggedAgent.orchestration.stage === lane.key) {
                  return;
                }
                const isValid = canMoveToStage(
                  {
                    currentStage: draggedAgent.orchestration.stage,
                    dependencyState: draggedAgent.orchestration.dependencyState,
                  },
                  lane.key,
                );
                event.preventDefault();
                if (isValid) {
                  setActiveDropStage(lane.key);
                  setInvalidDropStage(null);
                } else {
                  setActiveDropStage(null);
                  setInvalidDropStage(lane.key);
                }
              }}
              onDragLeave={() => {
                setActiveDropStage((current) => (current === lane.key ? null : current));
                setInvalidDropStage((current) => (current === lane.key ? null : current));
              }}
              onDrop={(event) => {
                if (!canOperate) {
                  return;
                }
                event.preventDefault();
                const agentId = event.dataTransfer.getData('text/plain') || draggedAgentId;
                if (agentId) {
                  void handleStageMove(agentId, lane.key);
                }
              }}
              className={cn(
                'rounded-2xl border bg-white/5 p-4 transition',
                activeDropStage === lane.key
                  ? 'border-cyan-400/50 bg-cyan-400/10'
                  : invalidDropStage === lane.key
                    ? 'border-rose-400/50 bg-rose-500/10'
                    : 'border-white/10',
              )}
            >
              <div className="border-b border-white/10 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-white">{lane.label}</h3>
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                    {lane.items.length}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{lane.description}</p>
                {draggedAgent && draggedAgent.orchestration.stage !== lane.key ? (
                  <p
                    className={cn(
                      'mt-2 text-xs',
                      canMoveToStage(
                        {
                          currentStage: draggedAgent.orchestration.stage,
                          dependencyState: draggedAgent.orchestration.dependencyState,
                        },
                        lane.key,
                      )
                        ? 'text-cyan-300'
                        : 'text-rose-300',
                    )}
                  >
                    {canMoveToStage(
                      {
                        currentStage: draggedAgent.orchestration.stage,
                        dependencyState: draggedAgent.orchestration.dependencyState,
                      },
                      lane.key,
                    )
                      ? 'Valid next stage'
                      : 'Invalid next stage for current dependencies'}
                  </p>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {lane.items.length > 0 ? (
                  lane.items.map((agent) => (
                    <button
                      type="button"
                      key={agent.id}
                      draggable={canOperate}
                      onDragStart={(event) => {
                        if (!canOperate) {
                          return;
                        }
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', agent.id);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                        setDraggedAgentId(agent.id);
                        setInvalidDropStage(null);
                        setSelectedAgentId(agent.id);
                      }}
                      onDragEnd={() => {
                        setDraggedAgentId(null);
                        setActiveDropStage(null);
                        setInvalidDropStage(null);
                      }}
                      onClick={() => setSelectedAgentId(agent.id)}
                      aria-pressed={selectedAgent?.id === agent.id}
                      aria-describedby={keyboardHelpId}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition',
                        selectedAgent?.id === agent.id
                          ? 'border-cyan-400/40 bg-cyan-400/10'
                          : 'border-white/10 bg-slate-950/40 hover:bg-white/10',
                        draggedAgentId === agent.id && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-slate-500" />
                            <p className="font-medium text-white">{agent.name}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{agent.orchestration.lane}</p>
                        </div>
                        <StatusBadge value={agent.state} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge value={agent.orchestration.dependencyState} />
                        <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                          {formatAutonomy(agent.orchestration.autonomyLevel)}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                        <span>queue {agent.queueDepth}</span>
                        <span>upstream {agent.orchestration.upstreamAgentIds.length}</span>
                        <span>downstream {agent.orchestration.downstreamAgentIds.length}</span>
                        <span>
                          {movingAgentId === agent.id ? 'moving…' : `blockers ${agent.orchestration.blockers.length}`}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    compact
                    title={`No agents in ${lane.label.toLowerCase()}`}
                    description="Drag an agent into this lane or update orchestration rules to repopulate the stage."
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-6">
        <SectionCard
          title="Dependency focus"
          description="Inspect upstream/downstream relationships, blockers, queue timing, and drag-drop status for the selected agent."
        >
          {selectedAgent ? (
            <div className="space-y-4 text-sm text-slate-300">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={selectedAgent.orchestration.dependencyState} />
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                    {formatAutonomy(selectedAgent.orchestration.autonomyLevel)}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{selectedAgent.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{selectedAgent.orchestration.lane}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Queue timing</p>
                <p className="mt-2 text-sm text-slate-300">
                  Stage entered {formatDateTime(selectedAgent.orchestration.stageEnteredAt)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Drag this agent card into another stage lane to move it optimistically.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Valid next stages:{' '}
                  {allowedSelectedStages.length > 0
                    ? allowedSelectedStages.join(', ')
                    : 'resolve the current dependency state before moving this agent.'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Queue controls</p>
                <div className="mt-3 grid gap-2">
                  {pendingConfirmation ? (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                      <div className="flex items-center gap-2 font-medium text-amber-50">
                        <ShieldAlert className="h-4 w-4" />
                        {pendingConfirmation.title}
                      </div>
                      <p className="mt-2 text-sm text-amber-100/90">{pendingConfirmation.description}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmPendingAction()}
                          disabled={!canOperate || isSelectedAgentUpdating}
                          className="rounded-lg bg-amber-300 px-3 py-1.5 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingConfirmation.confirmLabel}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingConfirmation(null)}
                          disabled={!canOperate || isSelectedAgentUpdating}
                          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirmation({
                        action: 'retry_queue',
                        title: 'Confirm queue retry',
                        description: `Retry queued work for ${selectedAgent.name} and mark the agent as running again?`,
                        confirmLabel: 'Retry queue',
                      })
                    }
                    disabled={
                      !canOperate ||
                      isSelectedAgentUpdating ||
                      selectedAgent.orchestration.dependencyState === 'blocked'
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry queue
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingConfirmation({
                        action: 'unblock',
                        title: 'Confirm unblock',
                        description: `Clear ${selectedAgent.orchestration.blockers.length} blocker(s) for ${selectedAgent.name} and resume dependency flow?`,
                        confirmLabel: 'Unblock agent',
                      })
                    }
                    disabled={!canOperate || isSelectedAgentUpdating || selectedAgent.orchestration.blockers.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Unlock className="h-4 w-4" />
                    Unblock
                  </button>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label htmlFor={rerouteSelectId} className="sr-only">
                      Reroute selected agent to another stage
                    </label>
                    <select
                      id={rerouteSelectId}
                      value={rerouteTarget}
                      onChange={(event) => setRerouteTarget(event.target.value as AgentOrchestrationStage | '')}
                      disabled={!canOperate || isSelectedAgentUpdating || allowedSelectedStages.length === 0}
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {allowedSelectedStages.length === 0 ? <option value="">No valid reroute targets</option> : null}
                      {allowedSelectedStages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingConfirmation({
                          action: 'reroute',
                          title: 'Confirm reroute',
                          description: `Reroute ${selectedAgent.name} to ${rerouteTarget} and update the orchestration lane immediately?`,
                          confirmLabel: 'Confirm reroute',
                        })
                      }
                      disabled={!canOperate || isSelectedAgentUpdating || !rerouteTarget}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Route className="h-4 w-4" />
                      Reroute
                    </button>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Recent operator actions</p>
                <div className="mt-3 space-y-3">
                  {selectedAuditEntries.length > 0 ? (
                    selectedAuditEntries.map((entry) => (
                      <div key={entry.id} className="rounded-xl bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                            {formatAgentActionLabel(entry.action)}
                          </span>
                          <span className="text-xs text-slate-500">{formatDateTime(entry.timestamp)}</span>
                        </div>
                        <p className="mt-2 text-sm text-white">{entry.summary ?? 'Operator action confirmed.'}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Triggered by {entry.actorDisplay ?? entry.actor}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-white/5 p-3 text-sm text-slate-500">
                      Confirmed retry, unblock, and reroute actions will appear here with actor and timestamp details.
                    </div>
                  )}
                </div>
              </div>
              <EntityGroup title="Upstream agents" ids={selectedAgent.orchestration.upstreamAgentIds} agentsById={agentsById} emptyLabel="No upstream dependencies." />
              <EntityGroup title="Downstream agents" ids={selectedAgent.orchestration.downstreamAgentIds} agentsById={agentsById} emptyLabel="No downstream handoffs." />
              <div>
                <div className="mb-2 flex items-center gap-2 text-slate-200">
                  <ShieldAlert className="h-4 w-4 text-rose-300" />
                  Blockers
                </div>
                {selectedAgent.orchestration.blockers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedAgent.orchestration.blockers.map((blocker) => (
                      <div key={blocker} className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">
                        {blocker}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    No active blockers.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Cross-agent handoffs"
          description="Dependency edges currently active across the orchestration graph."
        >
          <div className="space-y-3">
            {dependencyEdges.map(({ upstream, downstream }) => (
              <div key={`${upstream.id}-${downstream.id}`} className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white">
                  <GitBranchPlus className="h-4 w-4 text-cyan-300" />
                  <span>{upstream.name}</span>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                  <span>{downstream.name}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                    {upstream.orchestration.stage} → {downstream.orchestration.stage}
                  </span>
                  <StatusBadge value={downstream.orchestration.dependencyState} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MetricTile({ label, value, tone = 'cyan' }: { label: string; value: string; tone?: 'cyan' | 'rose' }) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        {tone === 'rose' ? <ShieldAlert className="h-4 w-4 text-rose-300" /> : <Layers3 className="h-4 w-4 text-cyan-300" />}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function EntityGroup({
  title,
  ids,
  agentsById,
  emptyLabel,
}: {
  title: string;
  ids: string[];
  agentsById: Map<string, AgentRecord>;
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-slate-200">
        <Workflow className="h-4 w-4 text-cyan-300" />
        {title}
      </div>
      {ids.length > 0 ? (
        <div className="space-y-2">
          {ids.map((id) => {
            const agent = agentsById.get(id);
            return (
              <div key={id} className="rounded-xl bg-white/5 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-white">{agent?.name ?? id}</span>
                  {agent ? <StatusBadge value={agent.state} /> : null}
                </div>
                <p className="mt-1 text-slate-500">{agent?.orchestration.lane ?? 'Unknown lane'}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-white/5 p-3 text-sm text-slate-500">{emptyLabel}</div>
      )}
    </div>
  );
}