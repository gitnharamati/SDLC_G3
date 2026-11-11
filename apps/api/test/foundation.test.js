import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, seedDatabase } from '../src/database.js';
import { createApp } from '../src/app.js';

test('launch hierarchy contains three categories and five rooms per category', () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal(db.prepare('SELECT count(*) AS n FROM departments').get().n, 1);
    assert.equal(db.prepare('SELECT count(*) AS n FROM categories').get().n, 3);
    assert.equal(db.prepare('SELECT count(*) AS n FROM subcategories').get().n, 15);
    seedDatabase(db);
    assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 3);
    assert.equal(db.prepare('SELECT count(*) AS n FROM product_variants WHERE product_id = 1').get().n, 6);
  } finally { db.close(); }
});

test('database rejects invalid stock, prices and missing hierarchy references', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() => db.prepare('UPDATE product_variants SET stock = -1 WHERE id = 1').run());
    assert.throws(() => db.prepare('UPDATE product_variants SET stock = 2.5 WHERE id = 1').run());
    assert.throws(() => db.prepare('UPDATE products SET price_cents = 0 WHERE id = 1').run());
    assert.throws(() => db.prepare('UPDATE products SET subcategory_id = 999 WHERE id = 1').run());
  } finally { db.close(); }
});

test('restart preserves changed stock and does not duplicate sample data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'decor-test-'));
  const path = join(directory, 'test.sqlite');
  let db;
  try {
    db = openDatabase(path);
    db.prepare('UPDATE product_variants SET stock = 99 WHERE id = 1').run();
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT stock FROM product_variants WHERE id = 1').get().stock, 99);
    assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 3);
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('API reads SQLite data, returns errors for unknown routes and exposes no writes', async () => {
  const db = openDatabase(':memory:');
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await (await fetch(`${url}/api/health`)).json()).database, 'connected');
    const catalogue = await (await fetch(`${url}/api/catalogue`)).json();
    assert.equal(catalogue.departments[0].categories.length, 3);
    const response = await fetch(`${url}/api/products`);
    assert.equal(response.status, 200);
    const { products } = await response.json();
    assert.equal(products[0].priceCents, 2499);
    assert.equal(products[0].variants.length, 6);
    assert.equal(products[0].variants[0].options.length, 2);
    db.prepare('UPDATE product_variants SET stock = 42 WHERE id = 1').run();
    const changed = await (await fetch(`${url}/api/products`)).json();
    assert.equal(changed.products[0].variants[0].stock, 42);
    db.prepare('UPDATE products SET available = 0 WHERE id = 1').run();
    const visible = await (await fetch(`${url}/api/products`)).json();
    assert.deepEqual(visible.products.map(product => product.id), [2, 3]);
    assert.equal((await fetch(`${url}/api/missing`)).status, 404);
    assert.equal((await fetch(`${url}/api/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

test('database prevents incomplete, duplicate, and cross-product variant combinations', () => {
  const db = openDatabase(':memory:');
  try {
    const create = () => Number(db.prepare("INSERT INTO product_variants(product_id, sku) VALUES (1, 'QA-NEW')").run().lastInsertRowid);
    const link = (id, option) => db.prepare('INSERT INTO variant_values VALUES (?, ?)').run(id, option);
    const tryCombination = action => {
      db.exec('BEGIN');
      try { action(create()); } finally { db.exec('ROLLBACK'); }
    };
    assert.throws(create, /FOREIGN KEY/);
    assert.throws(() => tryCombination(id => { link(id, 1); db.exec('COMMIT'); }), /FOREIGN KEY/);
    assert.throws(() => tryCombination(id => { link(id, 1); link(id, 4); }), /UNIQUE/);
    assert.throws(() => tryCombination(id => link(id, 7)), /of this product/);
    assert.throws(() => tryCombination(id => { link(id, 1); link(id, 2); }), /already has an option/);
    assert.throws(() => db.exec('DELETE FROM variant_values WHERE variant_id = 1'), /FOREIGN KEY/);
    db.exec('BEGIN');
    const size = Number(db.prepare("INSERT INTO option_values(option_type_id, value) VALUES (1, '60 × 60 cm')").run().lastInsertRowid);
    const id = create();
    link(id, size);
    link(id, 4);
    db.exec('COMMIT');
    assert.equal(db.prepare('SELECT count(*) AS n FROM variant_values WHERE variant_id = ?').get(id).n, 2);
  } finally { db.close(); }
});
