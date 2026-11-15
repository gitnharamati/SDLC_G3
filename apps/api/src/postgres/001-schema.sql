CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK(length(btrim(name)) BETWEEN 1 AND 60)
);
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 60),
  UNIQUE(department_id, name)
);
CREATE TABLE subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 60),
  UNIQUE(category_id, name)
);
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id),
  name TEXT NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 2000),
  material TEXT NOT NULL CHECK(length(btrim(material)) BETWEEN 1 AND 120),
  price_cents INTEGER NOT NULL CHECK(price_cents > 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0, 1))
);
CREATE TABLE product_photos (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  path TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  UNIQUE(product_id, position)
);
CREATE TABLE option_types (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  UNIQUE(product_id, name)
);
CREATE TABLE option_values (
  id SERIAL PRIMARY KEY,
  option_type_id INTEGER NOT NULL REFERENCES option_types(id),
  value TEXT NOT NULL,
  UNIQUE(option_type_id, value)
);
CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT NOT NULL UNIQUE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  UNIQUE(id, product_id)
);
CREATE TABLE variant_values (
  variant_id INTEGER NOT NULL REFERENCES product_variants(id),
  option_value_id INTEGER NOT NULL REFERENCES option_values(id),
  PRIMARY KEY(variant_id, option_value_id)
);
CREATE TABLE seed_versions (
  version INTEGER PRIMARY KEY
);

CREATE UNIQUE INDEX department_name_ci ON departments(lower(name));
CREATE UNIQUE INDEX category_name_ci ON categories(department_id, lower(name));
CREATE UNIQUE INDEX room_name_ci ON subcategories(category_id, lower(name));
CREATE UNIQUE INDEX option_type_name_ci ON option_types(product_id, lower(name));
CREATE UNIQUE INDEX option_value_ci ON option_values(option_type_id, lower(value));

CREATE VIEW complete_variant_combinations AS
SELECT pv.id AS variant_id, pv.product_id,
 max(CASE WHEN lower(ot.name) = 'size' THEN ov.id END) AS size_id,
 max(CASE WHEN lower(ot.name) = 'colour' THEN ov.id END) AS colour_id
FROM product_variants pv
JOIN variant_values vv ON vv.variant_id = pv.id
JOIN option_values ov ON ov.id = vv.option_value_id
JOIN option_types ot ON ot.id = ov.option_type_id
GROUP BY pv.id
HAVING count(*) = 2 AND bool_and(ot.product_id = pv.product_id)
 AND count(*) FILTER (WHERE lower(ot.name) = 'size') = 1
 AND count(*) FILTER (WHERE lower(ot.name) = 'colour') = 1;

CREATE TABLE variant_combinations (
 variant_id INTEGER PRIMARY KEY REFERENCES product_variants(id),
 product_id INTEGER NOT NULL,
 size_id INTEGER NOT NULL,
 colour_id INTEGER NOT NULL,
 UNIQUE(product_id, size_id, colour_id)
);
CREATE TABLE variant_requirements (
 variant_id INTEGER PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
 FOREIGN KEY(variant_id) REFERENCES variant_combinations(variant_id)
   DEFERRABLE INITIALLY DEFERRED
);

CREATE FUNCTION require_variant_combination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO variant_requirements VALUES(NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER variant_requires_combination AFTER INSERT ON product_variants
 FOR EACH ROW EXECUTE FUNCTION require_variant_combination();

CREATE FUNCTION validate_variant_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM product_variants pv
   JOIN option_values ov ON ov.id = NEW.option_value_id
   JOIN option_types ot ON ot.id = ov.option_type_id
   WHERE pv.id = NEW.variant_id AND ot.product_id = pv.product_id
   AND lower(ot.name) IN ('size', 'colour')
 ) THEN RAISE EXCEPTION 'Option must be a size or colour of this product'; END IF;
 IF EXISTS (
   SELECT 1 FROM variant_values vv
   JOIN option_values old_value ON old_value.id = vv.option_value_id
   JOIN option_values new_value ON new_value.option_type_id = old_value.option_type_id
   WHERE vv.variant_id = NEW.variant_id AND new_value.id = NEW.option_value_id
 ) THEN RAISE EXCEPTION 'Variant already has an option of this type'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_link_check BEFORE INSERT ON variant_values
 FOR EACH ROW EXECUTE FUNCTION validate_variant_link();

CREATE FUNCTION add_variant_combination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO variant_combinations SELECT * FROM complete_variant_combinations
 WHERE variant_id = NEW.variant_id;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_link_add AFTER INSERT ON variant_values
 FOR EACH ROW EXECUTE FUNCTION add_variant_combination();

CREATE FUNCTION remove_variant_combination() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 DELETE FROM variant_combinations WHERE variant_id = OLD.variant_id;
 RETURN OLD;
END $$;
CREATE TRIGGER variant_link_remove AFTER DELETE ON variant_values
 FOR EACH ROW EXECUTE FUNCTION remove_variant_combination();

CREATE FUNCTION forbid_variant_link_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Replace variant links in one transaction';
END $$;
CREATE TRIGGER variant_link_no_update BEFORE UPDATE ON variant_values
 FOR EACH ROW EXECUTE FUNCTION forbid_variant_link_update();

CREATE FUNCTION forbid_variant_product_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.product_id != NEW.product_id THEN
  RAISE EXCEPTION 'Variant cannot move to another product';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_product_no_update BEFORE UPDATE OF product_id ON product_variants
 FOR EACH ROW EXECUTE FUNCTION forbid_variant_product_move();

CREATE FUNCTION forbid_linked_value_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.option_type_id != NEW.option_type_id AND EXISTS (
   SELECT 1 FROM variant_values WHERE option_value_id = OLD.id
 ) THEN RAISE EXCEPTION 'Linked option cannot move to another type'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER linked_option_value_no_move BEFORE UPDATE OF option_type_id ON option_values
 FOR EACH ROW EXECUTE FUNCTION forbid_linked_value_move();

CREATE FUNCTION forbid_linked_type_move() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (lower(OLD.name) != lower(NEW.name) OR OLD.product_id != NEW.product_id)
 AND EXISTS (
   SELECT 1 FROM option_values ov JOIN variant_values vv ON vv.option_value_id = ov.id
   WHERE ov.option_type_id = OLD.id
 ) THEN RAISE EXCEPTION 'Linked option type cannot be renamed or moved'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER linked_option_type_no_move BEFORE UPDATE OF name, product_id ON option_types
 FOR EACH ROW EXECUTE FUNCTION forbid_linked_type_move();
