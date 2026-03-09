import type {
  AppRecord,
  PaginationInfo,
  PlatformRole,
  SessionUser,
  TenantRecord,
  UserRecord,
} from '@/types/platform';

import {
  paginateItems,
  type AppListQuery,
  type TenantListQuery,
  type UserListQuery,
} from '@/lib/catalog-list-query';
import { isDashboardDatabaseConfigured, queryDashboardDb } from '@/lib/db/postgres';
import { publishDashboardDomainEvent } from '@/lib/domain-events';
import { getDashboardEnv } from '@/lib/env';
import {
  canAccessAllTenants,
  filterScopedApps,
  filterScopedItems,
  filterScopedTenants,
  getScopeFilters,
} from '@/lib/scope';
import { appendLocalControlPlaneEvent } from '@/lib/control-plane-state.server';
import { appsData, tenantsData, usersData } from '@/mocks/platform-data';

type CreateTenantInput = Pick<TenantRecord, 'name' | 'tier' | 'status' | 'region' | 'monthlySpendUsd' | 'eventQuotaDaily'>;
type UpdateTenantInput = Partial<CreateTenantInput>;
type CreateAppInput = Pick<AppRecord, 'tenantId' | 'name' | 'runtime' | 'environment' | 'status' | 'region' | 'agentsAttached'>;
type UpdateAppInput = Partial<Omit<CreateAppInput, 'tenantId'>>;
type CreateUserInput = Pick<UserRecord, 'tenantId' | 'appId' | 'name' | 'role' | 'status'>;
type UpdateUserInput = Partial<Pick<UserRecord, 'appId' | 'name' | 'role' | 'status'>>;

type AdminCatalogState = {
  tenants: TenantRecord[];
  apps: AppRecord[];
  users: UserRecord[];
};

type AdminCatalogStore = {
  getState(): AdminCatalogState;
  persist(): Promise<void>;
  clear(options?: { preservePersistedState?: boolean }): Promise<void>;
};

type PaginatedCatalogResult<T> = {
  items: T[];
  pageInfo: PaginationInfo;
};

export class AdminCatalogError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AdminCatalogError';
  }
}

type TenantRow = {
  id: string;
  name: string;
  tier: TenantRecord['tier'];
  status: TenantRecord['status'];
  region: string;
  apps: number;
  users: number;
  monthly_spend_usd: number;
  event_quota_daily: number;
};

type AppRow = {
  id: string;
  tenant_id: string;
  name: string;
  runtime: AppRecord['runtime'];
  environment: AppRecord['environment'];
  status: AppRecord['status'];
  region: string;
  agents_attached: number;
};

type UserRow = {
  id: string;
  tenant_id: string;
  app_id: string;
  name: string;
  role: UserRecord['role'];
  status: UserRecord['status'];
  last_seen_at: Date | null;
};

declare global {
  var __dashboardAdminCatalogStore: Promise<AdminCatalogStore> | undefined;
}

function cloneState(state: AdminCatalogState): AdminCatalogState {
  return structuredClone(state);
}

function createInitialAdminCatalogState(): AdminCatalogState {
  return cloneState({
    tenants: tenantsData,
    apps: appsData,
    users: usersData,
  });
}

function mapTenantRow(row: TenantRow): TenantRecord {
  return {
    id: row.id,
    name: row.name,
    tier: row.tier,
    status: row.status,
    region: row.region,
    apps: row.apps,
    users: row.users,
    monthlySpendUsd: row.monthly_spend_usd,
    eventQuotaDaily: row.event_quota_daily,
  };
}

function mapAppRow(row: AppRow): AppRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    runtime: row.runtime,
    environment: row.environment,
    status: row.status,
    region: row.region,
    agentsAttached: row.agents_attached,
  };
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    appId: row.app_id,
    name: row.name,
    role: row.role,
    status: row.status,
    lastSeenAt: row.last_seen_at?.toISOString() ?? new Date(0).toISOString(),
  };
}

