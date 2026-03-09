import { setTimeout as delay } from 'node:timers/promises';

import pg from 'pg';

const { Pool } = pg;

function isRetryableDatabaseError(error) {
  return error instanceof Error && ['ECONNRESET', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(error.code ?? '');
}

export function createControlPlaneDb(config) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize the control-plane Postgres pool.');
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  return {
    async query(text, values = []) {
      let attempt = 0;

      while (true) {
        try {
          return await pool.query(text, values);
        } catch (error) {
          attempt += 1;
          if (attempt >= config.databaseRetryAttempts || !isRetryableDatabaseError(error)) {
            throw error;
          }

          await delay(config.databaseRetryBackoffMs * attempt);
        }
      }
    },
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const scopedDb = {
          query(text, values = []) {
            return client.query(text, values);
          },
        };
        const result = await callback(scopedDb);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close() {
      return pool.end();
    },
  };
}