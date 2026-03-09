import { describe, expect, it, vi } from 'vitest';

import { createControlPlaneAiService } from './control-plane-ai.mjs';

const adminContext = { tenantId: 'tenant_nova', appId: 'app_admin', userId: 'usr_platform_owner', roles: ['platform_owner'] };

describe('control plane ai service', () => {
  it('routes read-style commands through the reasoning engine', async () => {
    const service = createControlPlaneAiService({
      store: { listAgents: vi.fn(async () => [{ id: 'agent_finance_03', tenantId: 'tenant_nova', appId: 'app_admin', name: 'Finance Copilot' }]) },
      reasoningEngine: { execute: vi.fn(async () => ({ message: { content: 'Summary for service health', toolCalls: [{ tool: 'control.read.observability', permission: 'observability:read', status: 'completed', summary: 'Reviewed services.' }] }, suggestions: ['Compare restart alerts'], intent: 'observability' })) },
      recommendationAgentService: {}, insightAgentService: {}, researchAgentService: {}, feedbackLoopService: {},
    });

    const response = await service.execute({ message: 'Summarize service health', history: [], pathname: '/observability' }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });
    expect(response.command.intent).toBe('summarize_system_health');
    expect(response.toolCalls[0]?.tool).toBe('control.read.observability');
  });

  it('runs recommendation-agent commands for operators with permission', async () => {
    const service = createControlPlaneAiService({
      store: { listAgents: vi.fn(async () => [{ id: 'agent_finance_03', tenantId: 'tenant_nova', appId: 'app_admin', name: 'Finance Copilot' }]) },
      reasoningEngine: { execute: vi.fn() },
      recommendationAgentService: { execute: vi.fn(async () => ({ item: { id: 'recommendation_run_1' }, recommendations: [{ title: 'Act on premium inventory' }], })) },
      insightAgentService: {}, researchAgentService: {}, feedbackLoopService: {},
    });

    const response = await service.execute({ message: 'Run recommendation agent for Finance Copilot', history: [], pathname: '/agents' }, adminContext, { tenantId: 'tenant_nova', appId: 'app_admin' });
    expect(response.command.executedActions).toContain('control.run.recommendation-agent');
    expect(response.content).toContain('Finance Copilot');
  });
});