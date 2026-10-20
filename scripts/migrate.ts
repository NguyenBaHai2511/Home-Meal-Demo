import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PoolClient } from 'pg';
import { pool, requireDatabaseUrl } from '../server/db.js';

let client: PoolClient | undefined;

try {
  requireDatabaseUrl();
  client = await pool.connect();
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');

  const directory = resolve(process.cwd(), 'db/migrations');
  const files = (await readdir(directory))
    .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  for (const file of files) {
    const sql = await readFile(resolve(directory, file), 'utf8');
    await client.query('BEGIN');
    try {
      // Transaction-scoped locking also works through Neon/PgBouncer pooled URLs.
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [2784, 2]);
      const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if (alreadyApplied.rowCount) {
        await client.query('COMMIT');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  console.log('Database migrations are up to date.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (client) {
    client.release();
  }
  await pool.end();
}
