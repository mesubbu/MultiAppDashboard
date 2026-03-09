import { describe, expect, it } from 'vitest';

import { appsData, tenantsData } from '@/mocks/platform-data';
import {
  canAccessAllTenants,
  getAccessibleApps,
  getAccessibleTenants,
  getScopeFilters,
  PLATFORM_TENANT_ID,
  resolveSessionScope,
} from '@/lib/scope';
import type { SessionUser } from '@/types/platform';

const platformOwner: SessionUser = {
  userId: 'owner',
  tenantId: PLATFORM_TENANT_ID,
  appId: 'control-dashboard',
  name: 'Owner',
  email: 'owner@test.local',
  roles: ['platform_owner'],
};

const tenantAdmin: SessionUser = {
  userId: 'tenant-admin',
  tenantId: 'tenant_nova',
  appId: 'app_admin',
  name: 'Tenant Admin',
  email: 'tenant-admin@test.local',
  roles: ['tenant_admin'],
};

const viewer: SessionUser = {
  userId: 'viewer',
  tenantId: 'tenant_acme',
  appId: 'app_market_web',
  name: 'Viewer',
  email: 'viewer@test.local',
  roles: ['viewer'],
};

describe('scope helpers', () => {
  it('allows privileged roles to access platform-wide and tenant-specific contexts', () => {
    expect(canAccessAllTenants(platformOwner.roles)).toBe(true);
    expect(getAccessibleTenants(platformOwner, tenantsData).map((tenant) => tenant.id)).toContain(
      PLATFORM_TENANT_ID,
    );

    const scope = resolveSessionScope(
      platformOwner,
      { tenantId: 'tenant_acme', appId: 'app_vendor_flutter' },
      tenantsData,
      appsData,
    );

    expect(scope).toEqual({ tenantId: 'tenant_acme', appId: 'app_vendor_flutter' });
  });

  it('allows tenant admins to switch apps inside their tenant but not to another tenant', () => {
    expect(getAccessibleApps(tenantAdmin, tenantAdmin.tenantId, appsData)).toHaveLength(1);

    const scope = resolveSessionScope(
      tenantAdmin,
      { tenantId: 'tenant_acme', appId: 'app_market_web' },
      tenantsData,
      appsData,
    );

    expect(scope.tenantId).toBe('tenant_nova');
    expect(scope.appId).toBe('app_admin');
  });

  it('keeps viewers pinned to their own tenant/app and derives scoped filters', () => {
    const scope = resolveSessionScope(
      viewer,
      { tenantId: 'tenant_nova', appId: 'app_admin' },
      tenantsData,
      appsData,
    );

    expect(scope).toEqual({ tenantId: 'tenant_acme', appId: 'app_market_web' });
    expect(getScopeFilters(viewer)).toEqual({ tenantId: 'tenant_acme', appId: 'app_market_web' });
  });
});