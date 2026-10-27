import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  seedDatabase(db);
  return db;
}

export function seedDatabase(db) {
  if (db.prepare('SELECT version FROM seed_versions WHERE version = 1').get()) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO departments(id, name) VALUES(1, ?)').run('Home Décor');
    const categories = ['Cushions', 'Bed sheets', 'Curtains'];
    const rooms = ['Kitchen', 'Bedroom', 'Bathroom', 'Living room', 'Patio'];
    for (const [index, name] of categories.entries()) {
      const categoryId = index + 1;
      db.prepare('INSERT INTO categories(id, department_id, name) VALUES(?, 1, ?)').run(categoryId, name);
      for (const [roomIndex, room] of rooms.entries()) {
        db.prepare('INSERT INTO subcategories(id, category_id, name) VALUES(?, ?, ?)')
          .run(index * 5 + roomIndex + 1, categoryId, room);
      }
    }
    const samples = [
      { id: 1, subcategory: 4, name: 'Linen square cushion', material: 'Linen blend', price: 2499,
        description: 'A soft cushion for a sofa or reading chair. Sample content for the course project.',
        size: ['45 × 45 cm', '50 × 50 cm'], colours: ['Sand', 'Sage', 'Charcoal'], stock: [12, 8, 0, 5, 3, 7] },
      { id: 2, subcategory: 7, name: 'Cotton bed sheet', material: 'Cotton', price: 4999,
        description: 'A cotton bed sheet for everyday use. Sample content for the course project.',
        size: ['Double', 'Queen'], colours: ['White', 'Stone'], stock: [6, 4, 8, 2] },
      { id: 3, subcategory: 14, name: 'Light filtering curtain', material: 'Polyester blend', price: 3999,
        description: 'A curtain panel that softens daylight. Sample content for the course project.',
        size: ['140 × 180 cm', '140 × 220 cm'], colours: ['Cream', 'Grey'], stock: [5, 2, 4, 0] }
    ];
    for (const product of samples) {
      db.prepare('INSERT INTO products(id, subcategory_id, name, description, material, price_cents) VALUES(?, ?, ?, ?, ?, ?)')
        .run(product.id, product.subcategory, product.name, product.description, product.material, product.price);
      const sizeType = Number(db.prepare('INSERT INTO option_types(product_id, name) VALUES(?, ?)').run(product.id, 'Size').lastInsertRowid);
      const colourType = Number(db.prepare('INSERT INTO option_types(product_id, name) VALUES(?, ?)').run(product.id, 'Colour').lastInsertRowid);
      const addValues = (type, values) => values.map(value => Number(db.prepare('INSERT INTO option_values(option_type_id, value) VALUES(?, ?)').run(type, value).lastInsertRowid));
      const sizes = addValues(sizeType, product.size);
      const colours = addValues(colourType, product.colours);
      let combination = 0;
      for (const size of sizes) for (const colour of colours) {
        const id = Number(db.prepare('INSERT INTO product_variants(product_id, sku, stock) VALUES(?, ?, ?)')
          .run(product.id, `DEMO-${product.id}-${++combination}`, product.stock[combination - 1]).lastInsertRowid);
        for (const value of [size, colour]) db.prepare('INSERT INTO variant_values(variant_id, option_value_id) VALUES(?, ?)').run(id, value);
      }
    }
    db.prepare('INSERT INTO seed_versions(version) VALUES(1)').run();
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
