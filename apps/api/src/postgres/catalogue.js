import { transaction } from './database.js';

export async function postgresCatalogue(db) {
  const { rows } = await db.pool.query(`SELECT d.id AS department_id, d.name AS department_name,
    c.id AS category_id, c.name AS category_name, s.id AS room_id, s.name AS room_name
    FROM departments d LEFT JOIN categories c ON c.department_id = d.id
    LEFT JOIN subcategories s ON s.category_id = c.id ORDER BY d.id, c.id, s.id`);
  const departments = [];
  for (const row of rows) {
    let d = departments.find(item => item.id === row.department_id);
    if (!d) departments.push(d = { id: row.department_id, name: row.department_name, categories: [] });
    if (!row.category_id) continue;
    let c = d.categories.find(item => item.id === row.category_id);
    if (!c) d.categories.push(c = { id: row.category_id, name: row.category_name, subcategories: [] });
    if (row.room_id) c.subcategories.push({ id: row.room_id, name: row.room_name });
  }
  return departments;
}

export async function postgresProducts(db, includeUnavailable = false) {
  return transaction(db.pool, async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { rows: products } = await client.query(`SELECT p.id, p.name, p.description, p.material,
      p.price_cents AS "priceCents", p.available, p.subcategory_id AS "roomId", c.id AS "categoryId", d.id AS "departmentId", s.name AS room, c.name AS category, d.name AS department
      FROM products p JOIN subcategories s ON s.id = p.subcategory_id
      JOIN categories c ON c.id = s.category_id JOIN departments d ON d.id = c.department_id
      ${includeUnavailable ? '' : 'WHERE p.available = 1'} ORDER BY p.id`);
    if (!products.length) return [];
    const ids = products.map(product => product.id);
    const photos = (await client.query('SELECT product_id, path FROM product_photos WHERE product_id = ANY($1::int[]) ORDER BY position', [ids])).rows;
    const variants = (await client.query('SELECT id, product_id, sku, stock FROM product_variants WHERE product_id = ANY($1::int[]) ORDER BY id', [ids])).rows;
    const options = (await client.query(`SELECT vv.variant_id, ot.name, ov.value
      FROM variant_values vv JOIN option_values ov ON ov.id = vv.option_value_id
      JOIN option_types ot ON ot.id = ov.option_type_id
      WHERE ot.product_id = ANY($1::int[]) ORDER BY ot.id`, [ids])).rows;
    return products.map(product => ({
      ...product, available: Boolean(product.available),
      photos: photos.filter(photo => photo.product_id === product.id).map(photo => photo.path),
      variants: variants.filter(variant => variant.product_id === product.id).map(({ product_id, ...variant }) => ({
        ...variant, options: options.filter(option => option.variant_id === variant.id).map(({ name, value }) => ({ name, value }))
      }))
    }));
  });
}
