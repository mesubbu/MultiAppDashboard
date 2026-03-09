import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetCircuitBreakersForTests } from '@/lib/circuit-breaker';
import { observabilityData, overviewData } from '@/mocks/platform-data';
import type { SessionUser, TenantRecord } from '@/types/platform';

const {
  mockGetCurrentSessionUser,
  mockListCatalogTenants,
  mockListCatalogTenantsPage,
  mockListObservabilityServices,
  mockListScopedClientErrors,
  mockGetLocalControlPlaneSystem,
} = vi.hoisted(() => ({
  mockGetCurrentSessionUser: vi.fn(),
  mockListCatalogTenants: vi.fn(),
  mockListCatalogTenantsPage: vi.fn(),
  mockListObservabilityServices: vi.fn(),
  mockListScopedClientErrors: vi.fn(),
  mockGetLocalControlPlaneSystem: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getCurrentSessionUser: mockGetCurrentSessionUser }));
vi.mock('@/lib/admin-catalog.server', () => ({
  listCatalogTenants: mockListCatalogTenants,
  listCatalogTenantsPage: mockListCatalogTenantsPage,
}));
vi.mock('@/lib/observability.server', () => ({
  listObservabilityServices: mockListObservabilityServices,
  listScopedClientErrors: mockListScopedClientErrors,
}));
vi.mock('@/lib/control-plane-state.server', () => ({
  getLocalControlPlaneSystem: mockGetLocalControlPlaneSystem,
  listLocalControlPlaneAgents: vi.fn().mockResolvedValue([]),
  listLocalControlPlaneModels: vi.fn().mockResolvedValue([]),
  listLocalControlPlaneEvents: vi.fn().mockResolvedValue([]),
  listLocalControlPlaneAuditLogs: vi.fn().mockResolvedValue({ items: [], pageInfo: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 } }),
}));

import { ControlPlaneServiceError, controlPlaneService } from '@/services/control-plane';

const sessionUser: SessionUser = {
  userId: 'user_owner_01', tenantId: 'tenant_acme', appId: 'app_market_web', name: 'Owner', email: 'owner@platform.local', roles: ['tenant_admin'],
};
const tenant: TenantRecord = {
  id: 'tenant_acme', name: 'Acme', tier: 'growth', status: 'healthy', region: 'us-east-1', apps: 3, users: 12, monthlySpendUsd: 1200, eventQuotaDaily: 10000,
};

beforeEach(() => {
  resetCircuitBreakersForTests();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.CONTROL_PLANE_API_BASE_URL;
  delete process.env.NEXT_PUBLIC_CONTROL_PLANE_API_BASE_URL;
  delete process.env.CONTROL_PLANE_API_TOKEN;
  mockGetCurrentSessionUser.mockResolvedValue(sessionUser);
});

afterEach(() => {
  resetCircuitBreakersForTests();
  vi.unstubAllGlobals();
});

describe('controlPlaneService', () => {
  it('rejects when the session user is missing', async () => {
    mockGetCurrentSessionUser.mockResolvedValueOnce(null);
    await expect(controlPlaneService.getOverview()).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('uses scoped local fallback data when no remote base URL is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await controlPlaneService.getOverview();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.metrics[0]?.value).not.toBe(overviewData.metrics[0]?.value);
    expect(result.queueBacklog).not.toBe(overviewData.queueBacklog);
  });

  it('uses local catalog, observability, and system fallbacks', async () => {
    mockListCatalogTenants.mockResolvedValue([tenant]);
    mockListObservabilityServices.mockResolvedValue([observabilityData[0]]);
    mockListScopedClientErrors.mockResolvedValue([{ id: 'err_1', kind: 'window-error', source: 'ui', message: 'boom', name: 'Error', pathname: '/', digest: null, occurredAt: '2026-03-09T00:00:00.000Z', tenantId: sessionUser.tenantId, appId: sessionUser.appId, userId: sessionUser.userId }]);
    mockGetLocalControlPlaneSystem.mockResolvedValue([{ title: 'Runtime', items: [{ key: 'NODE_ENV', value: 'test', description: 'Execution mode' }] }]);

    await expect(controlPlaneService.getTenants()).resolves.toEqual({ items: [tenant] });
    await expect(controlPlaneService.getObservability()).resolves.toMatchObject({ items: [observabilityData[0]], clientErrors: [{ id: 'err_1' }] });
    await expect(controlPlaneService.getSystemSettings()).resolves.toEqual({ sections: [{ title: 'Runtime', items: [{ key: 'NODE_ENV', value: 'test', description: 'Execution mode' }] }] });
  });

  it('sends remote scoped requests with auth headers and validates the response', async () => {
    process.env.CONTROL_PLANE_API_BASE_URL = 'https://control-plane.example';
    process.env.CONTROL_PLANE_API_TOKEN = 'secret-token';
    mockListCatalogTenantsPage.mockResolvedValue({ items: [tenant], pageInfo: { page: 2, pageSize: 1, totalItems: 1, totalPages: 1 } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [tenant], pageInfo: { page: 2, pageSize: 1, totalItems: 1, totalPages: 1 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await controlPlaneService.getTenantPage({ page: 2, pageSize: 1, query: 'acme', status: 'healthy' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/admin/tenants?page=2&page_size=1&q=acme&status=healthy&tenant_id=tenant_acme&app_id=app_market_web');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-token');
    expect((init.headers as Record<string, string>)['x-user-roles']).toBe('tenant_admin');
    expect(result.items[0]?.id).toBe('tenant_acme');
  });

  it('raises invalid-response errors for schema-invalid remote payloads', async () => {
    process.env.CONTROL_PLANE_API_BASE_URL = 'https://control-plane.example';
    mockListCatalogTenants.mockResolvedValue([tenant]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(controlPlaneService.getTenants()).rejects.toMatchObject({ statusCode: 502, code: 'INVALID_CONTROL_PLANE_RESPONSE' });
  });

  it('maps remote HTTP failures to friendly service errors', async () => {
    process.env.CONTROL_PLANE_API_BASE_URL = 'https://control-plane.example';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('forbidden', { status: 403 })));
    await expect(controlPlaneService.getOverview()).rejects.toMatchObject({ statusCode: 403, message: 'You do not have permission to view this control-plane resource.' });
  });

  it('opens the circuit breaker after repeated remote failures', async () => {
    process.env.CONTROL_PLANE_API_BASE_URL = 'https://control-plane.example';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(controlPlaneService.getOverview()).rejects.toBeInstanceOf(ControlPlaneServiceError);
    }
    await expect(controlPlaneService.getOverview()).rejects.toMatchObject({ code: 'CONTROL_PLANE_CIRCUIT_OPEN', statusCode: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

