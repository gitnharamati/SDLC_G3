import { fileURLToPath } from 'node:url';
import { openDatabase } from './database.js';
import { openPostgres } from './postgres/database.js';
import { createApp } from './app.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL to the hosted PostgreSQL database connection string. Production will not use a temporary SQLite file.');
  process.exit(1);
}
let db;
try {
  db = process.env.DATABASE_URL
    ? await openPostgres(process.env.DATABASE_URL)
    : openDatabase(process.env.DATABASE_PATH || fileURLToPath(new URL('../data/home-decor.sqlite', import.meta.url)));
} catch {
  console.error('Database startup failed. Check the connection, credentials and schema permissions. No fallback database was started.');
  process.exit(1);
}
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1');
const server = createApp(db, {
  password: process.env.ADMIN_PASSWORD,
  username: process.env.ADMIN_USERNAME || 'admin',
  secure: production,
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0)
}).listen(port, host, () => {
  console.log(`Home Decor API listening on port ${port} using ${db.kind === 'postgres' ? 'PostgreSQL' : 'local SQLite'}.`);
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 25000);
  timeout.unref();
  server.close(async () => {
    try { await db.close(); process.exit(0); } catch { process.exit(1); }
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
