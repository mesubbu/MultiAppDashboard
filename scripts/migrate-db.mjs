import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run db:migrate');
}

const migrationsDir = path.resolve(process.cwd(), 'drizzle');
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort();

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set((await client.query('SELECT id FROM schema_migrations')).rows.map((row) => row.id));

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
    await client.query('COMMIT');
    console.log(`[db:migrate] applied ${file}`);
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