function matchesQuery(values: Array<string | number>, query: string) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return values.some((value) => `${value}`.toLowerCase().includes(normalizedQuery));
}

function filterTenantPageItems(items: TenantRecord[], query: TenantListQuery) {
  return items.filter(
    (tenant) =>
      (!query.status || tenant.status === query.status) &&
      matchesQuery([tenant.id, tenant.name, tenant.region, tenant.tier], query.query),
  );
}

function filterAppPageItems(items: AppRecord[], query: AppListQuery) {
  return items.filter(
    (app) =>
      (!query.status || app.status === query.status) &&
      (!query.environment || app.environment === query.environment) &&
      matchesQuery([app.id, app.name, app.region, app.runtime, app.tenantId], query.query),
  );
}

function filterUserPageItems(items: UserRecord[], query: UserListQuery) {
  return items.filter(
    (user) =>
      (!query.status || user.status === query.status) &&
      (!query.role || user.role === query.role) &&
      matchesQuery([user.id, user.name, user.tenantId, user.appId, user.role], query.query),
  );
}

async function listCatalogTenantsFromDb(user: SessionUser): Promise<TenantRecord[]> {
  const result = await queryDashboardDb<TenantRow>(
    `SELECT id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily
     FROM tenants
     ORDER BY name ASC`,
  );
  return filterScopedTenants(result.rows.map(mapTenantRow), getScopeFilters(user));
}

async function listCatalogAppsFromDb(user: SessionUser): Promise<AppRecord[]> {
  const result = await queryDashboardDb<AppRow>(
    `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
     FROM tenant_apps
     ORDER BY name ASC`,
  );
  return filterScopedApps(result.rows.map(mapAppRow), getScopeFilters(user));
}

async function listCatalogUsersFromDb(user: SessionUser): Promise<UserRecord[]> {
  const result = await queryDashboardDb<UserRow>(
    `SELECT id, tenant_id, app_id, name, role, status, last_seen_at
     FROM users
     ORDER BY name ASC`,
  );
  return filterScopedItems(result.rows.map(mapUserRow), getScopeFilters(user));
}

async function createCatalogTenantInDb(payload: CreateTenantInput) {
  const existingIds = (await queryDashboardDb<{ id: string }>('SELECT id FROM tenants')).rows.map((row) => row.id);
  const tenant: TenantRecord = {
    id: buildUniqueId('tenant_', payload.name, existingIds),
    name: payload.name,
    tier: payload.tier,
    status: payload.status,
    region: payload.region,
    apps: 0,
    users: 0,
    monthlySpendUsd: payload.monthlySpendUsd,
    eventQuotaDaily: payload.eventQuotaDaily,
  };

  await queryDashboardDb(
    `INSERT INTO tenants (id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [tenant.id, tenant.name, tenant.tier, tenant.status, tenant.region, tenant.apps, tenant.users, tenant.monthlySpendUsd, tenant.eventQuotaDaily],
  );

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(),
    type: 'tenant_created',
    source: 'next_admin_catalog',
    resourceType: 'tenant',
    resourceId: tenant.id,
    summary: `Created tenant ${tenant.name}`,
    metadata: { targetTenantId: tenant.id, status: tenant.status, tier: tenant.tier },
  });

  return tenant;
}

async function updateCatalogTenantInDb(user: SessionUser, tenantId: string, payload: UpdateTenantInput) {
  ensureTenantWritable(user, tenantId);
  const existing = await queryDashboardDb<TenantRow>(
    `SELECT id, name, tier, status, region, apps, users, monthly_spend_usd, event_quota_daily
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const tenant = existing.rows[0];
  if (!tenant) {
    throw new AdminCatalogError(404, 'TENANT_NOT_FOUND', 'The requested tenant could not be found.');
  }

  await queryDashboardDb(
    `UPDATE tenants
     SET name = $2, tier = $3, status = $4, region = $5, monthly_spend_usd = $6, event_quota_daily = $7
     WHERE id = $1`,
    [
      tenantId,
      payload.name ?? tenant.name,
      payload.tier ?? tenant.tier,
      payload.status ?? tenant.status,
      payload.region ?? tenant.region,
      payload.monthlySpendUsd ?? tenant.monthly_spend_usd,
      payload.eventQuotaDaily ?? tenant.event_quota_daily,
    ],
  );

  const nextTenant = mapTenantRow({
    ...tenant,
    name: payload.name ?? tenant.name,
    tier: payload.tier ?? tenant.tier,
    status: payload.status ?? tenant.status,
    region: payload.region ?? tenant.region,
    monthly_spend_usd: payload.monthlySpendUsd ?? tenant.monthly_spend_usd,
    event_quota_daily: payload.eventQuotaDaily ?? tenant.event_quota_daily,
  });

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'tenant_updated',
    source: 'next_admin_catalog',
    resourceType: 'tenant',
    resourceId: tenantId,
    summary: `Updated tenant ${nextTenant.name}`,
    metadata: { targetTenantId: tenantId, changes: payload },
  });

  return nextTenant;
}

