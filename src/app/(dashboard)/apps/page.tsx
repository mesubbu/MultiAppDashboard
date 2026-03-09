import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { AppManager } from '@/components/dashboard/AppManager';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { parseAppListQuery } from '@/lib/catalog-list-query';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';

export default async function AppsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCurrentSession();
  const listQuery = parseAppListQuery(await searchParams);
  const [apps, appPage, tenants] = await Promise.all([
    controlPlaneService.getApps(),
    controlPlaneService.getAppPage(listQuery),
    controlPlaneService.getTenants(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Apps" description="Track every tenant application by runtime, environment, region, and agent attachment." />
      <MetricsCards
        items={[
          { label: 'Production apps', value: `${apps.items.filter((app) => app.environment === 'production').length}`, delta: '+1', trend: 'up', description: 'Apps currently serving production traffic.' },
          { label: 'Degraded apps', value: `${apps.items.filter((app) => app.status !== 'healthy').length}`, delta: '-1', trend: 'down', description: 'Apps with rollout or service issues.' },
          { label: 'Attached agents', value: `${apps.items.reduce((sum, app) => sum + app.agentsAttached, 0)}`, delta: '+3', trend: 'up', description: 'Total agent workflows mapped to applications.' },
          { label: 'Runtime families', value: `${new Set(apps.items.map((app) => app.runtime)).size}`, delta: 'flat', trend: 'flat', description: 'PWA, Flutter, API, and admin runtime mix.' },
        ]}
      />
      <AppManager
        key={`${appPage.pageInfo.page}:${appPage.pageInfo.pageSize}:${listQuery.query}:${listQuery.status ?? 'all'}:${listQuery.environment ?? 'all'}:${appPage.items.map((app) => `${app.id}:${app.status}:${app.environment}:${app.region}`).join('|')}`}
        apps={appPage.items}
        tenants={tenants.items}
        pageInfo={appPage.pageInfo}
        query={listQuery}
        canManage={hasPermission(session.user.roles, 'apps:write')}
      />
    </div>
  );
}
