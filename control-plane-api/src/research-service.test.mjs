import { describe, expect, it } from 'vitest';

import { createEmbeddingsService } from './embeddings-service.mjs';
import { createResearchService } from './research-service.mjs';
import { createControlPlaneStore } from './store.mjs';

const adminContext = {
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

function createState() {
  return {
    documents: [],
    embeddings: [],
    memory: [],
    events: [
      {
        id: 'event_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        type: 'agent_triggered',
        actor: 'Control Agent',
        summary: 'Demand monitor dispatched a fresh review.',
        timestamp: '2026-03-09T09:00:00.000Z',
      },
    ],
    usagePatterns: [
      {
        id: 'usage_1',
        tenantId: 'tenant_acme',
        appId: 'app_market_web',
        scope: 'operator',
        signalKey: 'domain_event',
        signalValue: 'agent_triggered',
        sampleCount: 4,
        metadata: {},
        windowStartedAt: '2026-03-09T00:00:00.000Z',
        windowEndedAt: '2026-03-09T09:00:00.000Z',
        createdAt: '2026-03-09T09:00:00.000Z',
      },
    ],
    auditLogs: [],
    researchRuns: [],
    researchSchedules: [],
  };
}

describe('research service', () => {
  it('collects platform activity and persists documents, embeddings, and events', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const embeddingsService = createEmbeddingsService({ store, config: {} });
    const researchService = createResearchService({ store, embeddingsService });

    const response = await researchService.collect({
      source: 'platform_activity',
      query: 'agent backlog',
      limit: 2,
      persist: true,
      metadata: { channel: 'test' },
    }, adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(response.item.status).toBe('completed');
    expect(response.item.documentsCreated).toBeGreaterThan(0);
    expect(state.documents.length).toBeGreaterThan(0);
    expect(state.embeddings.length).toBeGreaterThan(0);
    expect(state.researchRuns).toHaveLength(1);
    expect(state.events[0]?.type).toBe('research_collected');
  });

  it('creates schedules and runs due schedules into research runs', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const embeddingsService = createEmbeddingsService({ store, config: {} });
    const researchService = createResearchService({ store, embeddingsService });

    const scheduled = await researchService.createSchedule({
      name: 'Semiconductor market scan',
      source: 'market_api',
      query: 'NVDA AMD',
      intervalMinutes: 30,
      limit: 2,
      persist: true,
      status: 'active',
      metadata: { cadence: 'test' },
    }, adminContext);

    await store.saveResearchSchedule({
      ...scheduled.item,
      nextRunAt: '2026-03-08T00:00:00.000Z',
      updatedAt: '2026-03-08T00:00:00.000Z',
    }, 'research_schedule_run', adminContext.userId);

    const due = await researchService.runDueSchedules(adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(due.items).toHaveLength(1);
    expect(due.items[0]?.source).toBe('market_api');
    expect(state.researchRuns).toHaveLength(1);
    expect(store.listResearchSchedules({ tenantId: 'tenant_acme', appId: 'app_market_web' })[0]?.lastRunAt).toBeTruthy();
  });
});