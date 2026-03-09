import { beforeEach, describe, expect, it } from 'vitest';
import { NextResponse } from 'next/server';

import { protectedAdminRoutes } from '@/app/api/admin/permissions';
import { withPermission } from '@/app/api/admin/_helpers';
import { createSession, resetAuthStateForTests, SESSION_COOKIE } from '@/lib/auth';
import { resetDashboardEnvForTests } from '@/lib/env';
import { hasPermission } from '@/lib/rbac';
import type { PlatformRole, SessionUser } from '@/types/platform';

const testUsers: Record<PlatformRole, SessionUser> = {
  platform_owner: {
    userId: 'owner',
    tenantId: 'platform-root',
    appId: 'control-dashboard',
    name: 'Owner',
    email: 'owner@test.local',
    roles: ['platform_owner'],
  },
  platform_admin: {
    userId: 'platform-admin',
    tenantId: 'platform-root',
    appId: 'control-dashboard',
    name: 'Platform Admin',
    email: 'platform-admin@test.local',
    roles: ['platform_admin'],
  },
  tenant_admin: {
    userId: 'tenant-admin',
    tenantId: 'tenant_nova',
    appId: 'app_admin',
    name: 'Tenant Admin',
    email: 'tenant-admin@test.local',
    roles: ['tenant_admin'],
  },
  ops_admin: {
    userId: 'ops-admin',
    tenantId: 'platform-root',
    appId: 'control-dashboard',
    name: 'Ops Admin',
    email: 'ops-admin@test.local',
    roles: ['ops_admin'],
  },
  analyst: {
    userId: 'analyst',
    tenantId: 'tenant_nova',
    appId: 'app_admin',
    name: 'Analyst',
    email: 'analyst@test.local',
    roles: ['analyst'],
  },
  viewer: {
    userId: 'viewer',
    tenantId: 'tenant_acme',
    appId: 'app_market_web',
    name: 'Viewer',
    email: 'viewer@test.local',
    roles: ['viewer'],
  },
};

function createRequest(token?: string, url = 'https://dashboard.local/api/admin/test') {
  return {
    cookies: {
      get(name: string) {
        return name === SESSION_COOKIE && token ? { value: token } : undefined;
      },
    },
    nextUrl: new URL(url),
  } as never;
}

describe('admin route permission wrapper', () => {
  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    resetDashboardEnvForTests();
    await resetAuthStateForTests();
  });

  it('returns 401 when authentication is missing', async () => {
    const handler = withPermission(protectedAdminRoutes[0].permission, async () =>
      NextResponse.json({ ok: true }),
    );

    const response = await handler(createRequest(), { params: Promise.resolve({}) });
    expect(response.status).toBe(401);
  });

  it('enforces every protected route permission for every platform role', async () => {
    for (const role of Object.keys(testUsers) as PlatformRole[]) {
      const { token } = await createSession(testUsers[role]);

      for (const route of protectedAdminRoutes) {
        const handler = withPermission(route.permission, async () =>
          NextResponse.json({ ok: true, route: route.path }),
        );

        const response = await handler(createRequest(token), { params: Promise.resolve({}) });
        expect(response.status, `${role} -> ${route.path}`).toBe(
          hasPermission([role], route.permission) ? 200 : 403,
        );
      }

      await resetAuthStateForTests();
    }
  });

  it('resolves request scope from query params for privileged users', async () => {
    const { token } = await createSession(testUsers.platform_owner);
    const handler = withPermission(protectedAdminRoutes[0].permission, async (_request, context) =>
      NextResponse.json({ scope: context.scope }),
    );

    const response = await handler(
      createRequest(token, 'https://dashboard.local/api/admin/overview?tenant_id=tenant_acme&app_id=app_vendor_flutter'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scope: { tenantId: 'tenant_acme', appId: 'app_vendor_flutter' },
    });
  });

  it('clamps request scope back to the signed-in tenant when the query is out of scope', async () => {
    const { token } = await createSession(testUsers.tenant_admin);
    const handler = withPermission('tenants:read', async (_request, context) =>
      NextResponse.json({ scope: context.scope }),
    );

    const response = await handler(
      createRequest(token, 'https://dashboard.local/api/admin/overview?tenant_id=tenant_acme&app_id=app_vendor_flutter'),
      { params: Promise.resolve({}) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scope: { tenantId: 'tenant_nova', appId: 'app_admin' },
    });
  });
});