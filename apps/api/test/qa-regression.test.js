// QA regression tests - Romit Tejani (QA), Week 2.
// Covers the Week 1 bugs (BUG-01) and data rules the checkout stock test will rely on.
// Tests marked { todo } describe CORRECT behaviour that is not built yet: they run and
// are reported, but a failure does not fail `npm test`. Remove `todo` once the developer
// fixes the bug, so the test becomes a normal regression guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/database.js';

const withDb = fn => () => {
  const db = openDatabase(':memory:');
  try { return fn(db); } finally { db.close(); }
};
const newVariant = (db, productId, sku, stock = 1) =>
  Number(db.prepare('INSERT INTO product_variants(product_id, sku, stock) VALUES(?, ?, ?)')
    .run(productId, sku, stock).lastInsertRowid);
const link = (db, variantId, optionValueId) =>
  db.prepare('INSERT INTO variant_values(variant_id, option_value_id) VALUES(?, ?)').run(variantId, optionValueId);

test('QA seed data: 3 products, 6/4/4 variants, stock totals 35/20/11', withDb(db => {
  const rows = db.prepare(`SELECT product_id AS p, count(*) AS n, sum(stock) AS s
    FROM product_variants GROUP BY product_id ORDER BY product_id`).all();
  assert.deepEqual(rows.map(r => [r.n, r.s]), [[6, 35], [4, 20], [4, 11]]);
}));

test('QA seed data: every variant has exactly one Size and one Colour', withDb(db => {
  const bad = db.prepare(`SELECT variant_id FROM variant_values vv
    JOIN option_values v ON v.id = vv.option_value_id GROUP BY variant_id
    HAVING count(*) != 2 OR count(DISTINCT v.option_type_id) != 2`).all();
  assert.equal(bad.length, 0);
}));

test('QA: stock cannot be negative, fractional or text; price cannot be 0', withDb(db => {
  for (const bad of ['-1', '2.5', "'abc'"]) {
    assert.throws(() => db.exec(`UPDATE product_variants SET stock = ${bad} WHERE id = 1`), `stock ${bad}`);
  }
  assert.throws(() => db.exec('UPDATE products SET price_cents = 0 WHERE id = 1'));
  assert.throws(() => db.exec("UPDATE products SET name = '   ' WHERE id = 1"));
}));

test('QA: duplicate SKU and invalid references are rejected', withDb(db => {
  assert.throws(() => newVariant(db, 1, 'DEMO-1-1'));
  assert.throws(() => newVariant(db, 999, 'QA-NOPRODUCT'));
  assert.throws(() => link(db, 1, 99999));
}));

test('QA: last-item rule at database level - stock can never go below zero', withDb(db => {
  // Variant 4 of product 1 has stock 5; set to 1, then two "orders" each take 1.
  db.exec('UPDATE product_variants SET stock = 1 WHERE id = 4');
  const take = () => db.prepare('UPDATE product_variants SET stock = stock - 1 WHERE id = 4').run();
  take();
  assert.throws(take, 'second purchase of the last item must fail');
  assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id = 4').get().stock, 0);
}));

// ---- Week 1 bugs (still open when this file was written) ----
test('BUG-01a: a variant with no options should be rejected', { todo: 'BUG-01 open' }, withDb(db => {
  const id = newVariant(db, 1, 'QA-NOOPT');
  const n = db.prepare('SELECT count(*) AS n FROM variant_values WHERE variant_id = ?').get(id).n;
  assert.ok(n > 0, 'variant was saved with no size/colour');
}));

test('BUG-01b: duplicate size+colour combination should be rejected', { todo: 'BUG-01 open' }, withDb(db => {
  // product 1: option value 1 = first size, 4 = first colour (already used by DEMO-1-1)
  const id = newVariant(db, 1, 'QA-DUP');
  link(db, id, 1);
  assert.throws(() => link(db, id, 4), 'duplicate combination accepted');
}));

test('BUG-01c: option value from another product should be rejected', { todo: 'BUG-01 open' }, withDb(db => {
  const foreign = db.prepare(`SELECT v.id FROM option_values v JOIN option_types t ON t.id = v.option_type_id
    WHERE t.product_id = 2 LIMIT 1`).get().id;
  const id = newVariant(db, 1, 'QA-CROSS');
  assert.throws(() => link(db, id, foreign), 'cross-product option accepted');
}));
