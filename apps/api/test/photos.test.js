import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { photoWorkflow } from './photo-workflow.mjs';

test('SQLite product photos and existing product editing', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'decor-photos-'));
  const filename = join(directory, 'catalogue.sqlite');
  try { await photoWorkflow(openDatabase(filename), () => openDatabase(filename), t); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});
