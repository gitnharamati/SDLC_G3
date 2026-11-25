-- Keep issued product and variant identifiers even after a row is deleted.
CREATE TABLE issued_ids (kind TEXT NOT NULL, id INTEGER NOT NULL, PRIMARY KEY(kind, id));
INSERT INTO issued_ids SELECT 'product', id FROM products;
INSERT INTO issued_ids SELECT 'variant', id FROM product_variants;
CREATE TRIGGER products_keep_identity AFTER INSERT ON products BEGIN
  INSERT INTO issued_ids VALUES('product', NEW.id);
END;
CREATE TRIGGER variants_keep_identity AFTER INSERT ON product_variants BEGIN
  INSERT INTO issued_ids VALUES('variant', NEW.id);
END;
CREATE TABLE product_audit (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event TEXT NOT NULL,
  name TEXT NOT NULL,
  room_id INTEGER NOT NULL,
  matches TEXT NOT NULL
);
