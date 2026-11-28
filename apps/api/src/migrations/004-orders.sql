CREATE TABLE orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 attempt_id TEXT NOT NULL UNIQUE,
 request_hash TEXT NOT NULL,
 order_number TEXT UNIQUE,
 customer_json TEXT NOT NULL,
 total_cents INTEGER NOT NULL CHECK(total_cents > 0),
 status TEXT NOT NULL CHECK(status IN ('Received','Paid','In assembly','Ready to ship','Handed to shipper','On its way','Delivered to customer')),
 payment_flag TEXT NOT NULL DEFAULT '',
 next_payment_at TEXT,
 created_at TEXT NOT NULL
);
CREATE TABLE order_lines (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
 name TEXT NOT NULL, options_json TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0), price_cents INTEGER NOT NULL CHECK(price_cents > 0)
);
CREATE INDEX order_lines_product ON order_lines(product_id);
CREATE TABLE order_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 event TEXT NOT NULL, old_status TEXT NOT NULL, new_status TEXT NOT NULL,
 actor TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE TABLE payment_attempts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 attempt_no INTEGER NOT NULL CHECK(attempt_no > 0),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 result TEXT NOT NULL, reference TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(order_id, attempt_no)
);
CREATE TABLE stock_adjustments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 variant_id INTEGER NOT NULL,
 product_name TEXT NOT NULL,
 previous_stock INTEGER NOT NULL CHECK(previous_stock >= 0),
 new_stock INTEGER NOT NULL CHECK(new_stock >= 0),
 reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
);
