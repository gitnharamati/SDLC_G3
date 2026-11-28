// Shared SQL operations keep SQLite and PostgreSQL order rules identical.
const queues = new WeakMap();
export function reader(db) {
  return async (sql, values = []) => {
    if (db.kind === 'postgres') { let n = 0; return (await db.pool.query(sql.replace(/\?/g, () => '$' + ++n), values)).rows; }
    return db.prepare(sql).all(...values);
  };
}
export async function atomic(db, action) {
  if (db.kind === 'postgres') {
    for (let attempt = 0; ; attempt++) {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const q = async (sql, values = []) => { let n = 0; return (await client.query(sql.replace(/\?/g, () => '$' + ++n), values)).rows; };
        const result = await action(q, ' FOR UPDATE'); await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK').catch(() => {}); if (attempt === 0 && ['40P01', '40001'].includes(error.code)) continue; throw error; }
      finally { client.release(); }
    }
  }
  const previous = queues.get(db) || Promise.resolve(); let release;
  const current = new Promise(resolve => { release = resolve; }); queues.set(db, current);
  await previous;
  try { db.exec('BEGIN IMMEDIATE'); const result = await action(reader(db), ''); db.exec('COMMIT'); return result; }
  catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { release(); if (queues.get(db) === current) queues.delete(db); }
}
export class OrderError extends Error {
  constructor(message, code = 'INVALID_INPUT', status = 400, extra = {}) { super(message); this.code = code; this.status = status; this.extra = extra; }
}
export const statuses = ['Received','Paid','In assembly','Ready to ship','Handed to shipper','On its way','Delivered to customer'];
export const eventNames = { E3:'Assembly started', E4:'Moved to shipping room', E5:'Handed to carrier', E6:'In transit', E7:'Delivery confirmed' };
export const now = () => new Date().toISOString();
