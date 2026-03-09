import type { ClientErrorRecord, ServiceHealth, SessionUser } from '@/types/platform';

import { listRecentClientErrors } from '@/lib/client-error-store.server';
import { isDashboardDatabaseConfigured, queryDashboardDb } from '@/lib/db/postgres';
import { getDashboardEnv } from '@/lib/env';
import { applyObservabilityAlertThresholds } from '@/lib/observability-alert-thresholds';
import {
  enrichObservabilityServices,
  loadPrometheusServiceMetrics,
} from '@/lib/prometheus-observability';
import { getScopeFilters } from '@/lib/scope';
import { observabilityData } from '@/mocks/platform-data';

type ClientErrorRow = {
  id: string;
  tenant_id: string | null;
  app_id: string | null;
  user_id: string | null;
  summary: string | null;
  created_at: Date | string;
  metadata_json: {
    kind?: ClientErrorRecord['kind'];
    source?: string;
    message?: string;
    pathname?: string | null;
    digest?: string | null;
    name?: string | null;
  } | null;
};

function mapClientErrorRow(row: ClientErrorRow): ClientErrorRecord {
  return {
    id: row.id,
    kind: row.metadata_json?.kind ?? 'window-error',
    source: row.metadata_json?.source ?? 'unknown',
    message: row.metadata_json?.message ?? row.summary ?? 'Unknown client error',
    name: row.metadata_json?.name ?? 'ClientError',
    pathname: row.metadata_json?.pathname ?? null,
    digest: row.metadata_json?.digest ?? null,
    occurredAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    tenantId: row.tenant_id,
    appId: row.app_id,
    userId: row.user_id,
  };
}

export async function listObservabilityServices(): Promise<ServiceHealth[]> {
  const env = getDashboardEnv();
  const baseServices = !isDashboardDatabaseConfigured()
    ? structuredClone(observabilityData)
    : (
        await queryDashboardDb<ServiceHealth>(
          `SELECT name, layer, status, cpu_percent AS "cpuPercent", memory_percent AS "memoryPercent", restarts_24h AS "restarts24h", endpoint
           FROM observability_services
           ORDER BY name ASC`,
        )
      ).rows;

  const metrics = await loadPrometheusServiceMetrics(env);
  return applyObservabilityAlertThresholds(
    enrichObservabilityServices(baseServices, metrics),
    env.OBSERVABILITY_SERVICE_ALERT_THRESHOLDS_JSON,
  );
}

export async function listScopedClientErrors(
  scope: Pick<SessionUser, 'tenantId' | 'appId'>,
): Promise<ClientErrorRecord[]> {
  if (!isDashboardDatabaseConfigured()) {
    return listRecentClientErrors(scope as SessionUser);
  }

  const filters = getScopeFilters(scope);
  const conditions = [`action = 'client_error'`];
  const values: Array<string | number> = [];

  if (filters.tenantId) {
    values.push(filters.tenantId);
    conditions.push(`tenant_id = $${values.length}`);
  }
  if (filters.appId) {
    values.push(filters.appId);
    conditions.push(`app_id = $${values.length}`);
  }

  const result = await queryDashboardDb<ClientErrorRow>(
    `SELECT id, tenant_id, app_id, user_id, summary, created_at, metadata_json
     FROM audit_logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT 25`,
    values,
  );

  return result.rows.map(mapClientErrorRow);
}
