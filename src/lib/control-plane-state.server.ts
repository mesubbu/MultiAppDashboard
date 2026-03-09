import { z } from 'zod';

import {
  agentActionRequestSchema,
  agentListResponseSchema,
  auditRecordSchema,
  eventListResponseSchema,
  modelListResponseSchema,
  modelSwitchRequestSchema,
  systemResponseSchema,
} from '@/types/contracts';
import type { AgentRecord, AuditRecord, PlatformEvent, SessionUser } from '@/types/platform';
import { getDashboardEnv } from '@/lib/env';
import { canMoveToStage, getInvalidTransitionMessage, getNextDependencyState } from '@/lib/agent-orchestration';
import { publishDashboardDomainEvent } from '@/lib/domain-events';
import { filterPlatformEvents, type LiveEventFilters } from '@/lib/live-events.server';
import { filterScopedItems, getScopeFilters } from '@/lib/scope';
import { agentsData, eventsData, modelsData, systemData } from '@/mocks/platform-data';

type AgentActionInput = z.infer<typeof agentActionRequestSchema>;
type ModelSwitchInput = z.infer<typeof modelSwitchRequestSchema>;
type LocalControlPlaneState = { agents: AgentRecord[]; events: PlatformEvent[]; models: z.infer<typeof modelListResponseSchema>['items']; system: z.infer<typeof systemResponseSchema>['sections']; auditLogs: AuditRecord[] };
type LocalControlPlaneStore = { getState(): LocalControlPlaneState; persist(): Promise<void>; clear(options?: { preservePersistedState?: boolean }): Promise<void> };

const localControlPlaneStateSchema = z.object({
  agents: agentListResponseSchema.shape.items.default(agentsData),
  events: eventListResponseSchema.shape.items.default(eventsData),
  models: modelListResponseSchema.shape.items.default(modelsData),
  system: systemResponseSchema.shape.sections.default(systemData),
  auditLogs: z.array(auditRecordSchema).default([]),
});

export class LocalControlPlaneError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
    this.name = 'LocalControlPlaneError';
  }
}

declare global {
  var __dashboardLocalControlPlaneStore: Promise<LocalControlPlaneStore> | undefined;
}

function cloneState(state: LocalControlPlaneState): LocalControlPlaneState { return structuredClone(state); }
function createInitialLocalControlPlaneState(): LocalControlPlaneState { return cloneState({ agents: agentsData, events: eventsData, models: modelsData, system: systemData, auditLogs: [] }); }

function buildAgentActionSummary(action: AgentActionInput['action'], details: { stage?: string; lane?: string } = {}) {
  const stageSuffix = details.stage ? ` to ${details.stage}` : '';
  const laneSuffix = details.lane ? ` · ${details.lane}` : '';
  switch (action) {
    case 'move_stage': return `Moved stage${stageSuffix}${laneSuffix}`;
    case 'retry_queue': return 'Retried queue execution';
    case 'unblock': return 'Cleared active blockers';
    case 'reroute': return `Rerouted agent${stageSuffix}${laneSuffix}`;
    case 'pause': return 'Paused agent execution';
    case 'restart': return 'Restarted agent execution';
    case 'update_budget': return 'Updated agent budget';
    case 'update_workflow': return 'Updated workflow version';
  }
}

function createInMemoryStore(): LocalControlPlaneStore {
  let state = createInitialLocalControlPlaneState();
  return { getState: () => state, async persist() {}, async clear() { state = createInitialLocalControlPlaneState(); } };
}

async function createFileBackedStore(filePath: string): Promise<LocalControlPlaneStore> {
  const [{ mkdir, readFile, rename, rm, writeFile }, { dirname, resolve }] = await Promise.all([import('node:fs/promises'), import('node:path')]);
  const resolvedPath = resolve(process.cwd(), filePath);
  let state = createInitialLocalControlPlaneState();
  let writeQueue = Promise.resolve();

  async function persistToDisk() {
    await mkdir(dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, resolvedPath);
  }

  async function persist() { writeQueue = writeQueue.then(() => persistToDisk()); await writeQueue; }

  try {
    state = localControlPlaneStateSchema.parse(JSON.parse(await readFile(resolvedPath, 'utf8')));
  } catch {
    await persistToDisk();
  }

  return { getState: () => state, persist, async clear(options = {}) { state = createInitialLocalControlPlaneState(); if (!options.preservePersistedState) await rm(resolvedPath, { force: true }); } };
}