async function createCatalogAppInDb(user: SessionUser, payload: CreateAppInput) {
  ensureTenantWritable(user, payload.tenantId);
  const tenant = await queryDashboardDb<{ id: string }>('SELECT id FROM tenants WHERE id = $1', [payload.tenantId]);
  if (!tenant.rows[0]) {
    throw new AdminCatalogError(404, 'TENANT_NOT_FOUND', 'The requested tenant could not be found.');
  }

  const existingIds = (await queryDashboardDb<{ id: string }>('SELECT id FROM tenant_apps')).rows.map((row) => row.id);
  const app: AppRecord = {
    id: buildUniqueId('app_', payload.name, existingIds),
    ...payload,
  };

  await queryDashboardDb(
    `INSERT INTO tenant_apps (id, tenant_id, name, runtime, environment, status, region, agents_attached)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [app.id, app.tenantId, app.name, app.runtime, app.environment, app.status, app.region, app.agentsAttached],
  );
  await queryDashboardDb('UPDATE tenants SET apps = apps + 1 WHERE id = $1', [payload.tenantId]);

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'app_created',
    tenantId: app.tenantId,
    appId: app.id,
    source: 'next_admin_catalog',
    resourceType: 'app',
    resourceId: app.id,
    summary: `Created app ${app.name}`,
    metadata: { runtime: app.runtime, environment: app.environment, status: app.status },
  });

  return app;
}

async function updateCatalogAppInDb(user: SessionUser, appId: string, payload: UpdateAppInput) {
  const existing = await queryDashboardDb<AppRow>(
    `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
     FROM tenant_apps WHERE id = $1`,
    [appId],
  );
  const app = existing.rows[0];
  if (!app) {
    throw new AdminCatalogError(404, 'APP_NOT_FOUND', 'The requested app could not be found.');
  }
  ensureTenantWritable(user, app.tenant_id);

  await queryDashboardDb(
    `UPDATE tenant_apps
     SET name = $2, runtime = $3, environment = $4, status = $5, region = $6, agents_attached = $7
     WHERE id = $1`,
    [
      appId,
      payload.name ?? app.name,
      payload.runtime ?? app.runtime,
      payload.environment ?? app.environment,
      payload.status ?? app.status,
      payload.region ?? app.region,
      payload.agentsAttached ?? app.agents_attached,
    ],
  );

  const nextApp = mapAppRow({
    ...app,
    name: payload.name ?? app.name,
    runtime: payload.runtime ?? app.runtime,
    environment: payload.environment ?? app.environment,
    status: payload.status ?? app.status,
    region: payload.region ?? app.region,
    agents_attached: payload.agentsAttached ?? app.agents_attached,
  });

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'app_updated',
    tenantId: nextApp.tenantId,
    appId,
    source: 'next_admin_catalog',
    resourceType: 'app',
    resourceId: appId,
    summary: `Updated app ${nextApp.name}`,
    metadata: { changes: payload },
  });

  return nextApp;
}

async function createCatalogUserInDb(user: SessionUser, payload: CreateUserInput) {
  ensureTenantWritable(user, payload.tenantId);
  ensureAssignableRole(user, payload.role);

  const appResult = await queryDashboardDb<AppRow>(
    `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
     FROM tenant_apps WHERE id = $1`,
    [payload.appId],
  );
  const app = appResult.rows[0];
  if (!app) {
    throw new AdminCatalogError(404, 'APP_NOT_FOUND', 'The requested app could not be found.');
  }
  if (app.tenant_id !== payload.tenantId) {
    throw new AdminCatalogError(400, 'INVALID_APP_SCOPE', 'The selected app does not belong to the selected tenant.');
  }

  const existingIds = (await queryDashboardDb<{ id: string }>('SELECT id FROM users')).rows.map((row) => row.id);
  const nextUser: UserRecord = {
    id: buildUniqueId('usr_', payload.name, existingIds),
    ...payload,
    lastSeenAt: new Date().toISOString(),
  };

  await queryDashboardDb(
    `INSERT INTO users (id, tenant_id, app_id, email, name, role, status, last_seen_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [nextUser.id, nextUser.tenantId, nextUser.appId, '', nextUser.name, nextUser.role, nextUser.status, nextUser.lastSeenAt],
  );
  await queryDashboardDb('UPDATE tenants SET users = users + 1 WHERE id = $1', [payload.tenantId]);

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'user_created',
    tenantId: nextUser.tenantId,
    appId: nextUser.appId,
    source: 'next_admin_catalog',
    resourceType: 'user',
    resourceId: nextUser.id,
    summary: `Created user ${nextUser.name}`,
    metadata: { role: nextUser.role, status: nextUser.status },
  });

  return nextUser;
}

