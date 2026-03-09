import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { TenantManager } from '@/components/dashboard/TenantManager';
import { parseTenantListQuery } from '@/lib/catalog-list-query';
import { hasPermission } from '@/lib/rbac';
import { requireCurrentSession } from '@/lib/session';
import { controlPlaneService } from '@/services/control-plane';
import { formatCurrency } from '@/lib/utils';

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCurrentSession();
  const listQuery = parseTenantListQuery(await searchParams);
  const [tenants, tenantPage] = await Promise.all([
    controlPlaneService.getTenants(),
    controlPlaneService.getTenantPage(listQuery),
  ]);
  const totalSpend = tenants.items.reduce((sum, tenant) => sum + tenant.monthlySpendUsd, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Tenants" description="Manage tenant lifecycle, quotas, regional footprint, and health posture across the platform." />
      <MetricsCards
        items={[
          { label: 'Tenant count', value: `${tenants.items.length}`, delta: '+1', trend: 'up', description: 'Provisioned tenants with active control-plane registration.' },
          { label: 'Monthly spend', value: formatCurrency(totalSpend), delta: '+7%', trend: 'up', description: 'Aggregate spend across model, storage, and orchestration services.' },
          { label: 'Degraded tenants', value: `${tenants.items.filter((tenant) => tenant.status === 'degraded').length}`, delta: '-1', trend: 'down', description: 'Tenants currently needing operator attention.' },
          { label: 'Daily quota capacity', value: `${Math.round(tenants.items.reduce((sum, tenant) => sum + tenant.eventQuotaDaily, 0) / 1000)}k`, delta: '+15%', trend: 'up', description: 'Combined daily event budget provisioned across all tenants.' },
        ]}
      />
      <TenantManager
        key={`${tenantPage.pageInfo.page}:${tenantPage.pageInfo.pageSize}:${listQuery.query}:${listQuery.status ?? 'all'}:${tenantPage.items.map((tenant) => `${tenant.id}:${tenant.status}:${tenant.region}:${tenant.eventQuotaDaily}`).join('|')}`}
        tenants={tenantPage.items}
        pageInfo={tenantPage.pageInfo}
        query={listQuery}
        canManage={hasPermission(session.user.roles, 'tenants:write')}
      />
    </div>
  );
}
