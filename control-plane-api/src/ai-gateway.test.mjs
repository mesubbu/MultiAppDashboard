import { afterEach, describe, expect, it } from 'vitest';

import { createAiGateway, resetAiGatewayStateForTests } from './ai-gateway.mjs';

const adminContext = {
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

function createStore(overrides = {}) {
  return {
    getOverview: async () => ({ metrics: [], alerts: [], queueBacklog: 482, runningAgents: 42, healthyServices: 11, liveEventsPerMinute: 146 }),
    getAnalytics: async () => ({ kpis: [], tenantGrowth: [], toolUsageByDomain: [] }),
    listAgents: async () => [],
    listEvents: async () => [],
    getObservability: async () => [],
    listMemory: async () => [],
    listModels: async () => [],
    getKnowledgeGraph: async () => ({ nodes: [], edges: [] }),
    publishDomainEvent: async () => undefined,
    ...overrides,
  };
}

describe('ai gateway', () => {
  afterEach(() => {
    resetAiGatewayStateForTests();
  });

  it('enforces concurrency limits per scope', async () => {
    const releases = [];
    const gateway = createAiGateway({
      store: createStore({
        getOverview: async () => new Promise((resolve) => {
          releases.push(() => resolve({ metrics: [], alerts: [], queueBacklog: 482, runningAgents: 42, healthyServices: 11, liveEventsPerMinute: 146 }));
        }),
      }),
    });

    const first = gateway.analyze({ message: 'Overview', history: [], pathname: '/dashboard' }, adminContext);
    const second = gateway.analyze({ message: 'Overview again', history: [], pathname: '/dashboard' }, adminContext);

    await expect(gateway.analyze({ message: 'Third request', history: [], pathname: '/dashboard' }, adminContext)).rejects.toMatchObject({
      statusCode: 429,
      code: 'AI_GATEWAY_CONCURRENCY_LIMITED',
    });

    releases.forEach((release) => release());
    await Promise.all([first, second]);
  });

  it('enforces the per-minute budget guard', async () => {
    const gateway = createAiGateway({ store: createStore() });

    await expect(gateway.analyze({
      message: 'A'.repeat(200),
      history: Array.from({ length: 20 }, (_, index) => ({
        id: `msg_${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: 'B'.repeat(300),
        createdAt: '2026-03-09T10:00:00.000Z',
        toolCalls: [],
      })),
      pathname: '/analytics',
    }, adminContext)).rejects.toMatchObject({ statusCode: 429, code: 'AI_GATEWAY_BUDGET_EXCEEDED' });
  });
});