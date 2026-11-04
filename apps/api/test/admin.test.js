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
  assert.equal((await post('/login', { password })).status, 429);
});