async function updateCatalogUserInDb(user: SessionUser, userId: string, payload: UpdateUserInput) {
  const existingResult = await queryDashboardDb<UserRow>(
    `SELECT id, tenant_id, app_id, name, role, status, last_seen_at
     FROM users WHERE id = $1`,
    [userId],
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    throw new AdminCatalogError(404, 'USER_NOT_FOUND', 'The requested user could not be found.');
  }

  ensureTenantWritable(user, existing.tenant_id);
  if (payload.role) {
    ensureAssignableRole(user, payload.role);
  }
  if (payload.appId) {
    const app = await queryDashboardDb<AppRow>(
      `SELECT id, tenant_id, name, runtime, environment, status, region, agents_attached
       FROM tenant_apps WHERE id = $1`,
      [payload.appId],
    );
    if (app.rows[0]?.tenant_id !== existing.tenant_id) {
      throw new AdminCatalogError(400, 'INVALID_APP_SCOPE', 'The selected app must belong to the user tenant.');
    }
  }

  await queryDashboardDb(
    `UPDATE users
     SET app_id = $2, name = $3, role = $4, status = $5, last_seen_at = $6
     WHERE id = $1`,
    [
      userId,
      payload.appId ?? existing.app_id,
      payload.name ?? existing.name,
      payload.role ?? existing.role,
      payload.status ?? existing.status,
      existing.last_seen_at?.toISOString() ?? new Date().toISOString(),
    ],
  );

  const nextUser = mapUserRow({
    ...existing,
    app_id: payload.appId ?? existing.app_id,
    name: payload.name ?? existing.name,
    role: payload.role ?? existing.role,
    status: payload.status ?? existing.status,
  });

  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'user_updated',
    tenantId: nextUser.tenantId,
    appId: nextUser.appId,
    source: 'next_admin_catalog',
    resourceType: 'user',
    resourceId: userId,
    summary: `Updated user ${nextUser.name}`,
    metadata: { changes: payload },
  });

  return nextUser;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

