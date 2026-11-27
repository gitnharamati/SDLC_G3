import { OrderError } from './order-store.js';
import { transaction } from './postgres/database.js';
import { ProductInputError } from './product-editor.js';

function validEdit(input) {
  const fields = {};
  for (const [key, limit] of [['name', 120], ['description', 2000], ['material', 120]]) {
    const value = typeof input?.[key] === 'string' ? input[key].trim() : '';
    if (!value || value.length > limit) throw new ProductInputError('Enter a valid ' + key + '.');
    fields[key] = value;
  }
  const { priceCents, available, stock } = input;
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 || priceCents > 99999999 ||
      typeof available !== 'boolean' || !Array.isArray(stock) || stock.length < 1 || stock.length > 144 ||
      stock.some(row => !row || !Number.isSafeInteger(row.id) || !Number.isSafeInteger(row.quantity) ||
        row.quantity < 0 || row.quantity > 999999) || new Set(stock.map(row => row.id)).size !== stock.length) {
    throw new ProductInputError('Check the price, visibility and whole stock quantities.');
  }
  return { ...fields, priceCents, available, stock };
}

function checkVariantIds(current, stock, ordered = false) {
  if (stock.some(row => (ordered && !Number.isSafeInteger(row.expectedStock)) || (row.expectedStock !== undefined && current.find(v => v.id === row.id)?.stock !== row.expectedStock))) {
    throw new OrderError('Stock changed while you were editing. Reload the latest numbers before saving.','STOCK_CHANGED',409);
  }
  if (current.length !== stock.length || stock.some(row => !current.some(variant => variant.id === row.id))) {
    throw new ProductInputError('The stock rows no longer match this product. Reload the product and try again.');
  }
}

export async function updateProduct(db, id, input, actor = 'admin') {
  const { name, description, material, priceCents, available, stock } = validEdit(input);
  if (db.kind === 'postgres') return transaction(db.pool, async client => {
    if (!(await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [id])).rowCount) return false;
    const current = (await client.query('SELECT id,stock FROM product_variants WHERE product_id = $1 ORDER BY id FOR UPDATE', [id])).rows;
    checkVariantIds(current, stock, (await client.query('SELECT 1 FROM order_lines WHERE product_id=$1 LIMIT 1',[id])).rowCount > 0);
    await client.query('UPDATE products SET name=$1, description=$2, material=$3, price_cents=$4, available=$5 WHERE id=$6',
      [name, description, material, priceCents, Number(available), id]);
    for (const row of stock) {
      await client.query('UPDATE product_variants SET stock=$1 WHERE id=$2 AND product_id=$3', [row.quantity, row.id, id]);
      const before=current.find(v=>v.id===row.id).stock;
      if(before!==row.quantity) await client.query('INSERT INTO stock_adjustments(variant_id,product_name,previous_stock,new_stock,reason,actor,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,name,before,row.quantity,'Product editor update',actor,new Date().toISOString()]);
    }
    return true;
  });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT id FROM products WHERE id=?').get(id)) { db.exec('ROLLBACK'); return false; }
    const current=db.prepare('SELECT id,stock FROM product_variants WHERE product_id=?').all(id);
    checkVariantIds(current, stock, !!db.prepare('SELECT 1 FROM order_lines WHERE product_id=? LIMIT 1').get(id));
    db.prepare('UPDATE products SET name=?, description=?, material=?, price_cents=?, available=? WHERE id=?')
      .run(name, description, material, priceCents, Number(available), id);
    for (const row of stock) {
      db.prepare('UPDATE product_variants SET stock=? WHERE id=? AND product_id=?').run(row.quantity, row.id, id);
      const before=current.find(v=>v.id===row.id).stock;
      if(before!==row.quantity) db.prepare('INSERT INTO stock_adjustments(variant_id,product_name,previous_stock,new_stock,reason,actor,created_at) VALUES(?,?,?,?,?,?,?)').run(row.id,name,before,row.quantity,'Product editor update',actor,new Date().toISOString());
    }
    db.exec('COMMIT'); return true;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
