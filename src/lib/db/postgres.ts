import { setTimeout as delay } from 'node:timers/promises';

import { Pool, type QueryResultRow } from 'pg';

import { getDashboardEnv } from '@/lib/env';

declare global {
  var __dashboardPostgresPool: Pool | undefined;
}

function isRetryableDatabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return ['ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(
    (error as Error & { code?: string }).code ?? '',
  );
}

export function isDashboardDatabaseConfigured() {
  return Boolean(getDashboardEnv().DATABASE_URL);
}

function getPool() {
  if (globalThis.__dashboardPostgresPool) {
    return globalThis.__dashboardPostgresPool;
  }

  const env = getDashboardEnv();
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to initialize the dashboard Postgres pool.');
  }

  globalThis.__dashboardPostgresPool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });

  return globalThis.__dashboardPostgresPool;
}

export async function queryDashboardDb<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
) {
  const env = getDashboardEnv();
  let attempt = 0;

  while (true) {
    try {
      return await getPool().query<T>(text, values);
    } catch (error) {
      attempt += 1;
      if (attempt >= env.DATABASE_RETRY_ATTEMPTS || !isRetryableDatabaseError(error)) {
        throw error;
      }

      await delay(env.DATABASE_RETRY_BACKOFF_MS * attempt);
    }
  }
}

export async function resetDashboardDbPoolForTests() {
  if (!globalThis.__dashboardPostgresPool) {
    return;
  }

  await globalThis.__dashboardPostgresPool.end();
  globalThis.__dashboardPostgresPool = undefined;
}
