import { duplicateDecision, ProductConflictError, logDuplicate } from '../product-duplicates.js';
import { insertPostgresPhotos } from '../photos.js';
import { transaction } from './database.js';
import { ProductInputError } from '../product-editor.js';

export async function postgresAddProduct(db, product, photos = []) {
  try { return await transaction(db.pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(210313)');
    const { name, description, material, departmentId, categoryId, roomId, priceCents, available, sizes, colours, stock } = product;
    const placement = await client.query(`SELECT 1 FROM subcategories s JOIN categories c ON c.id = s.category_id
      WHERE s.id = $1 AND c.id = $2 AND c.department_id = $3`, [roomId, categoryId, departmentId]);
    if (!placement.rowCount) throw new ProductInputError('Choose a department, category and room that go together.');
    const { rows: existing } = await client.query(`SELECT p.id, p.name, p.subcategory_id AS "roomId", d.name AS department, c.name AS category, s.name AS room
      FROM products p JOIN subcategories s ON s.id=p.subcategory_id JOIN categories c ON c.id=s.category_id JOIN departments d ON d.id=c.department_id ORDER BY p.id`);
    const matches = duplicateDecision(existing, product);
    const { rows: [{ id }] } = await client.query(`INSERT INTO products
      (subcategory_id, name, description, material, price_cents, available)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [roomId, name, description, material, priceCents, Number(available)]);
    const values = async (type, items) => {
      const result = await client.query('INSERT INTO option_types(product_id, name) VALUES($1, $2) RETURNING id', [id, type]);
      const ids = [];
      for (const value of items) {
        const row = await client.query('INSERT INTO option_values(option_type_id, value) VALUES($1, $2) RETURNING id', [result.rows[0].id, value]);
        ids.push(row.rows[0].id);
      }
      return ids;
    };
    const sizeIds = await values('Size', sizes);
    const colourIds = await values('Colour', colours);
    let index = 0;
    for (const size of sizeIds) for (const colour of colourIds) {
      const variant = await client.query('INSERT INTO product_variants(product_id, sku, stock) VALUES($1, $2, $3) RETURNING id',
        [id, `PRODUCT-${id}-${index + 1}`, stock[index++]]);
      for (const option of [size, colour]) await client.query('INSERT INTO variant_values VALUES($1, $2)', [variant.rows[0].id, option]);
    }
    await insertPostgresPhotos(client, id, photos);
    if (matches.length) await client.query('INSERT INTO product_audit(event, name, room_id, matches) VALUES($1,$2,$3,$4)', ['NAME_WARNING_IGNORED', name, roomId, JSON.stringify(matches)]);
    return { id, name, available, variantCount: index };
  }); } catch (error) {
    if (error instanceof ProductConflictError) await logDuplicate(db, error.code, product, error.matches);
    throw error;
  }
}
