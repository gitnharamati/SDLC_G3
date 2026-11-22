import { openPostgres } from '../apps/api/src/postgres/database.js';
import { importSqliteFile } from '../apps/api/src/postgres/import-sqlite.js';

const filename = process.argv[2];
if (!process.env.DATABASE_URL || !filename) {
  console.error('Set DATABASE_URL, then run: npm.cmd run db:import -- "C:\\path\\to\\backup.sqlite"');
  process.exit(1);
}
let store;
try {
  store = await openPostgres(process.env.DATABASE_URL);
  console.log(await importSqliteFile(store, filename));
} catch (error) {
  // Connection errors can contain host/account information; do not print URLs.
  if (error.message.startsWith('The hosted database') || error.message.startsWith('The SQLite backup')) {
    console.error(error.message);
  } else {
    console.error('Import failed. Check the connection, backup file and its product combinations. No partial import was committed.');
  }
  process.exitCode = 1;
} finally { await store?.close(); }
