import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';

test('admin API rejects guests and wrong passwords, accepts login, and invalidates logout', async t => {
  const password = 'local-test-password-only';
  const db = openDatabase(':memory:');
  const server = createApp(db, { password }).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const post = (path, body, extra = {}) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1', ...extra },
    body: JSON.stringify(body)
  });
  assert.equal((await fetch(base + '/session')).status, 401);
  assert.equal((await post('/login', { password }, { 'X-Admin-Request': '0' })).status, 403);
  assert.equal((await post('/login', { password: 'wrong' })).status, 401);
  const login = await post('/login', { password });
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const Cookie = setCookie.split(';')[0];
  assert.equal((await fetch(base + '/session', { headers: { Cookie } })).status, 200);
  assert.equal((await post('/logout', {}, { Cookie })).status, 204);
  assert.equal((await fetch(base + '/session', { headers: { Cookie } })).status, 401);
  for (let i = 0; i < 4; i++) assert.equal((await post('/login', { password: 'wrong' })).status, 401);
  assert.equal((await post('/login', { password: 'wrong' })).status, 401);
  // Direct connections must not be able to change their IP via a request header.
  assert.equal((await post('/login', { password }, { 'X-Forwarded-For': '192.0.2.10' })).status, 429);
});

test('a trusted proxy gives clients separate sign-in limits', async t => {
  const password = 'local-test-password-only';
  const db = openDatabase(':memory:');
  const server = createApp(db, { password, trustProxyHops: 1 }).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  await once(server, 'listening');
  const post = (candidate, address) => fetch(
    `http://127.0.0.1:${server.address().port}/api/admin/login`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1',
      'X-Forwarded-For': address }, body: JSON.stringify({ password: candidate }) }
  );
  for (let i = 0; i < 5; i++) assert.equal((await post('wrong', '192.0.2.10')).status, 401);
  const blocked = await post(password, '192.0.2.99, 192.0.2.10');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await post(password, '192.0.2.20')).status, 200);
});
