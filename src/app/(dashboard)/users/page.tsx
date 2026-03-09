import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { UserManager } from '@/components/dashboard/UserManager';
import { parseUserListQuery } from '@/lib/catalog-list-query';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';
import type { PlatformRole } from '@/types/platform';

function getAssignableRoles(roles: PlatformRole[]) {
  if (roles.includes('platform_owner')) {
    return ['platform_admin', 'tenant_admin', 'ops_admin', 'analyst', 'viewer'] satisfies PlatformRole[];
  }

  if (roles.includes('tenant_admin')) {
    return ['tenant_admin', 'analyst', 'viewer'] satisfies PlatformRole[];
  }

  return ['viewer'] satisfies PlatformRole[];
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCurrentSession();
  const listQuery = parseUserListQuery(await searchParams);
  const [users, userPage, apps, tenants] = await Promise.all([
    controlPlaneService.getUsers(),
    controlPlaneService.getUserPage(listQuery),
    controlPlaneService.getApps(),
    controlPlaneService.getTenants(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description="Audit multi-tenant user access, role assignments, status, and recent activity." />
      <MetricsCards
        items={[
          { label: 'Active users', value: `${users.items.filter((user) => user.status === 'active').length}`, delta: '+4', trend: 'up', description: 'Users with active access across tenant apps.' },
          { label: 'Invitations pending', value: `${users.items.filter((user) => user.status === 'invited').length}`, delta: '-2', trend: 'down', description: 'Invited users awaiting activation.' },
          { label: 'Suspended', value: `${users.items.filter((user) => user.status === 'suspended').length}`, delta: 'flat', trend: 'flat', description: 'Accounts currently suspended by policy.' },
          { label: 'Distinct roles', value: `${new Set(users.items.map((user) => user.role)).size}`, delta: 'flat', trend: 'flat', description: 'RBAC roles represented in the current fleet.' },
        ]}
      />
      <UserManager
        key={`${userPage.pageInfo.page}:${userPage.pageInfo.pageSize}:${listQuery.query}:${listQuery.status ?? 'all'}:${listQuery.role ?? 'all'}:${userPage.items.map((user) => `${user.id}:${user.role}:${user.status}:${user.appId}`).join('|')}`}
        users={userPage.items}
        apps={apps.items}
        tenants={tenants.items}
        pageInfo={userPage.pageInfo}
        query={listQuery}
        roleOptions={getAssignableRoles(session.user.roles)}
        canManage={hasPermission(session.user.roles, 'users:write')}
      />
    </div>
  );
}
