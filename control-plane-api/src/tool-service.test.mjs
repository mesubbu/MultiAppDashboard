import { describe, expect, it } from 'vitest';

import { createControlPlaneStore } from './store.mjs';
import { createToolService } from './tool-service.mjs';

const ownerContext = {
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  userId: 'usr_platform_owner',
  roles: ['platform_owner'],
};

describe('tool service', () => {
  it('lists the runtime tool registry with telemetry', async () => {
    const service = createToolService({ store: createControlPlaneStore() });

    const tools = await service.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'database.query.records',
      'statistics.calculate.summary',
      'market.lookup.price',
      'analysis.summarize.signals',
    ]);
    expect(tools[0]).toEqual(expect.objectContaining({ description: expect.any(String), executionMode: expect.any(String), safetyGuards: expect.any(Array) }));
  });

  it('executes safe tools and records execution logs', async () => {
    const store = createControlPlaneStore();
    const service = createToolService({ store });

    const response = await service.executeTool({ tool: 'statistics.calculate.summary', input: { values: [4, 9, 15, 16, 23, 42], label: 'queue_depth' } }, ownerContext, {
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
    });

    expect(response.item.status).toBe('completed');
    expect(response.result?.payload.mean).toBe(18.1667);
    expect(store.listToolExecutions({ tool: 'statistics.calculate.summary' })).toEqual([
      expect.objectContaining({ status: 'completed', tool: 'statistics.calculate.summary' }),
    ]);
  });

  it('blocks executions when the caller lacks the required permission', async () => {
    const service = createToolService({ store: createControlPlaneStore() });

    const response = await service.executeTool({ tool: 'market.lookup.price', input: { category: 'Farm Equipment', location: 'Mumbai' } }, {
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      userId: 'usr_viewer',
      roles: ['viewer'],
    }, {
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
    });

    expect(response.item.status).toBe('blocked');
    expect(response.item.errorMessage).toContain('graph:read');
    expect(response.result).toBeNull();
  });
});