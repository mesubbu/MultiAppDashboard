import type { DashboardModuleDefinition, Permission, PlatformRole } from '@/types/platform';

const rolePermissions: Record<PlatformRole, Permission[]> = {
  platform_owner: [
    'tenants:read',
    'tenants:write',
    'apps:read',
    'users:read',
    'users:write',
    'agents:read',
    'agents:operate',
    'tools:read',
    'models:read',
    'models:switch',
    'memory:read',
    'graph:read',
    'events:read',
    'analytics:read',
    'observability:read',
    'system:write',
  ],
  platform_admin: [
    'tenants:read',
    'apps:read',
    'users:read',
    'agents:read',
    'agents:operate',
    'tools:read',
    'models:read',
    'models:switch',
    'memory:read',
    'graph:read',
    'events:read',
    'analytics:read',
    'observability:read',
  ],
  tenant_admin: ['tenants:read', 'apps:read', 'users:read', 'users:write', 'agents:read', 'events:read'],
  ops_admin: ['agents:read', 'agents:operate', 'events:read', 'observability:read', 'models:read'],
  analyst: ['analytics:read', 'events:read', 'graph:read', 'memory:read', 'models:read'],
  viewer: ['tenants:read', 'apps:read', 'users:read', 'agents:read', 'tools:read', 'events:read'],
};

const modulePermissionMap: Record<string, Permission> = {
  overview: 'analytics:read',
  tenants: 'tenants:read',
  apps: 'apps:read',
  users: 'users:read',
  agents: 'agents:read',
  tools: 'tools:read',
  models: 'models:read',
  memory: 'memory:read',
  'knowledge-graph': 'graph:read',
  events: 'events:read',
  analytics: 'analytics:read',
  observability: 'observability:read',
  settings: 'system:write',
};

export function permissionsForRoles(roles: PlatformRole[]) {
  return Array.from(new Set(roles.flatMap((role) => rolePermissions[role] ?? [])));
}

export function hasPermission(roles: PlatformRole[], permission: Permission) {
  return permissionsForRoles(roles).includes(permission);
}

export function canAccessModule(roles: PlatformRole[], module: DashboardModuleDefinition) {
  const requiredPermission = modulePermissionMap[module.slug];
  return requiredPermission ? hasPermission(roles, requiredPermission) : true;
}
