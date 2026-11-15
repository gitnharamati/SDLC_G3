import { postgresCatalogue, postgresProducts } from './postgres/catalogue.js';

export function getCatalogue(db) {
  if (db.kind === 'postgres') return postgresCatalogue(db);
  return db.prepare('SELECT * FROM departments ORDER BY id').all().map(department => ({
    ...department,
    categories: db.prepare('SELECT id, name FROM categories WHERE department_id = ? ORDER BY id').all(department.id).map(category => ({
      ...category,
      subcategories: db.prepare('SELECT id, name FROM subcategories WHERE category_id = ? ORDER BY id').all(category.id)
    }))
  }));
}

export function getProducts(db, includeUnavailable = false) {
  if (db.kind === 'postgres') return postgresProducts(db, includeUnavailable);
  return db.prepare(`SELECT p.id, p.name, p.description, p.material, p.price_cents AS priceCents,
    p.available, p.subcategory_id AS roomId, c.id AS categoryId, d.id AS departmentId, s.name AS room, c.name AS category, d.name AS department
    FROM products p JOIN subcategories s ON s.id = p.subcategory_id
    JOIN categories c ON c.id = s.category_id JOIN departments d ON d.id = c.department_id
    ${includeUnavailable ? '' : 'WHERE p.available = 1'}
    ORDER BY p.id`).all().map(product => ({
    ...product,
    available: Boolean(product.available),
    photos: db.prepare('SELECT path FROM product_photos WHERE product_id = ? ORDER BY position').all(product.id).map(photo => photo.path),
    variants: db.prepare('SELECT id, sku, stock FROM product_variants WHERE product_id = ? ORDER BY id').all(product.id).map(variant => ({
      ...variant,
      options: db.prepare(`SELECT t.name, v.value FROM variant_values vv
        JOIN option_values v ON v.id = vv.option_value_id JOIN option_types t ON t.id = v.option_type_id
        WHERE vv.variant_id = ? ORDER BY t.id`).all(variant.id)
    }))
  }));
}
