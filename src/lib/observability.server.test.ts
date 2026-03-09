import { beforeEach, describe, expect, it, vi } from 'vitest';

import { observabilityData } from '@/mocks/platform-data';

const {
  mockListRecentClientErrors,
  mockIsDashboardDatabaseConfigured,
  mockQueryDashboardDb,
  mockGetDashboardEnv,
  mockApplyObservabilityAlertThresholds,
  mockLoadPrometheusServiceMetrics,
  mockEnrichObservabilityServices,
} = vi.hoisted(() => ({
  mockListRecentClientErrors: vi.fn(),
  mockIsDashboardDatabaseConfigured: vi.fn(),
  mockQueryDashboardDb: vi.fn(),
  mockGetDashboardEnv: vi.fn(),
  mockApplyObservabilityAlertThresholds: vi.fn(),
  mockLoadPrometheusServiceMetrics: vi.fn(),
  mockEnrichObservabilityServices: vi.fn(),
}));

vi.mock('@/lib/client-error-store.server', () => ({ listRecentClientErrors: mockListRecentClientErrors }));
vi.mock('@/lib/db/postgres', () => ({
  isDashboardDatabaseConfigured: mockIsDashboardDatabaseConfigured,
  queryDashboardDb: mockQueryDashboardDb,
}));
vi.mock('@/lib/env', () => ({ getDashboardEnv: mockGetDashboardEnv }));
vi.mock('@/lib/observability-alert-thresholds', () => ({ applyObservabilityAlertThresholds: mockApplyObservabilityAlertThresholds }));
vi.mock('@/lib/prometheus-observability', () => ({
  loadPrometheusServiceMetrics: mockLoadPrometheusServiceMetrics,
  enrichObservabilityServices: mockEnrichObservabilityServices,
}));

import { listObservabilityServices, listScopedClientErrors } from '@/lib/observability.server';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDashboardEnv.mockReturnValue({ OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON: '{"defaults":{}}' });
  mockLoadPrometheusServiceMetrics.mockResolvedValue(new Map([['edge-router', { cpuPercent: 91 }]]));
  mockEnrichObservabilityServices.mockReturnValue([{ ...observabilityData[0], cpuPercent: 91 }]);
  mockApplyObservabilityAlertThresholds.mockReturnValue([{ ...observabilityData[0], status: 'critical', cpuPercent: 91, alerts: [{ metric: 'cpuPercent', severity: 'critical', actualValue: 91, thresholdValue: 90 }] }]);
});

describe('observability.server', () => {
  it('builds observability services from local fallback data and enrichment helpers', async () => {
    mockIsDashboardDatabaseConfigured.mockReturnValue(false);

    const result = await listObservabilityServices();

    expect(mockLoadPrometheusServiceMetrics).toHaveBeenCalledWith({ OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON: '{"defaults":{}}' });
    expect(mockEnrichObservabilityServices).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: observabilityData[0]?.name })]), expect.any(Map));
    expect(mockApplyObservabilityAlertThresholds).toHaveBeenCalledWith([{ ...observabilityData[0], cpuPercent: 91 }], '{"defaults":{}}');
    expect(result[0]?.status).toBe('critical');
  });

  it('loads observability services from the database when configured', async () => {
    mockIsDashboardDatabaseConfigured.mockReturnValue(true);
    mockQueryDashboardDb.mockResolvedValue({ rows: [{ ...observabilityData[0], cpuPercent: 64 }] });

    await listObservabilityServices();

    expect(mockQueryDashboardDb).toHaveBeenCalledWith(expect.stringContaining('FROM observability_services'));
    expect(mockEnrichObservabilityServices).toHaveBeenCalledWith([{ ...observabilityData[0], cpuPercent: 64 }], expect.any(Map));
  });

  it('uses the in-memory recent error store when the database is unavailable', async () => {
    mockIsDashboardDatabaseConfigured.mockReturnValue(false);
    mockListRecentClientErrors.mockReturnValue([{ id: 'err_1' }]);

    await expect(listScopedClientErrors({ tenantId: 'tenant_acme', appId: 'app_market_web' })).resolves.toEqual([{ id: 'err_1' }]);
    expect(mockListRecentClientErrors).toHaveBeenCalledWith({ tenantId: 'tenant_acme', appId: 'app_market_web' });
  });

  it('queries and maps scoped client errors from the database', async () => {
    mockIsDashboardDatabaseConfigured.mockReturnValue(true);
    mockQueryDashboardDb.mockResolvedValue({ rows: [{ id: 'err_2', tenant_id: 'tenant_acme', app_id: 'app_market_web', user_id: 'user_1', summary: 'boom', created_at: '2026-03-09T00:00:00.000Z', metadata_json: { kind: 'boundary', source: 'ui', message: 'boom', name: 'ErrorBoundary', pathname: '/audit', digest: 'abc' } }] });

    const result = await listScopedClientErrors({ tenantId: 'tenant_acme', appId: 'app_market_web' });

    expect(mockQueryDashboardDb).toHaveBeenCalledWith(expect.stringContaining('tenant_id = $1'), ['tenant_acme', 'app_market_web']);
    expect(result[0]).toMatchObject({ id: 'err_2', kind: 'boundary', pathname: '/audit', digest: 'abc', tenantId: 'tenant_acme', appId: 'app_market_web' });
  });
});

