'use client';

import { useState, useTransition } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { getApiErrorMessage } from '@/components/dashboard/admin-client-utils';
import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import type { AppRecord, PaginationInfo, TenantRecord } from '@/types/platform';

type AppDraft = Pick<AppRecord, 'name' | 'environment' | 'status' | 'region'>;

export function AppManager({
  apps,
  tenants,
  canManage,
  pageInfo,
  query,
}: {
  apps: AppRecord[];
  tenants: TenantRecord[];
  canManage: boolean;
  pageInfo: PaginationInfo;
  query: { query: string; status?: AppRecord['status']; environment?: AppRecord['environment'] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(query.query);
  const [statusFilter, setStatusFilter] = useState(query.status ?? 'all');
  const [environmentFilter, setEnvironmentFilter] = useState(query.environment ?? 'all');
  const [drafts, setDrafts] = useState<Record<string, AppDraft>>(() =>
    Object.fromEntries(
      apps.map((app) => [
        app.id,
        {
          name: app.name,
          environment: app.environment,
          status: app.status,
          region: app.region,
        },
      ]),
    ),
  );
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? '',
    name: '',
    runtime: 'pwa',
    environment: 'production',
    region: 'us-east-1',
  });

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

  async function createApp() {
    const response = await fetch('/api/admin/apps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'healthy', agentsAttached: 0 }),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to create app.'));
    }
  }

  async function saveApp(appId: string) {
    const response = await fetch(`/api/admin/apps/${appId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(drafts[appId]),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to update app.'));
    }
  }

  return (
    <SectionCard
      title="Application registry"
      description="All applications deployed on top of the shared multi-tenant platform."
    >
      {canManage ? (
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-5">
          <select
            value={form.tenantId}
            onChange={(event) => setForm((current) => ({ ...current, tenantId: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="App name"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={form.runtime}
            onChange={(event) => setForm((current) => ({ ...current, runtime: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="pwa">PWA</option>
            <option value="flutter">Flutter</option>
            <option value="admin">Admin</option>
            <option value="api">API</option>
          </select>
          <select
            value={form.environment}
            onChange={(event) => setForm((current) => ({ ...current, environment: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>
          <button
            disabled={isPending || !form.name.trim() || !form.tenantId}
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  try {
                    await createApp();
                    const createdName = form.name;
                    setForm((current) => ({ ...current, name: '' }));
                    pushSuccessToast('Application created', `${createdName} was added successfully.`);
                    router.refresh();
                  } catch (error) {
                    pushErrorToast(
                      'Unable to create app',
                      error instanceof Error ? error.message : 'Unable to create app.',
                    );
                  }
                })();
              })
            }
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Create app
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px] xl:min-w-[44rem]">
          <div>
            <label htmlFor="app-search" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Search apps
            </label>
            <input
              id="app-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Name, id, runtime, tenant, or region"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="app-status-filter" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Status
            </label>
            <select id="app-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AppRecord['status'] | 'all')} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label htmlFor="app-environment-filter" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Environment
            </label>
            <select id="app-environment-filter" value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value as AppRecord['environment'] | 'all')} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="all">All environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => replaceListParams({ q: searchQuery.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter, environment: environmentFilter === 'all' ? undefined : environmentFilter }, true)} className="rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200">
            Apply filters
          </button>
          <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setEnvironmentFilter('all'); replaceListParams({ q: undefined, status: undefined, environment: undefined, page: undefined }, true); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">
            Clear
          </button>
        </div>
      </div>

      <ClientDataTable
        ariaLabel="Application registry table"
        rows={apps}
        rowKey={(app) => app.id}
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
            header: 'App',
            sortValue: (app) => drafts[app.id]?.name ?? app.name,
            render: (app) => (
              <div>
                <p className="font-medium text-white">{app.name}</p>
                <p className="text-xs text-slate-500">{app.id}</p>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: 'Tenant',
            sortValue: (app) => tenants.find((tenant) => tenant.id === app.tenantId)?.name ?? app.tenantId,
            render: (app) => tenants.find((tenant) => tenant.id === app.tenantId)?.name ?? app.tenantId,
          },
          {
            key: 'runtime',
            header: 'Runtime',
            sortValue: (app) => app.runtime,
            render: (app) => <span className="capitalize">{app.runtime}</span>,
          },
          {
            key: 'environment',
            header: 'Environment',
            sortValue: (app) => drafts[app.id]?.environment ?? app.environment,
            render: (app) =>
              canManage ? (
                <select
                  value={drafts[app.id]?.environment ?? app.environment}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [app.id]: {
                        ...current[app.id],
                        environment: event.target.value as AppRecord['environment'],
                      },
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              ) : (
                <span className="capitalize">{app.environment}</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (app) => drafts[app.id]?.status ?? app.status,
            render: (app) =>
              canManage ? (
                <select
                  value={drafts[app.id]?.status ?? app.status}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [app.id]: {
                        ...current[app.id],
                        status: event.target.value as AppRecord['status'],
                      },
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="healthy">Healthy</option>
                  <option value="degraded">Degraded</option>
                  <option value="critical">Critical</option>
                </select>
              ) : (
                <StatusBadge value={app.status} />
              ),
          },
          {
            key: 'region',
            header: 'Region',
            sortValue: (app) => drafts[app.id]?.region ?? app.region,
            render: (app) =>
              canManage ? (
                <input
                  value={drafts[app.id]?.region ?? app.region}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [app.id]: { ...current[app.id], region: event.target.value },
                    }))
                  }
                  className="w-28 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                />
              ) : (
                app.region
              ),
          },
          {
            key: 'agents',
            header: 'Agents',
            sortValue: (app) => app.agentsAttached,
            render: (app) => app.agentsAttached,
          },
          {
            key: 'actions',
            header: '',
            render: (app) =>
              canManage ? (
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void (async () => {
                        try {
                          await saveApp(app.id);
                          pushSuccessToast(
                            'Application updated',
                            `${drafts[app.id]?.name ?? app.name} was saved successfully.`,
                          );
                          router.refresh();
                        } catch (error) {
                          pushErrorToast(
                            'Unable to update app',
                            error instanceof Error ? error.message : 'Unable to update app.',
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