function buildUniqueId(prefix: string, name: string, existingIds: string[]) {
  const base = slugify(name) || crypto.randomUUID().slice(0, 8);
  const used = new Set(existingIds);
  let candidate = `${prefix}${base}`;
  let index = 2;

  while (used.has(candidate)) {
    candidate = `${prefix}${base}_${index}`;
    index += 1;
  }

  return candidate;
}

function getCatalogEventActor(user?: SessionUser) {
  return {
    tenantId: user?.tenantId ?? 'platform-root',
    appId: user?.appId ?? 'control-dashboard',
    actor: user?.userId ?? 'platform_owner',
    actorDisplay: user?.name ?? 'Platform Owner',
  };
}

async function publishCatalogMutationEvent(input: Parameters<typeof publishDashboardDomainEvent>[0]) {
  await publishDashboardDomainEvent(input, {
    localSink: (event) => appendLocalControlPlaneEvent(event),
  });
}

function ensureTenantWritable(user: SessionUser, tenantId: string) {
  if (!canAccessAllTenants(user.roles) && user.tenantId !== tenantId) {
    throw new AdminCatalogError(403, 'INVALID_SCOPE', 'You can only manage resources within your tenant scope.');
  }
}

function ensureAssignableRole(user: SessionUser, role: PlatformRole) {
  if (user.roles.includes('platform_owner')) {
    return;
  }

  if (user.roles.includes('tenant_admin') && ['tenant_admin', 'analyst', 'viewer'].includes(role)) {
    return;
  }

  throw new AdminCatalogError(403, 'INVALID_ROLE', 'You cannot assign the requested platform role.');
}

function findTenant(state: AdminCatalogState, tenantId: string) {
  const tenant = state.tenants.find((item) => item.id === tenantId);
  if (!tenant) {
    throw new AdminCatalogError(404, 'TENANT_NOT_FOUND', 'The requested tenant could not be found.');
  }
  return tenant;
}

function findApp(state: AdminCatalogState, appId: string) {
  const app = state.apps.find((item) => item.id === appId);
  if (!app) {
    throw new AdminCatalogError(404, 'APP_NOT_FOUND', 'The requested app could not be found.');
  }
  return app;
}

function findUser(state: AdminCatalogState, userId: string) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    throw new AdminCatalogError(404, 'USER_NOT_FOUND', 'The requested user could not be found.');
  }
  return user;
}

function createInMemoryStore(): AdminCatalogStore {
  let state = createInitialAdminCatalogState();

  return {
    getState() {
      return state;
    },
    async persist() {},
    async clear() {
      state = createInitialAdminCatalogState();
    },
  };
}

async function createFileBackedStore(filePath: string): Promise<AdminCatalogStore> {
  const [{ mkdir, readFile, rename, rm, writeFile }, { dirname, resolve }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ]);

  const resolvedPath = resolve(process.cwd(), filePath);
  let state = createInitialAdminCatalogState();
  let writeQueue = Promise.resolve();

  async function persistToDisk() {
    await mkdir(dirname(resolvedPath), { recursive: true });
    const tempPath = `${resolvedPath}.tmp`;
    await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
    await rename(tempPath, resolvedPath);
  }

  async function persist() {
    writeQueue = writeQueue.then(() => persistToDisk());
    await writeQueue;
  }

  try {
    const raw = await readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AdminCatalogState>;
    state = {
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : tenantsData,
      apps: Array.isArray(parsed.apps) ? parsed.apps : appsData,
      users: Array.isArray(parsed.users) ? parsed.users : usersData,
    };
  } catch {
    await persistToDisk();
  }

  return {
    getState() {
      return state;
    },
    persist,
    async clear(options = {}) {
      state = createInitialAdminCatalogState();
      if (!options.preservePersistedState) {
        await rm(resolvedPath, { force: true });
      }
    },
  };
}

