import type { AppRecord, PlatformRole, SessionUser, TenantRecord } from '@/types/platform';

export const PLATFORM_TENANT_ID = 'platform-root';
export const PLATFORM_APP_ID = 'control-dashboard';

export type ScopeFilters = {
  tenantId?: string;
  appId?: string;
};

export type TenantScopeOption = {
  id: string;
  label: string;
  description: string;
  tier?: TenantRecord['tier'];
};

export type AppScopeOption = {
  id: string;
  tenantId: string;
  label: string;
  description: string;
};

const globalTenantOption: TenantScopeOption = {
  id: PLATFORM_TENANT_ID,
  label: 'Platform-wide view',
  description: 'See all tenants and apps across the control plane.',
};

const globalAppOption: AppScopeOption = {
  id: PLATFORM_APP_ID,
  tenantId: PLATFORM_TENANT_ID,
  label: 'All apps',
  description: 'Use the control dashboard global operator context.',
};

function hasAnyRole(roles: PlatformRole[], expected: PlatformRole[]) {
  return expected.some((role) => roles.includes(role));
}

export function canAccessAllTenants(roles: PlatformRole[]) {
  return hasAnyRole(roles, ['platform_owner', 'platform_admin', 'ops_admin']);
}

export function canSwitchAppsWithinTenant(roles: PlatformRole[]) {
  return canAccessAllTenants(roles) || roles.includes('tenant_admin');
}

export function getAccessibleTenants(user: SessionUser, tenants: TenantRecord[]) {
  if (canAccessAllTenants(user.roles)) {
    return [
      globalTenantOption,
      ...tenants.map((tenant) => ({
        id: tenant.id,
        label: tenant.name,
        description: `${tenant.tier} · ${tenant.region}`,
        tier: tenant.tier,
      })),
    ];
  }

  const tenant = tenants.find((item) => item.id === user.tenantId);
  return tenant
    ? [
        {
          id: tenant.id,
          label: tenant.name,
          description: `${tenant.tier} · ${tenant.region}`,
          tier: tenant.tier,
        },
      ]
    : [];
}

export function getAccessibleApps(user: SessionUser, tenantId: string, apps: AppRecord[]) {
  if (tenantId === PLATFORM_TENANT_ID) {
    return [globalAppOption];
  }

  if (canSwitchAppsWithinTenant(user.roles)) {
    return apps
      .filter((app) => app.tenantId === tenantId)
      .map((app) => ({
        id: app.id,
        tenantId: app.tenantId,
        label: app.name,
        description: `${app.runtime} · ${app.environment} · ${app.region}`,
      }));
  }

  return apps
    .filter((app) => app.tenantId === user.tenantId && app.id === user.appId)
    .map((app) => ({
      id: app.id,
      tenantId: app.tenantId,
      label: app.name,
      description: `${app.runtime} · ${app.environment} · ${app.region}`,
    }));
}

export function resolveSessionScope(
  user: SessionUser,
  requested: Partial<Pick<SessionUser, 'tenantId' | 'appId'>>,
  tenants: TenantRecord[],
  apps: AppRecord[],
) {
  const allowedTenantIds = new Set(getAccessibleTenants(user, tenants).map((tenant) => tenant.id));
  const nextTenantId = requested.tenantId && allowedTenantIds.has(requested.tenantId)
    ? requested.tenantId
    : user.tenantId;

  const accessibleApps = getAccessibleApps(user, nextTenantId, apps);
  const requestedAppId = nextTenantId === PLATFORM_TENANT_ID ? PLATFORM_APP_ID : requested.appId;
  const nextAppId = requestedAppId && accessibleApps.some((app) => app.id === requestedAppId)
    ? requestedAppId
    : accessibleApps[0]?.id ?? user.appId;

  if (!accessibleApps.some((app) => app.id === nextAppId)) {
    throw new Error('No application context is available for the requested tenant scope.');
  }

  return { tenantId: nextTenantId, appId: nextAppId };
}

export function getScopeFilters(scope: Pick<SessionUser, 'tenantId' | 'appId'>): ScopeFilters {
  if (scope.tenantId === PLATFORM_TENANT_ID) {
    return {};
  }

  return {
    tenantId: scope.tenantId,
    appId: scope.appId === PLATFORM_APP_ID ? undefined : scope.appId,
  };
}

export function filterScopedItems<T extends { tenantId?: string; appId?: string }>(items: T[], filters: ScopeFilters) {
  return items.filter((item) => {
    if (filters.tenantId && item.tenantId && item.tenantId !== filters.tenantId) {
      return false;
    }

    if (filters.appId && item.appId && item.appId !== filters.appId) {
      return false;
    }

    return true;
  });
}

export function filterScopedTenants(tenants: TenantRecord[], filters: ScopeFilters) {
  return filters.tenantId ? tenants.filter((tenant) => tenant.id === filters.tenantId) : tenants;
}

export function filterScopedApps(apps: AppRecord[], filters: ScopeFilters) {
  return apps.filter((app) => {
    if (filters.tenantId && app.tenantId !== filters.tenantId) {
      return false;
    }

    if (filters.appId && app.id !== filters.appId) {
      return false;
    }

    return true;
  });
}
