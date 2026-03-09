'use client';

import { useState, useTransition } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { getApiErrorMessage } from '@/components/dashboard/admin-client-utils';
import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { formatCompactNumber, formatCurrency } from '@/lib/utils';
import type { PaginationInfo, TenantRecord } from '@/types/platform';

type TenantDraft = Pick<TenantRecord, 'name' | 'tier' | 'status' | 'region' | 'eventQuotaDaily'>;

function buildDrafts(tenants: TenantRecord[]) {
  return Object.fromEntries(
    tenants.map((tenant) => [
      tenant.id,
      {
        name: tenant.name,
        tier: tenant.tier,
        status: tenant.status,
        region: tenant.region,
        eventQuotaDaily: tenant.eventQuotaDaily,
      },
    ]),
  ) as Record<string, TenantDraft>;
}

export function TenantManager({
  tenants,
  canManage,
  pageInfo,
  query,
}: {
  tenants: TenantRecord[];
  canManage: boolean;
  pageInfo: PaginationInfo;
  query: { query: string; status?: TenantRecord['status'] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, TenantDraft>>(() => buildDrafts(tenants));
  const [searchQuery, setSearchQuery] = useState(query.query);
  const [statusFilter, setStatusFilter] = useState(query.status ?? 'all');
  const [form, setForm] = useState({
    name: '',
    tier: 'starter',
    region: 'us-east-1',
    eventQuotaDaily: '25000',
  });

  function updateDraft(tenantId: string, patch: Partial<TenantDraft>) {
    setDrafts((current) => ({ ...current, [tenantId]: { ...current[tenantId], ...patch } }));
  }

  function replaceListParams(updates: Record<string, string | undefined>, resetPage = false) {
    const next = new URLSearchParams(searchParams.toString());
    if (resetPage) {
      next.delete('page');
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value && value.length > 0) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }

    const queryString = next.toString();
    router.replace((queryString ? `${pathname}?${queryString}` : pathname) as Route);
  }

  async function createTenant() {
    const response = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        tier: form.tier,
        status: 'healthy',
        region: form.region,
        monthlySpendUsd: 0,
        eventQuotaDaily: Number(form.eventQuotaDaily),
      }),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to create tenant.'));
    }
  }

  async function saveTenant(tenantId: string) {
    const response = await fetch(`/api/admin/tenants/${tenantId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(drafts[tenantId]),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to update tenant.'));
    }
  }

  return (
    <SectionCard
      title="Tenant fleet"
      description="Manage tenancy health, capacity tiers, regional posture, and daily quotas."
    >
      {canManage ? (
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-5">
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="New tenant name"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={form.tier}
            onChange={(event) => setForm((current) => ({ ...current, tier: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <input
            value={form.region}
            onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
            placeholder="Region"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <input
            value={form.eventQuotaDaily}
            onChange={(event) => setForm((current) => ({ ...current, eventQuotaDaily: event.target.value }))}
            placeholder="Quota / day"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            disabled={isPending || !form.name.trim()}
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  try {
                    await createTenant();
                    const createdName = form.name;
                    setForm({
                      name: '',
                      tier: 'starter',
                      region: 'us-east-1',
                      eventQuotaDaily: '25000',
                    });
                    pushSuccessToast('Tenant created', `${createdName} is now available in the fleet.`);
                    router.refresh();
                  } catch (error) {
                    pushErrorToast(
                      'Unable to create tenant',
                      error instanceof Error ? error.message : 'Unable to create tenant.',
                    );
                  }
                })();
              })
            }
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Create tenant
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] lg:min-w-[32rem]">
          <div>
            <label htmlFor="tenant-search" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Search tenants
            </label>
            <input
              id="tenant-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Name, id, tier, or region"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="tenant-status-filter" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Status
            </label>
            <select
              id="tenant-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TenantRecord['status'] | 'all')}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              replaceListParams(
                {
                  q: searchQuery.trim() || undefined,
                  status: statusFilter === 'all' ? undefined : statusFilter,
                },
                true,
              )
            }
            className="rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              replaceListParams({ q: undefined, status: undefined, page: undefined }, true);
            }}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300"
          >
            Clear
          </button>
        </div>
      </div>

      <ClientDataTable
        ariaLabel="Tenant fleet table"
        rows={tenants}
        rowKey={(tenant) => tenant.id}
        initialSort={{ key: 'name', direction: 'asc' }}
        pageSizeOptions={[10, 20, 50]}
        serverPagination={{
          ...pageInfo,
          onPageChange: (page) => replaceListParams({ page: `${page}` }),
          onPageSizeChange: (pageSize) => replaceListParams({ page: '1', page_size: `${pageSize}` }),
        }}
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            sortValue: (tenant) => tenant.name,
            render: (tenant) => (
              <div>
                <p className="font-medium text-white">{tenant.name}</p>
                <p className="text-xs text-slate-500">{tenant.id}</p>
              </div>
            ),
          },
          {
            key: 'tier',
            header: 'Tier',
            sortValue: (tenant) => drafts[tenant.id]?.tier ?? tenant.tier,
            render: (tenant) =>
              canManage ? (
                <select
                  value={drafts[tenant.id]?.tier ?? tenant.tier}
                  onChange={(event) =>
                    updateDraft(tenant.id, { tier: event.target.value as TenantRecord['tier'] })
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              ) : (
                <span className="capitalize">{tenant.tier}</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (tenant) => drafts[tenant.id]?.status ?? tenant.status,
            render: (tenant) =>
              canManage ? (
                <select
                  value={drafts[tenant.id]?.status ?? tenant.status}
                  onChange={(event) =>
                    updateDraft(tenant.id, { status: event.target.value as TenantRecord['status'] })
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="healthy">Healthy</option>
                  <option value="degraded">Degraded</option>
                  <option value="critical">Critical</option>
                </select>
              ) : (
                <StatusBadge value={tenant.status} />
              ),
          },
          {
            key: 'footprint',
            header: 'Footprint',
            sortValue: (tenant) => tenant.users,
            render: (tenant) => (
              <div className="space-y-1">
                <p>{tenant.apps} apps</p>
                <p className="text-xs text-slate-500">{formatCompactNumber(tenant.users)} users</p>
              </div>
            ),
          },
          {
            key: 'quota',
            header: 'Quota / day',
            sortValue: (tenant) => drafts[tenant.id]?.eventQuotaDaily ?? tenant.eventQuotaDaily,
            render: (tenant) =>
              canManage ? (
                <input
                  value={drafts[tenant.id]?.eventQuotaDaily ?? tenant.eventQuotaDaily}
                  onChange={(event) =>
                    updateDraft(tenant.id, {
                      eventQuotaDaily: Number(event.target.value) || tenant.eventQuotaDaily,
                    })
                  }
                  className="w-24 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
              ) : (
                formatCompactNumber(tenant.eventQuotaDaily)
              ),
          },
          {
            key: 'spend',
            header: 'Spend',
            sortValue: (tenant) => tenant.monthlySpendUsd,
            render: (tenant) => formatCurrency(tenant.monthlySpendUsd),
          },
          {
            key: 'region',
            header: 'Region',
            sortValue: (tenant) => drafts[tenant.id]?.region ?? tenant.region,
            render: (tenant) =>
              canManage ? (
                <input
                  value={drafts[tenant.id]?.region ?? tenant.region}
                  onChange={(event) => updateDraft(tenant.id, { region: event.target.value })}
                  className="w-28 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
              ) : (
                tenant.region
              ),
          },
          {
            key: 'actions',
            header: '',
            render: (tenant) =>
              canManage ? (
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void (async () => {
                        try {
                          await saveTenant(tenant.id);
                          pushSuccessToast(
                            'Tenant updated',
                            `${drafts[tenant.id]?.name ?? tenant.name} was saved successfully.`,
                          );
                          router.refresh();
                        } catch (error) {
                          pushErrorToast(
                            'Unable to update tenant',
                            error instanceof Error ? error.message : 'Unable to update tenant.',
                          );
                        }
                      })();
                    })
                  }
                  className="rounded-lg border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-200 disabled:opacity-50"
                >
                  Save
                </button>
              ) : null,
          },
        ]}
      />
    </SectionCard>
  );
}