async function getStore() {
  if (globalThis.__dashboardAdminCatalogStore) {
    return globalThis.__dashboardAdminCatalogStore;
  }

  const filePath = getDashboardEnv().ADMIN_CATALOG_STATE_FILE;
  globalThis.__dashboardAdminCatalogStore = filePath
    ? createFileBackedStore(filePath)
    : Promise.resolve(createInMemoryStore());

  return globalThis.__dashboardAdminCatalogStore;
}

export function resetAdminCatalogStoreCache() {
  globalThis.__dashboardAdminCatalogStore = undefined;
}

export async function resetAdminCatalogStateForTests(options?: { preservePersistedState?: boolean }) {
  const store = await getStore();
  await store.clear(options);
  resetAdminCatalogStoreCache();
}

export async function listCatalogTenants(user: SessionUser): Promise<TenantRecord[]> {
  if (isDashboardDatabaseConfigured()) {
    return listCatalogTenantsFromDb(user);
  }
  return filterScopedTenants(cloneState((await getStore()).getState()).tenants, getScopeFilters(user));
}

export async function listCatalogApps(user: SessionUser): Promise<AppRecord[]> {
  if (isDashboardDatabaseConfigured()) {
    return listCatalogAppsFromDb(user);
  }
  return filterScopedApps(cloneState((await getStore()).getState()).apps, getScopeFilters(user));
}

export async function listCatalogUsers(user: SessionUser): Promise<UserRecord[]> {
  if (isDashboardDatabaseConfigured()) {
    return listCatalogUsersFromDb(user);
  }
  return filterScopedItems(cloneState((await getStore()).getState()).users, getScopeFilters(user));
}

export async function listCatalogTenantsPage(
  user: SessionUser,
  query: TenantListQuery,
): Promise<PaginatedCatalogResult<TenantRecord>> {
  return paginateItems(filterTenantPageItems(await listCatalogTenants(user), query), query.page, query.pageSize);
}

export async function listCatalogAppsPage(
  user: SessionUser,
  query: AppListQuery,
): Promise<PaginatedCatalogResult<AppRecord>> {
  return paginateItems(filterAppPageItems(await listCatalogApps(user), query), query.page, query.pageSize);
}

export async function listCatalogUsersPage(
  user: SessionUser,
  query: UserListQuery,
): Promise<PaginatedCatalogResult<UserRecord>> {
  return paginateItems(filterUserPageItems(await listCatalogUsers(user), query), query.page, query.pageSize);
}

export async function createCatalogTenant(payload: CreateTenantInput) {
  if (isDashboardDatabaseConfigured()) {
    return createCatalogTenantInDb(payload);
  }
  const store = await getStore();
  const state = store.getState();
  const tenant: TenantRecord = {
    id: buildUniqueId('tenant_', payload.name, state.tenants.map((item) => item.id)),
    name: payload.name,
    tier: payload.tier,
    status: payload.status,
    region: payload.region,
    apps: 0,
    users: 0,
    monthlySpendUsd: payload.monthlySpendUsd,
    eventQuotaDaily: payload.eventQuotaDaily,
  };

  state.tenants.unshift(tenant);
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(),
    type: 'tenant_created',
    source: 'next_admin_catalog',
    resourceType: 'tenant',
    resourceId: tenant.id,
    summary: `Created tenant ${tenant.name}`,
    metadata: { targetTenantId: tenant.id, status: tenant.status, tier: tenant.tier },
  });
  return structuredClone(tenant);
}

export async function updateCatalogTenant(user: SessionUser, tenantId: string, payload: UpdateTenantInput) {
  if (isDashboardDatabaseConfigured()) {
    return updateCatalogTenantInDb(user, tenantId, payload);
  }
  const store = await getStore();
  const state = store.getState();
  ensureTenantWritable(user, tenantId);
  const tenant = findTenant(state, tenantId);
  Object.assign(tenant, payload);
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'tenant_updated',
    source: 'next_admin_catalog',
    resourceType: 'tenant',
    resourceId: tenantId,
    summary: `Updated tenant ${tenant.name}`,
    metadata: { targetTenantId: tenantId, changes: payload },
  });
  return structuredClone(tenant);
}

