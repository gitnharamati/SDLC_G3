import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/database.js';
export function qaCatalogue() {
  const file = join(mkdtempSync(join(tmpdir(), 'qa-catalogue-')), 'fixture.sqlite');
  const db = new DatabaseSync(file);
  db.exec(readFileSync(new URL('../../src/schema.sql',import.meta.url),'utf8'));
  const snapshot = JSON.parse(readFileSync(new URL('./qa-catalogue.json',import.meta.url),'utf8'));
  for (const [table,rows] of Object.entries(snapshot)) for (const row of rows) {
    const columns = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...Object.values(row));
  }
  db.close(); return openDatabase(file);
}
