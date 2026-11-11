function requiredText(value, label, limit) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > limit) throw new ProductInputError(`${label} must be 1–${limit} characters.`);
  return text;
}

function optionList(values, label) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 12) {
    throw new ProductInputError(`Enter 1–12 ${label.toLowerCase()} values.`);
  }
  const cleaned = values.map(value => requiredText(value, label, 60));
  if (new Set(cleaned.map(value => value.toLowerCase())).size !== cleaned.length) {
    throw new ProductInputError(`${label} values must be different.`);
  }
  return cleaned;
}

export class ProductInputError extends Error {}

export function addProduct(db, input) {
  const name = requiredText(input?.name, 'Product name', 120);
  const description = requiredText(input?.description, 'Description', 2000);
  const material = requiredText(input?.material, 'Material', 120);
  const { departmentId, categoryId, roomId, priceCents, available, stock } = input;
  if (![departmentId, categoryId, roomId].every(id => Number.isSafeInteger(id) && id > 0) ||
      !db.prepare(`SELECT 1 FROM subcategories s JOIN categories c ON c.id = s.category_id
                    WHERE s.id = ? AND c.id = ? AND c.department_id = ?`).get(roomId, categoryId, departmentId)) {
    throw new ProductInputError('Choose a department, category and room that go together.');
  }
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0 || priceCents > 99_999_999) {
    throw new ProductInputError('Enter a price between $0.01 and $999,999.99.');
  }
  if (typeof available !== 'boolean') throw new ProductInputError('Choose whether the product is visible in the shop.');
  const sizes = optionList(input.sizes, 'Size');
  const colours = optionList(input.colours, 'Colour');
  if (!Array.isArray(stock) || stock.length !== sizes.length * colours.length ||
      stock.some(quantity => !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 999_999)) {
    throw new ProductInputError('Enter a whole stock quantity from 0 to 999,999 for every combination.');
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const id = Number(db.prepare(`INSERT INTO products(subcategory_id, name, description, material, price_cents, available)
      VALUES (?, ?, ?, ?, ?, ?)`).run(roomId, name, description, material, priceCents, Number(available)).lastInsertRowid);
    const insertType = db.prepare('INSERT INTO option_types(product_id, name) VALUES (?, ?)');
    const insertValue = db.prepare('INSERT INTO option_values(option_type_id, value) VALUES (?, ?)');
    const addValues = (type, values) => {
      const typeId = insertType.run(id, type).lastInsertRowid;
      return values.map(value => insertValue.run(typeId, value).lastInsertRowid);
    };
    const sizeIds = addValues('Size', sizes);
    const colourIds = addValues('Colour', colours);
    const insertVariant = db.prepare('INSERT INTO product_variants(product_id, sku, stock) VALUES (?, ?, ?)');
    const linkValue = db.prepare('INSERT INTO variant_values(variant_id, option_value_id) VALUES (?, ?)');
    let index = 0;
    for (const size of sizeIds) for (const colour of colourIds) {
      const sku = `PRODUCT-${id}-${index + 1}`;
      const variantId = insertVariant.run(id, sku, stock[index++]).lastInsertRowid;
      linkValue.run(variantId, size);
      linkValue.run(variantId, colour);
    }
    db.exec('COMMIT');
    return { id, name, available, variantCount: index };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
