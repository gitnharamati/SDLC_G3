import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { transaction, sampleSnapshot } from './database.js';
import { sqliteSnapshot, postgresSnapshot, insertSnapshot, tables } from './snapshot.js';

export async function importSqliteFile(store, filename) {
  const source = new DatabaseSync(resolve(filename), { readOnly: true });
  let snapshot;
  try {
    if (source.prepare('PRAGMA foreign_key_check').all().length) {
      throw new Error('The SQLite backup has broken references. No data was imported.');
    }
    snapshot = sqliteSnapshot(source);
  } finally { source.close(); }
  return transaction(store.pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(210312)');
    // Block product writes while checking and importing; readers can continue.
    await client.query(`LOCK TABLE ${Object.keys(tables).join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
    const current = await postgresSnapshot(client);
    if (JSON.stringify(current) === JSON.stringify(snapshot)) {
      return { imported: false, products: snapshot.products.length, message: 'The same data is already present.' };
    }
    const empty = Object.values(current).every(rows => rows.length === 0);
    if (!empty && JSON.stringify(current) !== JSON.stringify(sampleSnapshot())) {
      throw new Error('The hosted database already has changed or added data. Import stopped without replacing it.');
    }
    await client.query(`DELETE FROM variant_values;
      DELETE FROM variant_requirements; DELETE FROM variant_combinations;
      DELETE FROM product_variants; DELETE FROM product_photos; DELETE FROM option_values;
      DELETE FROM option_types; DELETE FROM products; DELETE FROM subcategories;
      DELETE FROM categories; DELETE FROM departments; DELETE FROM seed_versions;`);
    await insertSnapshot(client, snapshot);
    const imported = await postgresSnapshot(client);
    if (JSON.stringify(imported) !== JSON.stringify(snapshot)) throw new Error('Import verification failed.');
    return { imported: true, products: snapshot.products.length, message: 'Imported and verified names, IDs, options, prices and stock.' };
  });
}
