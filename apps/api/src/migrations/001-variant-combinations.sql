-- Existing variants retain their IDs, SKUs, and stock. A combination is valid
-- only when it contains one Size and one Colour belonging to the same product.
CREATE VIEW complete_variant_combinations AS
SELECT pv.id AS variant_id, pv.product_id,
  max(CASE WHEN ot.name = 'Size' THEN ov.id END) AS size_id,
  max(CASE WHEN ot.name = 'Colour' THEN ov.id END) AS colour_id
FROM product_variants pv
JOIN variant_values vv ON vv.variant_id = pv.id
JOIN option_values ov ON ov.id = vv.option_value_id
JOIN option_types ot ON ot.id = ov.option_type_id
GROUP BY pv.id
HAVING count(*) = 2 AND min(ot.product_id = pv.product_id) = 1
  AND size_id IS NOT NULL AND colour_id IS NOT NULL;

CREATE TABLE variant_combinations (
  variant_id INTEGER PRIMARY KEY REFERENCES product_variants(id),
  product_id INTEGER NOT NULL,
  size_id INTEGER NOT NULL,
  colour_id INTEGER NOT NULL,
  UNIQUE(product_id, size_id, colour_id)
);

-- A variant and its links can be built in one transaction. A missing
-- combination prevents COMMIT, including an implicit single-statement commit.
CREATE TABLE variant_requirements (
  variant_id INTEGER PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES variant_combinations(variant_id)
    DEFERRABLE INITIALLY DEFERRED
);

INSERT INTO variant_combinations SELECT * FROM complete_variant_combinations;
INSERT INTO variant_requirements SELECT id FROM product_variants;

CREATE TRIGGER variant_requires_combination AFTER INSERT ON product_variants
BEGIN
  INSERT INTO variant_requirements VALUES (NEW.id);
END;

CREATE TRIGGER variant_link_check BEFORE INSERT ON variant_values
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM product_variants pv
    JOIN option_values ov ON ov.id = NEW.option_value_id
    JOIN option_types ot ON ot.id = ov.option_type_id
    WHERE pv.id = NEW.variant_id AND ot.product_id = pv.product_id
      AND ot.name IN ('Size', 'Colour')
  ) THEN RAISE(ABORT, 'Option must be a size or colour of this product') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM variant_values vv
    JOIN option_values old_value ON old_value.id = vv.option_value_id
    JOIN option_values new_value ON new_value.option_type_id = old_value.option_type_id
    WHERE vv.variant_id = NEW.variant_id AND new_value.id = NEW.option_value_id
  ) THEN RAISE(ABORT, 'Variant already has an option of this type') END;
END;

CREATE TRIGGER variant_link_add AFTER INSERT ON variant_values
BEGIN
  INSERT INTO variant_combinations
    SELECT * FROM complete_variant_combinations WHERE variant_id = NEW.variant_id;
END;

CREATE TRIGGER variant_link_remove AFTER DELETE ON variant_values
BEGIN
  DELETE FROM variant_combinations WHERE variant_id = OLD.variant_id;
END;

CREATE TRIGGER variant_link_no_update BEFORE UPDATE ON variant_values
BEGIN
  SELECT RAISE(ABORT, 'Replace variant links in one transaction');
END;

CREATE TRIGGER variant_product_no_update BEFORE UPDATE OF product_id ON product_variants
WHEN OLD.product_id != NEW.product_id
BEGIN
  SELECT RAISE(ABORT, 'Variant cannot move to another product');
END;

CREATE TRIGGER linked_option_value_no_move BEFORE UPDATE OF option_type_id ON option_values
WHEN OLD.option_type_id != NEW.option_type_id AND EXISTS (
  SELECT 1 FROM variant_values WHERE option_value_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Linked option cannot move to another type');
END;

CREATE TRIGGER linked_option_type_no_move BEFORE UPDATE OF name, product_id ON option_types
WHEN (OLD.name != NEW.name OR OLD.product_id != NEW.product_id) AND EXISTS (
  SELECT 1 FROM option_values ov JOIN variant_values vv ON vv.option_value_id = ov.id
  WHERE ov.option_type_id = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'Linked option type cannot be renamed or moved');
END;
