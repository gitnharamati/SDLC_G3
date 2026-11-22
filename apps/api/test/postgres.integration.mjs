import { deleteWorkflow } from './delete-workflow.mjs';
import sharp from 'sharp';
import { preparePhotos } from '../src/photos.js';
import { photoWorkflow } from './photo-workflow.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';
import { openPostgres, transaction, sampleSnapshot } from '../src/postgres/database.js';
import { postgresSnapshot } from '../src/postgres/snapshot.js';
import { importSqliteFile } from '../src/postgres/import-sqlite.js';
import { addProduct } from '../src/product-editor.js';
import { getProducts } from '../src/catalogue.js';

const connection = process.env.TEST_DATABASE_URL;
test('PostgreSQL persistence, imports and admin API', { skip: !connection && 'Set TEST_DATABASE_URL to a disposable PostgreSQL database' }, async t => {
  const schema = 'sdlc_test_' + Date.now();
  const admin = new pg.Client({ connectionString: connection });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(connection);
  scoped.searchParams.set('options', '-c search_path=' + schema);
  const url = scoped.toString();
  let db;
  const folder = mkdtempSync(join(tmpdir(), 'sdlc-import-'));
  const validPath = join(folder, 'products.sqlite');
  const invalidPath = join(folder, 'invalid.sqlite');
  let source = openDatabase(validPath);
  source.prepare('UPDATE product_variants SET stock = 99 WHERE id = 1').run();
  const importPhoto = await preparePhotos([{ mimetype: 'image/png', buffer: await sharp({ create: { width: 40, height: 30, channels: 3, background: '#667744' } }).png().toBuffer() }]);
  addProduct(source, {
    name: 'Imported cushion', material: 'Cotton', description: 'Existing product from SQLite.',
    priceCents: 3200, departmentId: 1, categoryId: 1, roomId: 4, available: true,
    sizes: ['Small'], colours: ['Sage'], stock: [15]
  }, importPhoto);
  source.close();
  try {
    db = await openPostgres(url);
    await t.test('fresh PostgreSQL schema and sample data match SQLite', async () => {
      assert.deepEqual(await postgresSnapshot(db.pool), sampleSnapshot());
      assert.equal((await getProducts(db))[0].variants.length, 6);
    });
    await t.test('incomplete and cross-product variants are rejected at the database level', async () => {
      await assert.rejects(transaction(db.pool, async client => {
        await client.query("INSERT INTO product_variants(product_id, sku) VALUES(1, 'INCOMPLETE')");
      }), /foreign key/i);
      await assert.rejects(transaction(db.pool, async client => {
        const { rows: [row] } = await client.query("INSERT INTO product_variants(product_id, sku) VALUES(1, 'CROSS') RETURNING id");
        await client.query('INSERT INTO variant_values VALUES($1, 7)', [row.id]);
      }), /of this product/i);
      await assert.rejects(transaction(db.pool, async client => {
        const { rows: [row] } = await client.query("INSERT INTO product_variants(product_id, sku) VALUES(1, 'DUPLICATE') RETURNING id");
        await client.query('INSERT INTO variant_values VALUES($1, 1)', [row.id]);
        await client.query('INSERT INTO variant_values VALUES($1, 4)', [row.id]);
      }), /duplicate key/i);
    });
    await t.test('SQLite import preserves products, stock and IDs, and supports a safe repeat', async () => {
      const imported = await importSqliteFile(db, validPath);
      assert.equal(imported.products, 4);
      assert.equal(imported.imported, true);
      const storedPhoto = (await db.pool.query('SELECT mime_type, data FROM product_photos WHERE product_id = 4')).rows[0];
      assert.equal(storedPhoto.mime_type, 'image/jpeg');
      assert.deepEqual(storedPhoto.data, importPhoto[0].data);
      assert.equal((await getProducts(db)).find(p => p.id === 1).variants[0].stock, 99);
      assert.equal((await importSqliteFile(db, validPath)).imported, false);
    });
    await t.test('startup and seed are repeatable without resetting imported stock', async () => {
      await db.close();
      db = await openPostgres(url);
      assert.equal((await getProducts(db)).length, 4);
      assert.equal((await getProducts(db))[0].variants[0].stock, 99);
    });
    await t.test('admin saves to PostgreSQL, hidden products stay hidden, bad data is rejected', async () => {
      const password = 'test-admin-password-only';
      const server = createApp(db, { password }).listen(0, '127.0.0.1');
      await once(server, 'listening');
      const base = `http://127.0.0.1:${server.address().port}/api`;
      const post = (path, data, cookie = '') => fetch(base + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1', Cookie: cookie },
        body: JSON.stringify(data)
      });
      const item = {
        name: 'Postgres cushion', material: 'Cotton', description: 'Saved through the API.',
        priceCents: 2999, departmentId: 1, categoryId: 1, roomId: 4, available: true,
        sizes: ['Small', 'Large'], colours: ['Sand', 'Sage'], stock: [1, 0, 5, 8]
      };
      try {
        assert.equal((await post('/admin/products', item)).status, 401);
        const cookie = (await post('/admin/login', { password })).headers.get('set-cookie').split(';')[0];
        const saved = await post('/admin/products', item, cookie);
        assert.equal(saved.status, 201);
        const id = (await saved.json()).product.id;
        assert.ok(id > 4, 'import advanced generated IDs');
        assert.equal((await post('/admin/products', { ...item, categoryId: 2 }, cookie)).status, 400);
        assert.equal((await post('/admin/products', { ...item, stock: [-1, 0, 5, 8] }, cookie)).status, 400);
        assert.equal((await post('/admin/products', { ...item, available: false, name: 'Hidden PG item' }, cookie)).status, 201);
        const products = (await (await fetch(base + '/products')).json()).products;
        assert.deepEqual(products.find(p => p.id === id).variants.map(v => v.stock), item.stock);
        assert.ok(!products.some(p => p.name === 'Hidden PG item'));
        assert.equal((await (await fetch(base + '/health')).json()).storage, 'postgres');
        assert.equal((await (await fetch(base + '/catalogue')).json()).departments[0].categories.length, 3);
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('an import cannot replace data already added to PostgreSQL', async () => {
      const before = await postgresSnapshot(db.pool);
      await assert.rejects(importSqliteFile(db, validPath), /already has changed/);
      assert.deepEqual(await postgresSnapshot(db.pool), before);
    });
    await t.test('app restart keeps newly added products and stock', async () => {
      await db.close();
      db = await openPostgres(url);
      assert.equal((await getProducts(db)).find(p => p.name === 'Postgres cushion').variants[3].stock, 8);
    });
    await t.test('invalid SQLite snapshot rolls back completely in an empty test target', async () => {
      // Use a separate schema so no user data is ever cleared to run this test.
      const otherSchema = schema + '_bad';
      await admin.query(`CREATE SCHEMA ${otherSchema}`);
      const otherUrl = new URL(connection);
      otherUrl.searchParams.set('options', '-c search_path=' + otherSchema);
      const other = await openPostgres(otherUrl.toString());
      const bad = openDatabase(invalidPath);
      bad.exec('DROP TRIGGER variant_requires_combination');
      bad.exec("INSERT INTO product_variants(product_id, sku, stock) VALUES(1, 'MISSING', 10)");
      bad.close();
      try {
        await assert.rejects(importSqliteFile(other, invalidPath), /foreign key/i);
        assert.deepEqual(await postgresSnapshot(other.pool), sampleSnapshot());
      } finally {
        await other.close();
        await admin.query(`DROP SCHEMA ${otherSchema} CASCADE`);
      }
    });
    await t.test('PostgreSQL product deletion and atomic rollback', async deletionTest => {
      const deleteSchema = schema + '_delete';
      await admin.query(`CREATE SCHEMA ${deleteSchema}`);
      const deleteUrl = new URL(connection);
      deleteUrl.searchParams.set('options', '-c search_path=' + deleteSchema);
      const deletionDb = await openPostgres(deleteUrl.toString());
      try { await deleteWorkflow(deletionDb, deletionTest); }
      finally { await deletionDb.close(); await admin.query(`DROP SCHEMA ${deleteSchema} CASCADE`); }
    });
    await t.test('PostgreSQL product photo uploads, editing, visibility and persistence', async photoTest => {
      const photoSchema = schema + '_photos';
      await admin.query(`CREATE SCHEMA ${photoSchema}`);
      const photoUrl = new URL(connection);
      photoUrl.searchParams.set('options', '-c search_path=' + photoSchema);
      try {
        await photoWorkflow(await openPostgres(photoUrl.toString()), () => openPostgres(photoUrl.toString()), photoTest);
      } finally { await admin.query(`DROP SCHEMA ${photoSchema} CASCADE`); }
    });
  } finally {
    await db?.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    rmSync(folder, { recursive: true, force: true });
  }
});
