import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';

const password = 'local-test-password-only';
const product = {
  name: 'Woven cushion', description: 'Cotton cover for a sofa.', material: 'Cotton',
  priceCents: 2999, departmentId: 1, categoryId: 1, roomId: 4, available: true,
  sizes: ['45 × 45 cm', '50 × 50 cm'], colours: ['Sand', 'Sage'], stock: [5, 0, 2, 3]
};

async function serve(db) {
  const server = createApp(db, { password }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api`;
  return {
    post: (path, body, headers = {}) => fetch(url + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1', ...headers },
      body: JSON.stringify(body)
    }),
    shop: async () => (await (await fetch(url + '/products')).json()).products,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

test('admin can save and publish products with stock per size and colour; hidden products stay out of the shop', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'decor-product-'));
  const path = join(folder, 'catalogue.sqlite');
  let db = openDatabase(path);
  let api = await serve(db);
  try {
    assert.equal((await api.post('/admin/products', product)).status, 401);
    const login = await api.post('/admin/login', { password });
    assert.equal(login.status, 200);
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    assert.equal((await api.post('/admin/products', product, { Cookie, 'X-Admin-Request': '0' })).status, 403);
    const response = await api.post('/admin/products', product, { Cookie });
    assert.equal(response.status, 201);
    const created = (await response.json()).product;
    assert.equal(created.variantCount, 4);
    const hidden = await api.post('/admin/products', { ...product, name: 'Hidden cushion', available: false }, { Cookie });
    assert.equal(hidden.status, 201);
    const hiddenId = (await hidden.json()).product.id;
    assert.equal(db.prepare('SELECT available FROM products WHERE id = ?').get(hiddenId).available, 0);
    assert.equal((await api.post('/admin/logout', {}, { Cookie })).status, 204);
    assert.equal((await api.post('/admin/products', product, { Cookie })).status, 401);
    await api.close();
    db.close();
    db = openDatabase(path);
    api = await serve(db);
    const shop = await api.shop();
    const visible = shop.find(item => item.id === created.id);
    assert.equal(visible.name, product.name);
    assert.equal(visible.priceCents, product.priceCents);
    assert.equal(visible.room, 'Living room');
    assert.deepEqual(visible.variants.map(row => row.stock), product.stock);
    assert.deepEqual(visible.variants.map(row => row.options.map(option => option.value)),
      product.sizes.flatMap(size => product.colours.map(colour => [size, colour])));
    assert.ok(!shop.some(item => item.id === hiddenId));
  } finally {
    await api.close();
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('admin product creation rejects bad placement, price, duplicate options and invalid stock without saving partial rows', async () => {
  const db = openDatabase(':memory:');
  const api = await serve(db);
  try {
    const login = await api.post('/admin/login', { password });
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    for (const invalid of [
      { departmentId: 99 }, { categoryId: 2 }, { roomId: 999 }, { priceCents: 0 },
      { sizes: ['45 × 45 cm', '45 × 45 CM'] }, { colours: [''] },
      { stock: [5, 0, 2, -1] }, { stock: [5, 0, 2, 1.5] }, { stock: [5] }
    ]) {
      const result = await api.post('/admin/products', { ...product, ...invalid }, { Cookie });
      assert.equal(result.status, 400, JSON.stringify(invalid));
      assert.ok((await result.json()).error);
    }
    assert.equal(db.prepare('SELECT count(*) AS n FROM products').get().n, 3);
    assert.equal(db.prepare('SELECT count(*) AS n FROM product_variants').get().n, 14);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    await api.close();
    db.close();
  }
});