async function getStore() {
  if (globalThis.__dashboardLocalControlPlaneStore) return globalThis.__dashboardLocalControlPlaneStore;
  const filePath = getDashboardEnv().CONTROL_PLANE_STATE_FILE;
  globalThis.__dashboardLocalControlPlaneStore = filePath ? createFileBackedStore(filePath) : Promise.resolve(createInMemoryStore());
  return globalThis.__dashboardLocalControlPlaneStore;
}

function findAgent(state: LocalControlPlaneState, agentId: string) {
  const agent = state.agents.find((item) => item.id === agentId);
  if (!agent) throw new LocalControlPlaneError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  return agent;
}

export function resetLocalControlPlaneStoreCache() { globalThis.__dashboardLocalControlPlaneStore = undefined; }
export async function resetLocalControlPlaneStateForTests(options?: { preservePersistedState?: boolean }) { const store = await getStore(); await store.clear(options); resetLocalControlPlaneStoreCache(); }
export async function listLocalControlPlaneAgents(user: SessionUser) { return filterScopedItems(cloneState((await getStore()).getState()).agents, getScopeFilters(user)); }
export async function listLocalControlPlaneEvents(user: SessionUser, filters: LiveEventFilters = {}) {
  const scopedEvents = filterScopedItems(cloneState((await getStore()).getState()).events, getScopeFilters(user));
  return filterPlatformEvents(scopedEvents, filters);
}
export async function listLocalControlPlaneModels() { return cloneState((await getStore()).getState()).models; }
export async function getLocalControlPlaneSystem() { return cloneState((await getStore()).getState()).system; }

export async function appendLocalControlPlaneEvent(event: PlatformEvent) {
  const store = await getStore();
  store.getState().events.unshift(event);
  await store.persist();
}

export async function applyLocalAgentAction(user: SessionUser, agentId: string, payload: AgentActionInput) {
  const store = await getStore();
  const state = store.getState();
  const agent = findAgent(state, agentId);
  if (!filterScopedItems([agent], getScopeFilters(user)).length) throw new LocalControlPlaneError(404, 'AGENT_NOT_FOUND', `No agent found for ${agentId}.`);
  const now = new Date().toISOString();
  const actor = user.userId;

  if ((payload.action === 'move_stage' || payload.action === 'reroute') && !payload.stage) throw new LocalControlPlaneError(400, 'INVALID_STAGE_MOVE_REQUEST', payload.action === 'reroute' ? 'Target stage is required when rerouting an agent.' : 'Stage is required when moving an agent between orchestration lanes.');
  if ((payload.action === 'move_stage' || payload.action === 'reroute') && payload.stage && !canMoveToStage({ currentStage: agent.orchestration.stage, dependencyState: agent.orchestration.dependencyState }, payload.stage)) throw new LocalControlPlaneError(409, 'INVALID_STAGE_TRANSITION', getInvalidTransitionMessage({ currentStage: agent.orchestration.stage, dependencyState: agent.orchestration.dependencyState }, payload.stage));
  if (payload.action === 'retry_queue' && (agent.orchestration.dependencyState === 'blocked' || agent.orchestration.blockers.length)) throw new LocalControlPlaneError(409, 'AGENT_BLOCKED', 'Blocked agents must be unblocked before retrying the queue.');

  if (payload.action === 'pause') { agent.state = 'paused'; agent.logs.unshift({ id: `log_${Date.now()}`, level: 'warn', source: 'control-dashboard', message: `Agent paused by ${actor}.`, timestamp: now }); }
  if (payload.action === 'restart') { agent.state = 'running'; agent.lastHeartbeatAt = now; agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `Agent restart requested by ${actor}.`, timestamp: now }); agent.executionHistory.unshift({ id: `run_${Date.now()}`, workflowVersion: agent.workflowVersion, status: 'running', startedAt: now, endedAt: now, costUsd: 0, outputSummary: 'Restart initiated from control dashboard.' }); }
  if (payload.action === 'update_budget') { agent.budgetUsd = payload.budgetUsd ?? agent.budgetUsd; agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `Budget updated to $${agent.budgetUsd} by ${actor}.`, timestamp: now }); }
  if (payload.action === 'update_workflow') { agent.workflowVersion = payload.workflowVersion ?? agent.workflowVersion; agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `Workflow changed to ${agent.workflowVersion} by ${actor}.`, timestamp: now }); }
  if (payload.action === 'move_stage' || payload.action === 'reroute') { agent.orchestration.stage = payload.stage ?? agent.orchestration.stage; if (payload.lane) agent.orchestration.lane = payload.lane; agent.orchestration.stageEnteredAt = now; agent.orchestration.dependencyState = getNextDependencyState(agent.orchestration.stage, agent.orchestration.blockers.length); agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `${payload.action === 'reroute' ? 'Agent rerouted' : 'Stage moved'} to ${agent.orchestration.stage} by ${actor}.`, timestamp: now }); }
  if (payload.action === 'retry_queue') { agent.state = 'running'; agent.lastHeartbeatAt = now; agent.queueDepth = Math.max(agent.queueDepth, 1); agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `Queue retry requested by ${actor}.`, timestamp: now }); agent.executionHistory.unshift({ id: `run_${Date.now()}`, workflowVersion: agent.workflowVersion, status: 'running', startedAt: now, endedAt: now, costUsd: 0, outputSummary: 'Queue retry initiated from orchestration board.' }); }
  if (payload.action === 'unblock') { agent.orchestration.blockers = []; agent.orchestration.dependencyState = getNextDependencyState(agent.orchestration.stage, 0); agent.logs.unshift({ id: `log_${Date.now()}`, level: 'info', source: 'control-dashboard', message: `Blockers cleared by ${actor}.`, timestamp: now }); }

  const audit: AuditRecord = { id: `audit_${state.auditLogs.length + 1}`, actor, actorDisplay: user.name, action: payload.action, resourceType: 'agent', resourceId: agentId, timestamp: now, summary: buildAgentActionSummary(payload.action, { stage: payload.stage, lane: payload.lane }) };
  audit.tenantId = agent.tenantId;
  audit.appId = agent.appId;
  state.auditLogs.unshift(audit);
  const eventSummary = audit.summary ?? buildAgentActionSummary(payload.action, { stage: payload.stage, lane: payload.lane });
  await publishDashboardDomainEvent(
    {
      type: 'agent_action_requested',
      tenantId: agent.tenantId,
      appId: agent.appId,
      actor,
      actorDisplay: user.name,
      source: 'next_local_control_plane',
      resourceType: 'agent',
      resourceId: agentId,
      summary: eventSummary,
      timestamp: now,
      metadata: { action: payload.action, stage: payload.stage, lane: payload.lane, queueDepth: agent.queueDepth },
    },
    { localSink: (event) => { state.events.unshift(event); } },
  );
  await store.persist();
  return { agent: structuredClone(agent), audit: structuredClone(audit) };
}

