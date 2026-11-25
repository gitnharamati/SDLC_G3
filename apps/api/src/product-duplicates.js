export class ProductConflictError extends Error {
  constructor(code, matches) {
    super(code === 'PLACEMENT_EXISTS'
      ? 'A product already exists in this department, category and room. Update the existing product instead.'
      : 'This name already exists in another placement. Change the name or confirm that you want to keep it.');
    this.code = code;
    this.matches = matches;
  }
}
export function duplicateDecision(products, input) {
  const samePlacement = products.filter(p => p.roomId === input.roomId);
  if (samePlacement.length) throw new ProductConflictError('PLACEMENT_EXISTS', samePlacement.map(summary));
  const sameName = products.filter(p => p.name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase());
  if (sameName.length && input.confirmDuplicateName !== true) throw new ProductConflictError('DUPLICATE_NAME', sameName.map(summary));
  return sameName.map(summary);
}
function summary(p) {
  return { id: p.id, name: p.name, department: p.department, category: p.category, room: p.room };
}
export function logDuplicate(db, event, input, matches) {
  const values = [event, input.name, input.roomId, JSON.stringify(matches)];
  if (db.kind === 'postgres') return db.pool.query('INSERT INTO product_audit(event, name, room_id, matches) VALUES($1,$2,$3,$4)', values);
  db.prepare('INSERT INTO product_audit(event, name, room_id, matches) VALUES(?,?,?,?)').run(...values);
}
