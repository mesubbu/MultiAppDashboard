'use client';

import { useMemo, useState, useTransition } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { getApiErrorMessage } from '@/components/dashboard/admin-client-utils';
import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/utils';
import type { AppRecord, PaginationInfo, PlatformRole, TenantRecord, UserRecord } from '@/types/platform';

export function UserManager({
  users,
  apps,
  tenants,
  roleOptions,
  canManage,
  pageInfo,
  query,
}: {
  users: UserRecord[];
  apps: AppRecord[];
  tenants: TenantRecord[];
  roleOptions: PlatformRole[];
  canManage: boolean;
  pageInfo: PaginationInfo;
  query: { query: string; status?: UserRecord['status']; role?: PlatformRole };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushErrorToast, pushSuccessToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, Pick<UserRecord, 'appId' | 'role' | 'status'>>>({});
  const [searchQuery, setSearchQuery] = useState(query.query);
  const [statusFilter, setStatusFilter] = useState(query.status ?? 'all');
  const [roleFilter, setRoleFilter] = useState<PlatformRole | 'all'>(query.role ?? 'all');
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? '',
    appId: apps[0]?.id ?? '',
    name: '',
    role: roleOptions[0] ?? 'viewer',
    status: 'invited',
  });

  const appsByTenant = useMemo(
    () =>
      apps.reduce<Record<string, AppRecord[]>>((groups, app) => {
        groups[app.tenantId] ??= [];
        groups[app.tenantId].push(app);
        return groups;
      }, {}),
    [apps],
  );

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

  async function createUser() {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to create user.'));
    }
  }

  async function saveUser(user: UserRecord) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        drafts[user.id] ?? { appId: user.appId, role: user.role, status: user.status },
      ),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to update user.'));
    }
  }

  return (
    <SectionCard
      title="User directory"
      description="Cross-tenant access registry for operators, analysts, admins, and viewers."
    >
      {canManage ? (
        <div className="mb-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-6">
          <select
            value={form.tenantId}
            onChange={(event) => {
              const tenantId = event.target.value;
              setForm((current) => ({
                ...current,
                tenantId,
                appId: appsByTenant[tenantId]?.[0]?.id ?? '',
              }));
            }}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select
            value={form.appId}
            onChange={(event) => setForm((current) => ({ ...current, appId: event.target.value }))}
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {(appsByTenant[form.tenantId] ?? []).map((app) => (
              <option key={app.id} value={app.id}>
                {app.name}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="User name"
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <select
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({ ...current, role: event.target.value as PlatformRole }))
            }
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({ ...current, status: event.target.value as UserRecord['status'] }))
            }
            className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          >
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button
            disabled={isPending || !form.name.trim() || !form.appId}
            onClick={() =>
              startTransition(() => {
                void (async () => {
                  try {
                    await createUser();
                    const createdName = form.name;
                    setForm((current) => ({ ...current, name: '' }));
                    pushSuccessToast('User created', `${createdName} was added to the directory.`);
                    router.refresh();
                  } catch (error) {
                    pushErrorToast(
                      'Unable to create user',
                      error instanceof Error ? error.message : 'Unable to create user.',
                    );
                  }
                })();
              })
            }
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            Add user
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/30 p-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px] xl:min-w-[44rem]">
          <div>
            <label htmlFor="user-search" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Search users
            </label>
            <input
              id="user-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Name, id, tenant, app, or role"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label htmlFor="user-status-filter" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Status
            </label>
            <select id="user-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UserRecord['status'] | 'all')} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="invited">Invited</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div>
            <label htmlFor="user-role-filter" className="block text-xs uppercase tracking-[0.2em] text-slate-500">
              Role
            </label>
            <select id="user-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as PlatformRole | 'all')} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-100">
              <option value="all">All roles</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => replaceListParams({ q: searchQuery.trim() || undefined, status: statusFilter === 'all' ? undefined : statusFilter, role: roleFilter === 'all' ? undefined : roleFilter }, true)} className="rounded-xl border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-200">
            Apply filters
          </button>
          <button type="button" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setRoleFilter('all'); replaceListParams({ q: undefined, status: undefined, role: undefined, page: undefined }, true); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300">
            Clear
          </button>
        </div>
      </div>

      <ClientDataTable
        ariaLabel="User directory table"
        rows={users}
        rowKey={(user) => user.id}
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
            header: 'User',
            sortValue: (user) => user.name,
            render: (user) => (
              <div>
                <p className="font-medium text-white">{user.name}</p>
                <p className="text-xs text-slate-500">{user.id}</p>
              </div>
            ),
          },
          {
            key: 'tenant',
            header: 'Tenant',
            sortValue: (user) => tenants.find((tenant) => tenant.id === user.tenantId)?.name ?? user.tenantId,
            render: (user) => tenants.find((tenant) => tenant.id === user.tenantId)?.name ?? user.tenantId,
          },
          {
            key: 'app',
            header: 'App',
            sortValue: (user) =>
              apps.find((app) => app.id === (drafts[user.id]?.appId ?? user.appId))?.name ??
              drafts[user.id]?.appId ??
              user.appId,
            render: (user) =>
              canManage ? (
                <select
                  value={drafts[user.id]?.appId ?? user.appId}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: {
                        appId: event.target.value,
                        role: current[user.id]?.role ?? user.role,
                        status: current[user.id]?.status ?? user.status,
                      },
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  {(appsByTenant[user.tenantId] ?? []).map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              ) : (
                apps.find((app) => app.id === user.appId)?.name ?? user.appId
              ),
          },
          {
            key: 'role',
            header: 'Role',
            sortValue: (user) => drafts[user.id]?.role ?? user.role,
            render: (user) =>
              canManage ? (
                <select
                  value={drafts[user.id]?.role ?? user.role}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: {
                        appId: current[user.id]?.appId ?? user.appId,
                        role: event.target.value as PlatformRole,
                        status: current[user.id]?.status ?? user.status,
                      },
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="capitalize">{user.role.replaceAll('_', ' ')}</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (user) => drafts[user.id]?.status ?? user.status,
            render: (user) =>
              canManage ? (
                <select
                  value={drafts[user.id]?.status ?? user.status}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: {
                        appId: current[user.id]?.appId ?? user.appId,
                        role: current[user.id]?.role ?? user.role,
                        status: event.target.value as UserRecord['status'],
                      },
                    }))
                  }
                  className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                >
                  <option value="active">Active</option>
                  <option value="invited">Invited</option>
                  <option value="suspended">Suspended</option>
                </select>
              ) : (
                <StatusBadge value={user.status} />
              ),
          },
          {
            key: 'lastSeen',
            header: 'Last seen',
            sortValue: (user) => new Date(user.lastSeenAt),
            render: (user) => formatDateTime(user.lastSeenAt),
          },
          {
            key: 'actions',
            header: '',
            render: (user) =>
              canManage ? (
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() => {
                      void (async () => {
                        try {
                          await saveUser(user);
                          pushSuccessToast('User updated', `${user.name} was saved successfully.`);
                          router.refresh();
                        } catch (error) {
                          pushErrorToast(
                            'Unable to update user',
                            error instanceof Error ? error.message : 'Unable to update user.',
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