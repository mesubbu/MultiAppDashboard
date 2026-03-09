import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import type { AuthorizedAdminContext } from '@/app/api/admin/_helpers';
import { resetCircuitBreakersForTests } from '@/lib/circuit-breaker';
import { resetDashboardEnvForTests } from '@/lib/env';
import type { SessionUser } from '@/types/platform';

const responseSchema = z.object({ ok: z.boolean() });
const sessionUser: SessionUser = {
  userId: 'usr_platform_owner',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Platform Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

function createContext(): AuthorizedAdminContext {
  const now = Date.now();
  return {
    params: Promise.resolve({}),
    scope: { tenantId: sessionUser.tenantId, appId: sessionUser.appId },
    session: {
      sessionId: 'session_test_platform_owner',
      user: sessionUser,
      issuedAt: now,
      expiresAt: now + 60_000,
      rotatedAt: now,
    },
  } as unknown as AuthorizedAdminContext;
}

describe('proxyCatalogRequest circuit breaker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    process.env.CONTROL_PLANE_API_BASE_URL = 'https://control-plane.example.com';
    process.env.CONTROL_PLANE_API_TOKEN = 'test-token';
    resetDashboardEnvForTests();
    resetCircuitBreakersForTests();
  });

  it('opens after repeated upstream failures and then fails fast', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'UPSTREAM_DOWN', message: 'Unavailable' } }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
      expect(response?.status).toBe(502);
    }

    const response = await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'CONTROL_PLANE_CIRCUIT_OPEN' },
    });
    expect(response?.headers.get('retry-after')).toBeTruthy();
  });

  it('does not trip for upstream authorization failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Denied' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const first = await proxyCatalogRequest('/admin/system', createContext(), { responseSchema });
    const second = await proxyCatalogRequest('/admin/system', createContext(), { responseSchema });

    expect(first?.status).toBe(403);
    expect(second?.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows requests again after the cooldown window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T00:00:00.000Z'));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'DOWN', message: 'Unavailable' } }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'DOWN', message: 'Unavailable' } }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'DOWN', message: 'Unavailable' } }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
    await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
    await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });

    const blocked = await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
    expect(blocked?.status).toBe(503);

    vi.setSystemTime(new Date('2026-03-09T00:00:31.000Z'));
    const recovered = await proxyCatalogRequest('/admin/overview', createContext(), { responseSchema });
    expect(recovered?.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

