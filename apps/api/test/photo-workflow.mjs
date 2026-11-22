import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

export async function photoWorkflow(db, reopen, t) {
  const password = 'photos-test-password-only';
  let server = createApp(db, { password }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  let base = `http://127.0.0.1:${server.address().port}`;
  const json = (path, body, cookie = '') => fetch(base + '/api/admin' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1', Cookie: cookie },
    body: JSON.stringify(body)
  });
  const red = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#d34c3d' } }).png().toBuffer();
  const green = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#20865c' } }).png().toBuffer();
  const upload = (path, metadata, photos, cookie = '', custom = true) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(metadata)) form.append(key, JSON.stringify(value));
    for (const photo of photos) form.append('photos', new Blob([photo.bytes], { type: photo.type || 'image/png' }), photo.name || 'product.png');
    return fetch(base + '/api/admin' + path, {
      method: 'POST', headers: { Cookie: cookie, ...(custom ? { 'X-Admin-Request': '1' } : {}) }, body: form
    });
  };
  let cookie;
  const signIn = async () => cookie = (await json('/login', { password })).headers.get('set-cookie').split(';')[0];
  const item = { name: 'Photographed cushion', description: 'A real product picture.', material: 'Cotton',
    priceCents: 2999, departmentId: 1, categoryId: 1, roomId: 4, available: true,
    sizes: ['Small'], colours: ['Red', 'Green'], stock: [4, 9] };
  try {
    await t.test('photo and inventory endpoints require an admin session and request header', async () => {
      assert.equal((await upload('/products', { product: item }, [{ bytes: red }])).status, 401);
      assert.equal((await fetch(base + '/api/admin/products')).status, 401);
      await signIn();
      assert.equal((await upload('/products', { product: item }, [{ bytes: red }], cookie, false)).status, 403);
    });
    let id;
    await t.test('creating a product stores photos and returns actual JPEGs to the shop', async () => {
      const result = await upload('/products', { product: item }, [{ bytes: red }, { bytes: green }], cookie);
      assert.equal(result.status, 201, await result.clone().text());
      id = (await result.json()).product.id;
      const list = (await (await fetch(base + '/api/products')).json()).products;
      const product = list.find(p => p.id === id);
      assert.equal(product.photos.length, 2);
      const response = await fetch(base + product.photos[0]);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/jpeg');
      const image = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
      assert.equal(image.format, 'jpeg');
      assert.equal(image.width, 40);
      assert.ok(!image.exif);
    });
    await t.test('invalid images, too many files, oversized files and bad stock do not save products', async () => {
      for (const files of [
        [{ bytes: Buffer.from('<svg onload="alert(1)"/>'), type: 'image/svg+xml' }],
        [{ bytes: Buffer.from('not really an image'), type: 'image/png' }],
        Array(5).fill({ bytes: red }),
        [{ bytes: Buffer.alloc(5 * 1024 * 1024 + 1), type: 'image/jpeg' }]
      ]) {
        const result = await upload('/products', { product: item }, files, cookie);
        assert.ok([400, 413].includes(result.status));
      }
      assert.equal((await upload('/products', { product: { ...item, stock: [-1, 9] } }, [{ bytes: red }], cookie)).status, 400);
      assert.equal((await (await fetch(base + '/api/products')).json()).products.length, 4);
    });
    let photoUrl;
    await t.test('existing products support photo reordering, removal and adding replacements', async () => {
      const photos = (await (await fetch(base + `/api/admin/products/${id}/photos`, { headers: { Cookie: cookie } })).json()).photos;
      const reversed = await upload(`/products/${id}/photos`, { keepIds: photos.map(p => p.id).reverse() }, [], cookie);
      assert.equal(reversed.status, 200);
      assert.equal((await reversed.json()).photos[0].id, photos[1].id);
      const changed = await upload(`/products/${id}/photos`, { keepIds: [photos[1].id] }, [{ bytes: red }], cookie);
      assert.equal(changed.status, 200);
      const after = (await changed.json()).photos;
      assert.equal(after.length, 2);
      photoUrl = after[0].url;
      assert.equal((await fetch(base + photos[0].url)).status, 404);
      const maxed = await upload(`/products/${id}/photos`, { keepIds: after.map(p => p.id) }, Array(3).fill({ bytes: red }), cookie);
      assert.equal(maxed.status, 400);
      assert.equal((await upload('/products/1/photos', { keepIds: [after[0].id] }, [], cookie)).status, 400);
    });
    await t.test('existing product edits change details and stock without changing its options or ID', async () => {
      const list = (await (await fetch(base + '/api/admin/products', { headers: { Cookie: cookie } })).json()).products;
      const product = list.find(p => p.id === id);
      const payload = { name: 'Updated cushion', description: 'Edited description.', material: 'Linen',
        priceCents: 4299, available: true, stock: product.variants.map(v => ({ id: v.id, quantity: 11 })) };
      assert.equal((await json('/products/' + id, { ...payload, stock: [{ id: 1, quantity: 1 }] }, cookie)).status, 400);
      assert.equal((await json('/products/' + id, payload, cookie)).status, 200);
      const changed = (await (await fetch(base + '/api/products')).json()).products.find(p => p.id === id);
      assert.equal(changed.name, 'Updated cushion');
      assert.equal(changed.priceCents, 4299);
      assert.deepEqual(changed.variants.map(v => v.stock), [11, 11]);
      assert.deepEqual(changed.variants.map(v => v.options), product.variants.map(v => v.options));
      assert.equal((await json('/products/' + id, { ...payload, available: false }, cookie)).status, 200);
      assert.equal((await fetch(base + photoUrl)).status, 404);
      const photos = (await (await fetch(base + `/api/admin/products/${id}/photos`, { headers: { Cookie: cookie } })).json()).photos;
      assert.equal((await fetch(base + photos[0].previewUrl)).status, 401);
      assert.equal((await fetch(base + photos[0].previewUrl, { headers: { Cookie: cookie } })).status, 200);
      assert.equal((await json('/products/' + id, payload, cookie)).status, 200);
    });
    await t.test('photos and edited stock survive application and database reconnection', async () => {
      await new Promise(resolve => server.close(resolve));
      await db.close();
      db = await reopen();
      server = createApp(db, { password }).listen(0, '127.0.0.1');
      await once(server, 'listening');
      base = `http://127.0.0.1:${server.address().port}`;
      const list = (await (await fetch(base + '/api/products')).json()).products;
      const product = list.find(p => p.id === id);
      assert.equal(product.photos.length, 2);
      assert.equal(product.variants[0].stock, 11);
      assert.equal((await fetch(base + product.photos[0])).status, 200);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
}
