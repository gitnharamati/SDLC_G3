ALTER TABLE product_photos ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'image/jpeg';
ALTER TABLE product_photos ADD COLUMN data BYTEA;
