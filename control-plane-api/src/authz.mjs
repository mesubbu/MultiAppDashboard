const rolePermissions = {
  platform_owner: [
    'tenants:read',
    'tenants:write',
    'apps:read',
    'apps:write',
    'users:read',
    'users:write',
    'agents:read',
    'agents:operate',
    'tools:read',
    'models:read',
    'models:switch',
    'research:read',
    'research:operate',
    'memory:read',
    'graph:read',
    'events:read',
    'analytics:read',
    'observability:read',
    'audit:read',
    'system:write',
  ],
  platform_admin: [
    'tenants:read',
    'apps:read',
    'apps:write',
    'users:read',
    'agents:read',
    'agents:operate',
    'tools:read',
    'models:read',
    'models:switch',
    'research:read',
    'research:operate',
    'memory:read',
    'graph:read',
    'events:read',
    'analytics:read',
    'observability:read',
    'audit:read',
  ],
  tenant_admin: ['tenants:read', 'apps:read', 'apps:write', 'users:read', 'users:write', 'agents:read', 'research:read', 'research:operate', 'events:read', 'audit:read'],
  ops_admin: ['agents:read', 'agents:operate', 'research:read', 'research:operate', 'events:read', 'observability:read', 'models:read', 'audit:read'],
  analyst: ['analytics:read', 'events:read', 'graph:read', 'memory:read', 'models:read', 'research:read'],
  viewer: ['tenants:read', 'apps:read', 'users:read', 'agents:read', 'tools:read', 'events:read'],
};

export function parseAdminRoles(rolesHeader) {
  return rolesHeader
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

export function hasPermission(roles, permission) {
  return roles.some((role) => rolePermissions[role]?.includes(permission));
}

export function assertPermission(roles, permission) {
  if (!hasPermission(roles, permission)) {
    throw new Error(`FORBIDDEN:${permission}`);
  }
}