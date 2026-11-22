// Fixed table and column names only; user input never supplies SQL identifiers.
export const tables = {
  departments: ['id', 'name'],
  categories: ['id', 'department_id', 'name'],
  subcategories: ['id', 'category_id', 'name'],
  products: ['id', 'subcategory_id', 'name', 'description', 'material', 'price_cents', 'available'],
  product_photos: ['id', 'product_id', 'path', 'position', 'mime_type', 'data'],
  option_types: ['id', 'product_id', 'name'],
  option_values: ['id', 'option_type_id', 'value'],
  product_variants: ['id', 'product_id', 'sku', 'stock'],
  variant_values: ['variant_id', 'option_value_id'],
  seed_versions: ['version']
};

export function sqliteSnapshot(db) {
  return Object.fromEntries(Object.entries(tables).map(([table, columns]) => {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
    const selected = columns.map(column => existing.has(column) ? column :
      column === 'mime_type' ? "'image/jpeg' AS mime_type" : 'NULL AS ' + column);
    const rows = db.prepare(`SELECT ${selected.join(', ')} FROM ${table} ORDER BY ${columns.filter(column => column !== 'data').join(', ')}`).all();
    return [table, rows.map(row => ({ ...row, ...(table === 'product_photos' && row.data ? { data: Buffer.from(row.data) } : {}) }))];
  }));
}

export async function postgresSnapshot(client) {
  const snapshot = {};
  for (const [table, columns] of Object.entries(tables)) {
    snapshot[table] = (await client.query(`SELECT ${columns.join(', ')} FROM ${table} ORDER BY ${columns.join(', ')}`)).rows;
  }
  return snapshot;
}

export async function insertSnapshot(client, snapshot) {
  for (const [table, columns] of Object.entries(tables)) {
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(', ')})`;
    for (const row of snapshot[table]) await client.query(sql, columns.map(column => row[column]));
  }
  await client.query('SET CONSTRAINTS ALL IMMEDIATE');
  for (const [table, columns] of Object.entries(tables)) {
    if (columns[0] === 'id') {
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'),
        COALESCE((SELECT max(id) FROM ${table}), 1), EXISTS(SELECT 1 FROM ${table}))`);
    }
  }
}
