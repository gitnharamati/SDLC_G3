import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test('production refuses to start without hosted database configuration or fall back to SQLite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'decor-startup-'));
  const path = join(directory, 'must-not-create.sqlite');
  try {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/server.js', import.meta.url))], {
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '', DATABASE_PATH: path },
      encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Set DATABASE_URL/);
    assert.ok(!existsSync(path));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('invalid hosted database settings fail without printing the credential or creating a fallback file', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/server.js', import.meta.url))], {
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: 'not-postgres://user:private-password@example.com/db' },
    encoding: 'utf8', timeout: 10000
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No fallback database/);
  assert.ok(!result.stderr.includes('private-password'));
});
