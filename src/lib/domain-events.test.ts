import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAgentWorkflowSubscriber,
  createAnalyticsSubscriber,
  publishDashboardDomainEvent,
} from '@/lib/domain-events';
import { resetDashboardEnvForTests } from '@/lib/env';

describe('domain event publisher', () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    resetDashboardEnvForTests();
  });

  it('emits local platform events and analytics subscribers in non-db mode', async () => {
    const localSink = vi.fn();
    const analyticsSink = vi.fn();
    const agentSink = vi.fn();

    await publishDashboardDomainEvent(
      {
        type: 'app_created',
        tenantId: 'tenant_acme',
        appId: 'app_test',
        actor: 'usr_platform_owner',
        actorDisplay: 'Platform Owner',
        source: 'test_suite',
        resourceType: 'app',
        resourceId: 'app_test',
        summary: 'Created app Acme Insights',
        metadata: { environment: 'staging' },
      },
      {
        localSink,
        subscribers: [
          createAnalyticsSubscriber(analyticsSink),
          createAgentWorkflowSubscriber(agentSink),
        ],
      },
    );

    expect(localSink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'app_created', tenantId: 'tenant_acme', appId: 'app_test' }),
      expect.objectContaining({ source: 'test_suite', resourceId: 'app_test' }),
    );
    expect(analyticsSink).toHaveBeenCalledTimes(1);
    expect(agentSink).not.toHaveBeenCalled();
  });

  it('filters agent workflow subscribers to agent action events', async () => {
    const agentSink = vi.fn();

    await publishDashboardDomainEvent(
      {
        type: 'agent_action_requested',
        tenantId: 'tenant_acme',
        appId: 'app_ops',
        actor: 'usr_platform_owner',
        source: 'test_suite',
        resourceType: 'agent',
        resourceId: 'agent_growth_01',
        summary: 'Paused agent',
        metadata: { action: 'pause' },
      },
      {
        localSink: vi.fn(),
        subscribers: [createAgentWorkflowSubscriber(agentSink)],
      },
    );

    expect(agentSink).toHaveBeenCalledTimes(1);
    expect(agentSink).toHaveBeenCalledWith(expect.objectContaining({ type: 'agent_action_requested', resourceId: 'agent_growth_01' }));
  });
});