// QA admin access tests - Romit Tejani (QA), Week 2.
// Independent checks of admin sign-in / sign-out beyond the developer's own test.
// Maps to proposal slide 8: "requests without admin permission" and server-side checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database.js';

const PASSWORD = 'qa-test-password-only';

async function start(t, adminOptions) {
  const db = openDatabase(':memory:');
  const server = createApp(db, adminOptions).listen(0, '127.0.0.1');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = origin + '/api/admin';
  const post = (path, body, headers = {}) => fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const get = (path, headers = {}) => fetch(base + path, { headers });
  const login = async () => (await post('/login', { password: PASSWORD })).headers.get('set-cookie');
  return { origin, base, post, get, login };
}

// ---- Access control ----
test('QA-ADM-01 admin is disabled (503) when no password is configured', async t => {
  const { get, post } = await start(t, {});
  assert.equal((await get('/session')).status, 503);
  assert.equal((await post('/login', { password: PASSWORD })).status, 503);
});

test('QA-ADM-02 passwords shorter than 12 characters disable admin', async t => {
  const { post } = await start(t, { password: 'short-11-ch' });
  assert.equal((await post('/login', { password: 'short-11-ch' })).status, 503);
});

test('QA-ADM-03 guests, forged and malformed cookies get 401', async t => {
  const { get } = await start(t, { password: PASSWORD });
  assert.equal((await get('/session')).status, 401);
  assert.equal((await get('/session', { Cookie: 'decor_admin=' + 'a'.repeat(64) })).status, 401);
  assert.equal((await get('/session', { Cookie: 'decor_admin=not-a-valid-token' })).status, 401);
  assert.equal((await get('/session', { Cookie: 'decor_admin=' })).status, 401);
});

test('QA-ADM-04 sign-in with bad input is rejected, never accepted', async t => {
  // Two servers: the API allows only 5 failed sign-ins per minute, so split the cases.
  const first = await start(t, { password: PASSWORD });
  for (const body of [{}, { password: '' }, { password: 12345 }]) {
    assert.equal((await first.post('/login', body)).status, 401, JSON.stringify(body));
  }
  const second = await start(t, { password: PASSWORD });
  for (const body of [{ password: null }, { password: ['x'] }, { password: 'x'.repeat(257) }]) {
    assert.equal((await second.post('/login', body)).status, 401, JSON.stringify(body).slice(0, 40));
  }
  assert.equal((await second.post('/login', '{not json')).status, 400);
});

test('QA-ADM-05 POST without the X-Admin-Request header is blocked (403)', async t => {
  const { post, get } = await start(t, { password: PASSWORD });
  assert.equal((await post('/login', { password: PASSWORD }, { 'X-Admin-Request': '' })).status, 403);
  assert.equal((await post('/logout', {}, { 'X-Admin-Request': '' })).status, 403);
  assert.equal((await get('/session')).status, 401); // nothing was created
});

// ---- Session and cookie behaviour ----
test('QA-ADM-06 cookie is HttpOnly, SameSite=Strict, scoped to /api/admin; Secure in production', async t => {
  const dev = await start(t, { password: PASSWORD });
  const cookie = await dev.login();
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\/api\/admin/i);
  assert.doesNotMatch(cookie, /;\s*Secure/i);
  const prod = await start(t, { password: PASSWORD, secure: true });
  assert.match(await prod.login(), /;\s*Secure/i);
});

test('QA-ADM-07 session cookie is random and the password is never echoed back', async t => {
  const { post } = await start(t, { password: PASSWORD });
  const a = await post('/login', { password: PASSWORD });
  const b = await post('/login', { password: PASSWORD });
  const tokenA = a.headers.get('set-cookie').split(';')[0];
  const tokenB = b.headers.get('set-cookie').split(';')[0];
  assert.notEqual(tokenA, tokenB);
  assert.match(tokenA, /^decor_admin=[a-f0-9]{64}$/);
  assert.deepEqual(await a.clone().json(), { signedIn: true });
  assert.ok(!(await b.text()).includes(PASSWORD));
});

test('QA-ADM-08 admin responses are not cacheable', async t => {
  const { get } = await start(t, { password: PASSWORD });
  assert.match((await get('/session')).headers.get('cache-control'), /no-store/);
});

test('QA-ADM-09 sign-out ends the session on the server; repeat sign-out is harmless', async t => {
  const { post, get, login } = await start(t, { password: PASSWORD });
  const Cookie = (await login()).split(';')[0];
  assert.equal((await get('/session', { Cookie })).status, 200);
  assert.equal((await post('/logout', {}, { Cookie })).status, 204);
  assert.equal((await get('/session', { Cookie })).status, 401);   // old cookie reused
  assert.equal((await post('/logout', {}, { Cookie })).status, 204);
  assert.equal((await post('/logout', {})).status, 204);           // never signed in
});

test('QA-ADM-10 signing in again replaces the old session', async t => {
  const { post, get } = await start(t, { password: PASSWORD });
  const first = (await post('/login', { password: PASSWORD })).headers.get('set-cookie').split(';')[0];
  const second = (await post('/login', { password: PASSWORD }, { Cookie: first })).headers.get('set-cookie').split(';')[0];
  assert.equal((await get('/session', { Cookie: first })).status, 401);
  assert.equal((await get('/session', { Cookie: second })).status, 200);
});

test('QA-ADM-11 session expires after 30 minutes', async t => {
  const { get, login } = await start(t, { password: PASSWORD });
  const Cookie = (await login()).split(';')[0];
  const real = Date.now;
  t.after(() => { Date.now = real; });
  Date.now = () => real() + 29 * 60 * 1000;
  assert.equal((await get('/session', { Cookie })).status, 200);
  Date.now = () => real() + 31 * 60 * 1000;
  assert.equal((await get('/session', { Cookie })).status, 401);
});

// ---- Repeated failures ----
test('QA-ADM-12 five wrong passwords trigger 429 with Retry-After', async t => {
  const { post } = await start(t, { password: PASSWORD });
  for (let i = 0; i < 5; i++) assert.equal((await post('/login', { password: 'wrong' })).status, 401);
  const blocked = await post('/login', { password: 'wrong' });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

// BUG-03 (open): the failure counter is global, so anyone can lock the real admin out.
test('BUG-03 admin with the right password should not be locked out by someone else\'s failures',
  { todo: 'BUG-03 open' }, async t => {
    const { post } = await start(t, { password: PASSWORD });
    for (let i = 0; i < 5; i++) await post('/login', { password: 'attacker-guess' });
    assert.equal((await post('/login', { password: PASSWORD })).status, 200);
  });

// ---- Public shop is unaffected ----
test('QA-ADM-13 public catalogue works without sign-in and exposes no admin data', async t => {
  const { origin } = await start(t, { password: PASSWORD });
  const res = await fetch(origin + '/api/products');
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(!/password|hash|salt|decor_admin/i.test(text));
  assert.equal((await fetch(origin + '/api/health')).status, 200);
});

test('QA-ADM-14 there is no way to edit products or stock without admin (no write routes yet)', async t => {
  const { origin } = await start(t, { password: PASSWORD });
  for (const [method, path] of [['POST', '/api/products'], ['PUT', '/api/products/1'],
                                ['PATCH', '/api/products/1'], ['DELETE', '/api/products/1'],
                                ['POST', '/api/admin/products']]) {
    const res = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' }, body: method === 'DELETE' ? undefined : '{}' });
    assert.ok([401, 403, 404, 405].includes(res.status), `${method} ${path} returned ${res.status}`);
  }
});
