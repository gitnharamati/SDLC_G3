CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) BETWEEN 1 AND 60)
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(trim(name)) BETWEEN 1 AND 60),
  UNIQUE(department_id, name)
);
CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL COLLATE NOCASE CHECK(length(trim(name)) BETWEEN 1 AND 60),
  UNIQUE(category_id, name)
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 2000),
  material TEXT NOT NULL CHECK(length(trim(material)) BETWEEN 1 AND 120),
  price_cents INTEGER NOT NULL CHECK(typeof(price_cents) = 'integer' AND price_cents > 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0, 1))
);
CREATE TABLE IF NOT EXISTS product_photos (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  path TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  UNIQUE(product_id, position)
);
CREATE TABLE IF NOT EXISTS option_types (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL COLLATE NOCASE,
  UNIQUE(product_id, name)
);
CREATE TABLE IF NOT EXISTS option_values (
  id INTEGER PRIMARY KEY,
  option_type_id INTEGER NOT NULL REFERENCES option_types(id),
  value TEXT NOT NULL COLLATE NOCASE,
  UNIQUE(option_type_id, value)
);
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(typeof(stock) = 'integer' AND stock >= 0),
  UNIQUE(id, product_id)
);
CREATE TABLE IF NOT EXISTS variant_values (
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  option_value_id INTEGER NOT NULL REFERENCES option_values(id),
  PRIMARY KEY(variant_id, option_value_id)
);
CREATE TABLE IF NOT EXISTS seed_versions (
  version INTEGER PRIMARY KEY
);
