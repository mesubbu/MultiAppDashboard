import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyLocalAgentAction,
  listLocalControlPlaneAgents,
  listLocalControlPlaneEvents,
  listLocalControlPlaneModels,
  LocalControlPlaneError,
  resetLocalControlPlaneStateForTests,
  switchLocalModel,
} from '@/lib/control-plane-state.server';
import { resetDashboardEnvForTests } from '@/lib/env';
import type { SessionUser } from '@/types/platform';

const platformOwner: SessionUser = { userId: 'usr_platform_owner', tenantId: 'platform-root', appId: 'control-dashboard', name: 'Platform Owner', email: 'owner@test.local', roles: ['platform_owner'] };
const tenantScopedUser: SessionUser = { userId: 'usr_tenant_scope', tenantId: 'tenant_nova', appId: 'app_admin', name: 'Tenant Scoped', email: 'tenant@test.local', roles: ['tenant_admin'] };

describe('local control-plane state', () => {
  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.CONTROL_PLANE_STATE_FILE;
    resetDashboardEnvForTests();
    await resetLocalControlPlaneStateForTests();
  });

  it('persists agent actions and model switches when CONTROL_PLANE_STATE_FILE is configured', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'dashboard-control-plane-'));

    try {
      process.env.CONTROL_PLANE_STATE_FILE = join(tempDir, 'control-plane.json');
      resetDashboardEnvForTests();
      await resetLocalControlPlaneStateForTests();

      await applyLocalAgentAction(platformOwner, 'agent_growth_01', { action: 'pause' });
      await switchLocalModel(platformOwner, { key: 'planner', targetModel: 'gpt-4.1-mini' });

      await resetLocalControlPlaneStateForTests({ preservePersistedState: true });
      resetDashboardEnvForTests();

      const agents = await listLocalControlPlaneAgents(platformOwner);
      const models = await listLocalControlPlaneModels();
      expect(agents.find((agent) => agent.id === 'agent_growth_01')?.state).toBe('paused');
      expect(models.find((model) => model.key === 'planner')?.activeModel).toBe('gpt-4.1-mini');
    } finally {
      await resetLocalControlPlaneStateForTests();
      resetDashboardEnvForTests();
      delete process.env.CONTROL_PLANE_STATE_FILE;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('rejects out-of-scope agent operations for tenant-scoped users', async () => {
    await expect(applyLocalAgentAction(tenantScopedUser, 'agent_growth_01', { action: 'pause' })).rejects.toMatchObject({ code: 'AGENT_NOT_FOUND', statusCode: 404 } satisfies Partial<LocalControlPlaneError>);
  });

  it('filters local events by scope and event type', async () => {
    const ownerEvents = await listLocalControlPlaneEvents(platformOwner, {
      tenantId: 'tenant_acme',
      eventType: 'agent_triggered',
    });
    const tenantEvents = await listLocalControlPlaneEvents(tenantScopedUser);

    expect(ownerEvents).toHaveLength(1);
    expect(ownerEvents[0].tenantId).toBe('tenant_acme');
    expect(ownerEvents[0].type).toBe('agent_triggered');
    expect(tenantEvents.every((event) => event.tenantId === 'tenant_nova')).toBe(true);
  });

  it('publishes agent and model domain events into the local stream', async () => {
    await applyLocalAgentAction(platformOwner, 'agent_growth_01', { action: 'pause' });
    await switchLocalModel(platformOwner, { key: 'planner', targetModel: 'gpt-4.1-mini' });

    const agentEvents = await listLocalControlPlaneEvents(platformOwner, { eventType: 'agent_action_requested' });
    const modelEvents = await listLocalControlPlaneEvents(platformOwner, { eventType: 'model_switched' });

    expect(agentEvents[0]).toMatchObject({ type: 'agent_action_requested', appId: 'app_market_web' });
    expect(modelEvents[0]).toMatchObject({ type: 'model_switched', appId: 'control-dashboard' });
  });
});