export async function switchLocalModel(user: SessionUser, payload: ModelSwitchInput) {
  const store = await getStore();
  const state = store.getState();
  const model = state.models.find((item) => item.key === payload.key);
  if (!model) throw new LocalControlPlaneError(404, 'MODEL_NOT_FOUND', `No model found for ${payload.key}.`);
  model.activeModel = payload.targetModel;
  const audit: AuditRecord = { id: `audit_${state.auditLogs.length + 1}`, actor: user.userId, actorDisplay: user.name, action: 'switch_model', resourceType: 'model', resourceId: payload.key, timestamp: new Date().toISOString(), summary: `Switched model to ${payload.targetModel}` };
  audit.tenantId = user.tenantId;
  audit.appId = user.appId;
  state.auditLogs.unshift(audit);
  const eventSummary = audit.summary ?? `Switched model to ${payload.targetModel}`;
  await publishDashboardDomainEvent(
    {
      type: 'model_switched',
      tenantId: user.tenantId,
      appId: user.appId,
      actor: user.userId,
      actorDisplay: user.name,
      source: 'next_local_control_plane',
      resourceType: 'model',
      resourceId: payload.key,
      summary: eventSummary,
      timestamp: audit.timestamp,
      metadata: { targetModel: payload.targetModel },
    },
    { localSink: (event) => { state.events.unshift(event); } },
  );
  await store.persist();
  return { model: structuredClone(model), audit: structuredClone(audit) };
}

export async function listLocalControlPlaneAuditLogs(user: SessionUser) {
  const store = await getStore();
  const scopeFilters = getScopeFilters(user);
  return structuredClone(
    store
      .getState()
      .auditLogs.filter(
        (item) =>
          (!scopeFilters.tenantId || !item.tenantId || item.tenantId === scopeFilters.tenantId) &&
          (!scopeFilters.appId || !item.appId || item.appId === scopeFilters.appId),
      ),
  );
}