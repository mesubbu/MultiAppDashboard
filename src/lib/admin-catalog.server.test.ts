import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  AdminCatalogError,
  createCatalogApp,
  createCatalogUser,
  listCatalogApps,
  listCatalogTenantsPage,
  listCatalogUsersPage,
  resetAdminCatalogStateForTests,
} from '@/lib/admin-catalog.server';
import { listLocalControlPlaneEvents, resetLocalControlPlaneStateForTests } from '@/lib/control-plane-state.server';
import { resetDashboardEnvForTests } from '@/lib/env';
import type { SessionUser } from '@/types/platform';

const platformOwner: SessionUser = {
  userId: 'usr_platform_owner',
  tenantId: 'platform-root',
  appId: 'control-dashboard',
  name: 'Platform Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

const tenantAdmin: SessionUser = {
  userId: 'usr_tenant_admin',
  tenantId: 'tenant_nova',
  appId: 'app_admin',
  name: 'Tenant Admin',
  email: 'tenant-admin@test.local',
  roles: ['tenant_admin'],
};

describe('admin catalog repository', () => {
  beforeEach(async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    delete process.env.ADMIN_CATALOG_STATE_FILE;
    resetDashboardEnvForTests();
    await resetAdminCatalogStateForTests();
    await resetLocalControlPlaneStateForTests();
  });

  it('persists created apps when ADMIN_CATALOG_STATE_FILE is configured', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'dashboard-admin-catalog-'));

    try {
      process.env.ADMIN_CATALOG_STATE_FILE = join(tempDir, 'catalog.json');
      resetDashboardEnvForTests();
      await resetAdminCatalogStateForTests();

      const created = await createCatalogApp(platformOwner, {
        tenantId: 'tenant_acme',
        name: 'Acme Ops Console',
        runtime: 'admin',
        environment: 'staging',
        status: 'healthy',
        region: 'us-east-1',
        agentsAttached: 0,
      });

      await resetAdminCatalogStateForTests({ preservePersistedState: true });
      resetDashboardEnvForTests();

      const apps = await listCatalogApps(platformOwner);
      expect(apps.some((app) => app.id === created.id)).toBe(true);
    } finally {
      await resetAdminCatalogStateForTests();
      resetDashboardEnvForTests();
      delete process.env.ADMIN_CATALOG_STATE_FILE;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('prevents tenant admins from assigning platform-level roles', async () => {
    await expect(
      createCatalogUser(tenantAdmin, {
        tenantId: 'tenant_nova',
        appId: 'app_admin',
        name: 'Escalation Attempt',
        role: 'platform_admin',
        status: 'invited',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ROLE', statusCode: 403 } satisfies Partial<AdminCatalogError>);
  });

  it('filters and paginates catalog lists on the server side', async () => {
    const tenantPage = await listCatalogTenantsPage(platformOwner, {
      page: 1,
      pageSize: 1,
      query: 'nova',
      status: 'degraded',
    });
    expect(tenantPage.items).toHaveLength(1);
    expect(tenantPage.items[0]?.id).toBe('tenant_nova');
    expect(tenantPage.pageInfo.totalItems).toBe(1);

    const userPage = await listCatalogUsersPage(platformOwner, {
      page: 1,
      pageSize: 1,
      query: 'anaya',
      status: 'active',
      role: 'tenant_admin',
    });
    expect(userPage.items).toHaveLength(1);
    expect(userPage.items[0]?.role).toBe('tenant_admin');
    expect(userPage.pageInfo.totalPages).toBe(1);
  });

  it('publishes catalog mutation events into the local control-plane stream', async () => {
    const app = await createCatalogApp(platformOwner, {
      tenantId: 'tenant_acme',
      name: 'Acme Insights',
      runtime: 'admin',
      environment: 'staging',
      status: 'healthy',
      region: 'us-east-1',
      agentsAttached: 0,
    });

    const events = await listLocalControlPlaneEvents(platformOwner, { eventType: 'app_created' });
    expect(events[0]).toMatchObject({ type: 'app_created', tenantId: 'tenant_acme', appId: app.id });
  });
});