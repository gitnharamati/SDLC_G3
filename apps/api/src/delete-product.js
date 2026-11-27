import { OrderError } from './order-store.js';
import { transaction } from './postgres/database.js';

// Remove only this product's dependent records, in one transaction. The
// combination requirement is deferred until commit, after variants are gone.
export async function deleteProduct(db, id) {
  const statements = [
    'DELETE FROM variant_values WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)',
    'DELETE FROM product_variants WHERE product_id = ?',
    'DELETE FROM option_values WHERE option_type_id IN (SELECT id FROM option_types WHERE product_id = ?)',
    'DELETE FROM option_types WHERE product_id = ?',
    'DELETE FROM product_photos WHERE product_id = ?',
    'DELETE FROM products WHERE id = ?'
  ];
  if (db.kind === 'postgres') {
    return transaction(db.pool, async client => {
      if (!(await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id])).rowCount) return false;
      if ((await client.query('SELECT 1 FROM order_lines WHERE product_id=$1 LIMIT 1',[id])).rowCount) throw new OrderError('This product has orders. Hide it instead.','PRODUCT_HAS_ORDERS',409);
      for (const sql of statements) await client.query(sql.replace('?', '$1'), [id]);
      return true;
    });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) {
      db.exec('COMMIT'); return false;
    }
    if (db.prepare('SELECT 1 FROM order_lines WHERE product_id=? LIMIT 1').get(id)) throw new OrderError('This product has orders. Hide it instead.','PRODUCT_HAS_ORDERS',409);
    for (const sql of statements) db.prepare(sql).run(id);
    db.exec('COMMIT'); return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
