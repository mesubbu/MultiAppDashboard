import { describe, expect, it } from 'vitest';

import { canAccessModule, hasPermission } from '@/lib/rbac';
import { dashboardModules } from '@/modules/dashboard/catalog';

describe('rbac helpers', () => {
  it('grants system permissions to platform owners', () => {
    expect(hasPermission(['platform_owner'], 'system:write')).toBe(true);
  });

  it('restricts settings module for viewers', () => {
    const settingsModule = dashboardModules.find((module) => module.slug === 'settings');
    expect(settingsModule).toBeDefined();
    expect(canAccessModule(['viewer'], settingsModule!)).toBe(false);
  });

  it('allows tenant admins to manage apps but not tenants', () => {
    expect(hasPermission(['tenant_admin'], 'apps:write')).toBe(true);
    expect(hasPermission(['tenant_admin'], 'tenants:write')).toBe(false);
  });
});