export async function createCatalogApp(user: SessionUser, payload: CreateAppInput) {
  if (isDashboardDatabaseConfigured()) {
    return createCatalogAppInDb(user, payload);
  }
  const store = await getStore();
  const state = store.getState();
  ensureTenantWritable(user, payload.tenantId);
  const tenant = findTenant(state, payload.tenantId);
  const app: AppRecord = {
    id: buildUniqueId('app_', payload.name, state.apps.map((item) => item.id)),
    ...payload,
  };

  state.apps.unshift(app);
  tenant.apps += 1;
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'app_created',
    tenantId: app.tenantId,
    appId: app.id,
    source: 'next_admin_catalog',
    resourceType: 'app',
    resourceId: app.id,
    summary: `Created app ${app.name}`,
    metadata: { runtime: app.runtime, environment: app.environment, status: app.status },
  });
  return structuredClone(app);
}

export async function updateCatalogApp(user: SessionUser, appId: string, payload: UpdateAppInput) {
  if (isDashboardDatabaseConfigured()) {
    return updateCatalogAppInDb(user, appId, payload);
  }
  const store = await getStore();
  const state = store.getState();
  const app = findApp(state, appId);
  ensureTenantWritable(user, app.tenantId);
  Object.assign(app, payload);
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'app_updated',
    tenantId: app.tenantId,
    appId: app.id,
    source: 'next_admin_catalog',
    resourceType: 'app',
    resourceId: appId,
    summary: `Updated app ${app.name}`,
    metadata: { changes: payload },
  });
  return structuredClone(app);
}

export async function createCatalogUser(user: SessionUser, payload: CreateUserInput) {
  if (isDashboardDatabaseConfigured()) {
    return createCatalogUserInDb(user, payload);
  }
  const store = await getStore();
  const state = store.getState();
  ensureTenantWritable(user, payload.tenantId);
  ensureAssignableRole(user, payload.role);
  const tenant = findTenant(state, payload.tenantId);
  const app = findApp(state, payload.appId);
  if (app.tenantId !== payload.tenantId) {
    throw new AdminCatalogError(400, 'INVALID_APP_SCOPE', 'The selected app does not belong to the selected tenant.');
  }

  const nextUser: UserRecord = {
    id: buildUniqueId('usr_', payload.name, state.users.map((item) => item.id)),
    ...payload,
    lastSeenAt: new Date().toISOString(),
  };

  state.users.unshift(nextUser);
  tenant.users += 1;
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'user_created',
    tenantId: nextUser.tenantId,
    appId: nextUser.appId,
    source: 'next_admin_catalog',
    resourceType: 'user',
    resourceId: nextUser.id,
    summary: `Created user ${nextUser.name}`,
    metadata: { role: nextUser.role, status: nextUser.status },
  });
  return structuredClone(nextUser);
}

export async function updateCatalogUser(user: SessionUser, userId: string, payload: UpdateUserInput) {
  if (isDashboardDatabaseConfigured()) {
    return updateCatalogUserInDb(user, userId, payload);
  }
  const store = await getStore();
  const state = store.getState();
  const existing = findUser(state, userId);
  ensureTenantWritable(user, existing.tenantId);

  if (payload.role) {
    ensureAssignableRole(user, payload.role);
  }

  if (payload.appId) {
    const app = findApp(state, payload.appId);
    if (app.tenantId !== existing.tenantId) {
      throw new AdminCatalogError(400, 'INVALID_APP_SCOPE', 'The selected app must belong to the user tenant.');
    }
  }

  Object.assign(existing, payload);
  await store.persist();
  await publishCatalogMutationEvent({
    ...getCatalogEventActor(user),
    type: 'user_updated',
    tenantId: existing.tenantId,
    appId: existing.appId,
    source: 'next_admin_catalog',
    resourceType: 'user',
    resourceId: userId,
    summary: `Updated user ${existing.name}`,
    metadata: { changes: payload },
  });
  return structuredClone(existing);
}