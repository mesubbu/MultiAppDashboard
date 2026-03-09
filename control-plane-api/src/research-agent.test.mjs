import { describe, expect, it } from 'vitest';

import { agentsData, eventsData } from './data/platform-data.mjs';
import { createEmbeddingsService } from './embeddings-service.mjs';
import { createResearchAgentService } from './research-agent.mjs';
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
    agents: [structuredClone(agentsData[0])],
    documents: [],
    embeddings: [],
    memory: [],
    events: structuredClone(eventsData),
    usagePatterns: [],
    auditLogs: [],
    researchRuns: [],
    researchSchedules: [],
    researchAgentRuns: [],
    researchAgentTriggers: [],
  };
}

describe('research agent service', () => {
  it('executes agent research and updates task plus execution history', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const embeddingsService = createEmbeddingsService({ store, config: {} });
    const researchService = createResearchService({ store, embeddingsService });
    const researchAgentService = createResearchAgentService({ store, researchService });

    const response = await researchAgentService.execute({
      agentId: 'agent_growth_01',
      source: 'market_api',
      query: 'NVDA AMD',
      limit: 2,
      persist: true,
    }, adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(response.item.status).toBe('completed');
    expect(response.agent.tasks[0]?.title).toContain('Research');
    expect(response.agent.tasks[0]?.status).toBe('completed');
    expect(response.agent.executionHistory[0]?.status).toBe('success');
    expect(state.documents.length).toBeGreaterThan(0);
    expect(state.researchAgentRuns).toHaveLength(1);
  });

  it('creates event and schedule triggers, runs due schedules, and processes matching events', async () => {
    const state = createState();
    const store = createControlPlaneStore({ repository: { getState: () => state, persist: async () => {} } });
    const embeddingsService = createEmbeddingsService({ store, config: {} });
    const researchService = createResearchService({ store, embeddingsService });
    const researchAgentService = createResearchAgentService({ store, researchService });

    const schedule = await researchAgentService.createTrigger({
      agentId: 'agent_growth_01',
      name: 'Hourly market scan',
      triggerType: 'schedule',
      source: 'market_api',
      query: 'corn futures',
      intervalMinutes: 30,
      limit: 1,
      persist: true,
      status: 'active',
      metadata: {},
    }, adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    await store.saveResearchAgentTrigger({
      ...schedule.item,
      nextRunAt: '2026-03-08T00:00:00.000Z',
      updatedAt: '2026-03-08T00:00:00.000Z',
    }, 'research_agent_trigger_run', adminContext.userId);

    const due = await researchAgentService.runDueTriggers(adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });
    expect(due.items).toHaveLength(1);
    expect(due.items[0]?.trigger).toBe('schedule');

    await researchAgentService.createTrigger({
      agentId: 'agent_growth_01',
      name: 'Listing follow-up',
      triggerType: 'event',
      source: 'platform_activity',
      query: 'listing demand follow-up',
      eventTypes: ['listing_created'],
      limit: 1,
      persist: true,
      status: 'active',
      metadata: {},
    }, adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });

    const events = await researchAgentService.processEventTriggers(adminContext, { tenantId: 'tenant_acme', appId: 'app_market_web' });
    expect(events.items.length).toBeGreaterThan(0);
    expect(events.items[0]?.trigger).toBe('event');
    expect(state.researchAgentRuns.length).toBeGreaterThan(1);
  });
});