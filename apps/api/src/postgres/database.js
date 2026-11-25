import pg from 'pg';
import { readFileSync } from 'node:fs';
import { openDatabase } from '../database.js';
import { sqliteSnapshot, insertSnapshot } from './snapshot.js';

export function sampleSnapshot() {
  const db = openDatabase(':memory:');
  try { return sqliteSnapshot(db); } finally { db.close(); }
}

export async function transaction(pool, action) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function openPostgres(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  // Keep certificate verification enabled for remote databases.
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(parameter);
  const pool = new pg.Pool({
    connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: true },
    max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 10000
  });
  pool.on('error', () => console.error('An idle database connection closed. New requests will reconnect.'));
  try {
    await transaction(pool, async client => {
      // Serialize startup migrations and imports across processes.
      await client.query('SELECT pg_advisory_xact_lock(210312)');
      await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
      if (!(await client.query('SELECT 1 FROM schema_migrations WHERE version = 1')).rowCount) {
        await client.query(readFileSync(new URL('./001-schema.sql', import.meta.url), 'utf8'));
        await client.query('INSERT INTO schema_migrations VALUES(1)');
      }
      if (!(await client.query('SELECT 1 FROM schema_migrations WHERE version = 2')).rowCount) {
        await client.query(readFileSync(new URL('./002-product-photos.sql', import.meta.url), 'utf8'));
        await client.query('INSERT INTO schema_migrations VALUES(2)');
      }
      if (!(await client.query('SELECT 1 FROM schema_migrations WHERE version = 3')).rowCount) {
        await client.query(readFileSync(new URL('./003-product-audit.sql', import.meta.url), 'utf8'));
        await client.query('INSERT INTO schema_migrations VALUES(3)');
      }
      const seeded = (await client.query('SELECT 1 FROM seed_versions WHERE version = 1')).rowCount;
      if (!seeded) {
        const occupied = (await client.query('SELECT 1 FROM departments LIMIT 1')).rowCount;
        if (occupied) throw new Error('Database contains unrecognised data; refusing to overwrite it.');
        await insertSnapshot(client, sampleSnapshot());
      }
    });
    return { kind: 'postgres', pool, close: () => pool.end() };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
