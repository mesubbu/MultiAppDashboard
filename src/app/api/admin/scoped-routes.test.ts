import { beforeEach, describe, expect, it } from 'vitest';

import { GET as getKnowledgeGraph } from '@/app/api/admin/knowledge-graph/route';
import { GET as getMemory } from '@/app/api/admin/memory/route';
import { GET as getObservability } from '@/app/api/admin/observability/route';
import { GET as getOverview } from '@/app/api/admin/overview/route';
import { createSession, resetAuthStateForTests, SESSION_COOKIE } from '@/lib/auth';
import { recordRecentClientError } from '@/lib/client-error-store.server';
import { resetDashboardEnvForTests } from '@/lib/env';
import type { SessionUser } from '@/types/platform';

const platformOwner: SessionUser = {
  userId: 'owner',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

function createRequest(token: string, url: string) {
  return {
    cookies: {
      get(name: string) {
        return name === SESSION_COOKIE ? { value: token } : undefined;
      },
    },
    nextUrl: new URL(url),
  } as never;
}

describe('scoped admin routes', () => {
  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.CONTROL_PLANE_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
    resetDashboardEnvForTests();
    await resetAuthStateForTests();
  });

  it('scopes overview responses to the requested tenant/app context', async () => {
    const { token } = await createSession(platformOwner);
    const response = await getOverview(
      createRequest(token, 'https://dashboard.local/api/admin/overview?tenant_id=tenant_nova&app_id=app_admin'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.runningAgents).toBe(0);
    expect(body.queueBacklog).toBe(8);
    expect(body.metrics[0]?.value).toBe('1');
  });

  it('filters memory responses to the resolved admin scope', async () => {
    const { token } = await createSession(platformOwner);
    const response = await getMemory(
      createRequest(token, 'https://dashboard.local/api/admin/memory?tenant_id=tenant_nova&app_id=app_admin'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [
        {
          id: 'mem_app_nova',
          scope: 'app',
          tenantId: 'tenant_nova',
          appId: 'app_admin',
          records: 3820,
          vectorCount: 11130,
          lastCompactionAt: '2026-03-08T08:20:00.000Z',
        },
      ],
    });
  });

  it('supports path queries for scoped knowledge graph responses', async () => {
    const { token } = await createSession(platformOwner);
    const response = await getKnowledgeGraph(
      createRequest(
        token,
        'https://dashboard.local/api/admin/knowledge-graph?tenant_id=tenant_acme&app_id=app_market_web&path_from=user:anaya&path_to=location:mumbai',
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nodes.map((node: { id: string }) => node.id)).toEqual([
      'user:anaya',
      'listing:tractor301',
      'location:mumbai',
    ]);
    expect(body.edges.map((edge: { id: string }) => edge.id)).toEqual(['edge-3', 'edge-6']);
  });

  it('supports depth-limited subgraph extraction for scoped knowledge graph responses', async () => {
    const { token } = await createSession(platformOwner);
    const response = await getKnowledgeGraph(
      createRequest(
        token,
        'https://dashboard.local/api/admin/knowledge-graph?tenant_id=tenant_acme&app_id=app_market_web&center_id=agent:growth&depth=1',
      ),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.nodes.map((node: { id: string }) => node.id)).toEqual([
      'category:farm',
      'agent:growth',
      'skill:analytics',
    ]);
    expect(body.edges.map((edge: { id: string }) => edge.id)).toEqual(['edge-4', 'edge-5']);
  });

  it('scopes observability client errors to the resolved tenant/app context', async () => {
    const { token } = await createSession(platformOwner);
    recordRecentClientError({
      id: 'client-error-1',
      kind: 'boundary',
      source: 'dashboard-error-boundary',
      message: 'Acme issue',
      name: 'Error',
      pathname: '/acme',
      digest: null,
      occurredAt: '2026-03-08T10:00:00.000Z',
      tenantId: 'tenant_acme',
      appId: 'app_market_web',
      userId: 'owner',
    });
    recordRecentClientError({
      id: 'client-error-2',
      kind: 'window-error',
      source: 'window.onerror',
      message: 'Nova issue',
      name: 'Error',
      pathname: '/nova',
      digest: null,
      occurredAt: '2026-03-08T10:01:00.000Z',
      tenantId: 'tenant_nova',
      appId: 'app_admin',
      userId: 'owner',
    });

    const response = await getObservability(
      createRequest(token, 'https://dashboard.local/api/admin/observability?tenant_id=tenant_acme&app_id=app_market_web'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      clientErrors: [
        {
          id: 'client-error-1',
          tenantId: 'tenant_acme',
          appId: 'app_market_web',
        },
      ],
    });
  });
});