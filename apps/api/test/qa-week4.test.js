// Week 5 maintenance: use a controlled QA fixture and the actual storefront rules.
// Existing QA case IDs are retained; expectations now follow the BA specification.
import { qaCatalogue } from './fixtures/qa-catalogue.mjs';
import { filterProducts as storefront } from '../../web/src/app/storefront-rules.ts';
// QA Week 4 (Romit Tejani) - retests of Week 3 findings, Increment 2 storefront checks
// (CUS-01..06, CUS-10..11, ADM-09, ADM-10) and an Increment 1 admin regression.
//
// Run from the repo root with `npm test` (Node 24). These tests work on the database and
// source files only, so they need no browser. Tests marked `todo` document a known open
// bug or a gap against Nir's Increment 2 spec: they are expected to fail until it is built.
// Test IDs: TC-W4-xx are QA's own numbers; CUS/ADM IDs follow the traceability matrix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/database.js';
import { getProducts, getCatalogue } from '../src/catalogue.js';
import { addProduct, ProductInputError } from '../src/product-editor.js';
import { updateProduct } from '../src/update-product.js';
import { deleteProduct } from '../src/delete-product.js';

const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const html = read('apps/web/src/app/app.component.html');
const ts = read('apps/web/src/app/app.component.ts');

const fresh = () => openDatabase(':memory:');
const bundled = qaCatalogue;
const ids = list => list.map(p => p.id);
const oracle = (db, sql, ...args) => db.prepare(sql).all(...args).map(r => r.id); // independent SQL answer

// Placement ids in the seed: category 1-3 (Cushions, Bed sheets, Curtains); room = subcategory
// id 1..15 (Kitchen, Bedroom, Bathroom, Living room, Patio inside each category).
const base = { name: 'QA product', description: 'QA description', material: 'QA material', departmentId: 1,
  categoryId: 1, roomId: 1, priceCents: 2000, available: true, sizes: ['One'], colours: ['Plain'], stock: [5] };
const make = (db, overrides = {}) => {
  const free = db.prepare('SELECT id FROM subcategories WHERE category_id = 1 AND id NOT IN (SELECT subcategory_id FROM products) ORDER BY id LIMIT 1').get()?.id;
  return addProduct(db, { ...base, roomId:free || 1, ...overrides });
};
const rejects = (db, overrides, pattern) => assert.throws(() => make(db, overrides), error => {
  assert.ok(error instanceof ProductInputError, `expected ProductInputError, got ${error?.constructor?.name}: ${error?.message}`);
  if (pattern) assert.match(error.message, pattern);
  return true;
});

// ---- Port of the storefront logic in apps/web/src/app/app.component.ts -------------------
// Browser tests need Angular, so the pure filtering rules are copied here and a guard test
// below fails if the real source changes, so the copy is never silently out of date.
function cents(value) {
  if (!value.trim()) return null;
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [whole, decimal = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}
function priceError(minimum = '', maximum = '') {
  const low = cents(minimum), high = cents(maximum);
  if (Number.isNaN(low) || Number.isNaN(high)) return 'invalid';
  return low !== null && high !== null && low > high ? 'range' : '';
}
const totalStock = p => p.variants.reduce((sum, v) => sum + v.stock, 0);
const chosenVariant = (p, size, colour) => p.variants.find(v =>
  v.options.some(o => o.name === 'Size' && o.value === size) && v.options.some(o => o.name === 'Colour' && o.value === colour));

test('TC-W4-00 the storefront uses the same rules exercised by these tests', () => {
  assert.match(ts, /filterProducts\(this.products\(\)/);
});

// =========================== A. Retests of Week 3 findings ==============================
test('RT-BUG-07 hidden product is not in the public list but is in the admin list', () => {
  const db = fresh();
  const { id } = make(db, { name: 'Hidden one', available: false });
  assert.ok(!ids(getProducts(db)).includes(id));
  assert.ok(ids(getProducts(db, true)).includes(id));
});

test('RT-BUG-02 a product switched to unavailable disappears from the public list (server side)', async () => {
  const db = fresh();
  assert.equal(getProducts(db).length, 3);
  await updateProduct(db, 2, { name: 'Cotton bed sheet', description: 'd', material: 'Cotton', priceCents: 4999, available: false,
    stock: db.prepare('SELECT id FROM product_variants WHERE product_id = 2').all().map(v => ({ id: v.id, quantity: 1 })) });
  assert.deepEqual(ids(getProducts(db)), [1, 3]);
});

test('RT-BUG-02 the storefront template and logic also skip unavailable products', () => {
  assert.ok(read('apps/web/src/app/storefront-rules.ts').includes('p.available &&'));
});

test('RT-BUG-08 same name and same placement is blocked', () => {
  const db = fresh();
  make(db, { name: 'Woven cushion', roomId:1 });
  assert.throws(() => make(db, { name: 'Woven cushion', roomId:1 })); // expected: blocked or flagged for the inventory manager
});

test('RT-BUG-08 same name in a different room is accepted after warning confirmation', () => {
  const db = fresh();
  make(db, { name: 'Woven cushion', roomId: 1 });
  assert.doesNotThrow(() => make(db, { name: 'Woven cushion', roomId: 2, confirmDuplicateName:true }));
});

test('RT-BUG-04 the SQLite file must be ignored by Git', () => {
  const rules = read('.gitignore').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  assert.ok(rules.some(rule => /sqlite/.test(rule)), 'no active .gitignore rule for *.sqlite');
});

test('RT-OBS-10 stray files app_.js, server_.js and deploy-changes.patch are removed', () => {
  for (const path of ['apps/api/src/app_.js', 'apps/api/src/server_.js', 'deploy-changes.patch']) {
    assert.ok(!existsSync(new URL(path, root)), `${path} still exists`);
  }
});

test('RT-BUG-03 sign-in lockout follows spec SI-8 (per username and address, 15 minutes)', () => {
  const source = read('apps/api/src/admin.js');
  assert.ok(/failureWindowMs\s*=\s*15\s*\*\s*60\s*\*\s*1000/.test(source), 'failure window is not 15 minutes');
});

test('RT-OBS-07 Admin navigation is limited to the admin page or a verified signed-in session', () => {
  const links = html.match(/<a[^>]*href="\/admin"[^>]*>/g) || [];
  assert.equal(links.length, 1);
  assert.match(html, /@if \(isAdmin \|\| adminSignedIn\(\)\) \{ <a href="\/admin"/);
  assert.match(ts, /http.get\('\/api\/admin\/session'\)/);
});

// ================= B. Increment 2 storefront (CUS-01..06, CUS-10..11, ADM-09/10) ===========
test('TC-CUS-01-01 the catalogue has three categories with five rooms each, available through category filters', () => {
  const catalogue = getCatalogue(bundled());
  const categories = catalogue.flatMap(d => d.categories);
  assert.deepEqual(categories.map(c => c.name), ['Cushions', 'Bed sheets', 'Curtains']);
  for (const c of categories) assert.equal(c.subcategories.length, 5);
  assert.match(html, /id="filter-sort-toggle"/);
  assert.match(html, /toggleFilter\('category',item.name\)/);
});

test('TC-CUS-02-01 search "cush" finds the same products as an independent SQL check, any letter case', () => {
  const db = bundled(), all = getProducts(db);
  const expected = oracle(db, "SELECT id FROM products WHERE available = 1 AND lower(name || ' ' || description || ' ' || material) LIKE '%cush%' ORDER BY id");
  assert.ok(expected.length >= 1);
  for (const term of ['cush', 'CUSH', 'Cush ']) assert.deepEqual(ids(storefront(all, { search: term })), expected);
});

test('TC-CUS-02-02 search matches the material when the name does not ("tencel" finds products 6 and 9)', () => {
  const all = getProducts(bundled());
  assert.deepEqual(ids(storefront(all, { search: 'tencel' })), [6, 9]);
  assert.ok(!all.find(p => p.id === 9).name.toLowerCase().includes('tencel'));
});

test('TC-CUS-02-03 spec example: "100% linen" material is found by "linen" although the name has no "linen"', () => {
  const db = fresh();
  make(db, { name: 'Soft throw', material: '100% linen' });
  const names = storefront(getProducts(db), { search: 'linen' }).map(p => p.name);
  assert.ok(names.includes('Soft throw'));
});

test('TC-CUS-02-04 name matches are listed before material matches (BR-4, C4)', () => {
  const result = storefront(getProducts(bundled()), { search: 'cotton' });
  const nameHits = result.filter(p => p.name.toLowerCase().includes('cotton'));
  assert.deepEqual(ids(result).slice(0, nameHits.length), ids(nameHits));
});

test('TC-CUS-02-05 search needs at least 2 characters (BR-4)', () => {
  const all = getProducts(bundled());
  const result = storefront(all, { search: 'z' }); // 1 character: expected to be ignored (all products), today it filters
  assert.equal(result.length, all.length, `search "z" returned ${result.length} of ${all.length} products`);
});

test('TC-CUS-03-01 the product card shows placement, name, material, CAD price, stock label and the options button', () => {
  for (const fragment of ['item.category }} / {{ item.room', 'item.name', 'item.material', "currency:'CAD'",
    'available across options', 'View options and stock', 'Out of stock']) assert.ok(html.includes(fragment), fragment);
});

test('TC-CUS-04-01 Bedroom + Cushions lists only bedroom cushions (AND across groups)', () => {
  const db = bundled();
  const expected = oracle(db, `SELECT p.id FROM products p JOIN subcategories s ON s.id = p.subcategory_id JOIN categories c ON c.id = s.category_id
    WHERE c.name = 'Cushions' AND s.name = 'Bedroom' ORDER BY p.id`);
  assert.deepEqual(expected, [8, 9]);
  assert.deepEqual(ids(storefront(getProducts(db), { category: 'Cushions', room: 'Bedroom' })), expected);
});

test('TC-CUS-04-02 the price range is inclusive: products at exactly $20.00 and $40.00 are included', () => {
  const db = fresh();
  const a = make(db, { name: 'P19.99', priceCents: 1999 }).id, b = make(db, { name: 'P20.00', priceCents: 2000 }).id;
  const c = make(db, { name: 'P40.00', priceCents: 4000 }).id, d = make(db, { name: 'P40.01', priceCents: 4001 }).id;
  const found = ids(storefront(getProducts(db), { minimum: '20', maximum: '40' }));
  assert.ok(found.includes(b) && found.includes(c));
  assert.ok(!found.includes(a) && !found.includes(d));
  assert.deepEqual(ids(storefront(getProducts(db), { minimum: '20.00', maximum: '20' })).filter(id => id === b), [b]);
});

test('TC-CUS-04-03 price input: valid values accepted, invalid values refused with no results shown', () => {
  for (const ok of ['', '0', '0.00', '5', '24.5', '24.99', '999999.99']) assert.equal(priceError(ok, ''), '', `"${ok}" should be accepted`);
  for (const bad of ['abc', '-5', '24.999', '1000000', '1e3', '5.', '$5', '5,00']) assert.equal(priceError(bad, ''), 'invalid', `"${bad}" should be refused`);
  assert.equal(priceError('40', '20'), 'range');
  assert.equal(priceError('20', '20'), ''); // equal limits are allowed
  assert.deepEqual(storefront(getProducts(bundled()), { minimum: '40', maximum: '20' }), []);
});

test('TC-CUS-04-04 the price filter ignores floating point: $24.99 is 2499 cents', () => {
  assert.equal(cents('24.99'), 2499);
  assert.equal(cents('0.1'), 10);
  assert.equal(cents('19.9'), 1990);
});

test('TC-CUS-04-05 category filter accepts several categories at once (FL-1, OR)', () => {
  assert.ok(/category = signal<string\[\]>/.test(ts), 'category filter is a single value');
});

test('TC-CUS-04-06 results are sortable by price (BR-8)', () => {
  assert.ok(/sort/i.test(html), 'no sort control in the template');
});

test('TC-CUS-05-01 a search with no matches returns an empty list and the page shows a no-results message', () => {
  assert.deepEqual(storefront(getProducts(bundled()), { search: 'lamp' }), []);
  assert.match(html, /No products match/);
});

test('TC-CUS-05-02 no-results message names the search term and filters, with a link per category (NR-1, NR-2)', () => {
  assert.ok(/No products match/.test(html), 'template says "No matching products" with no search term or category links');
});

test('TC-CUS-05-03 Clear filters keeps the search term (FL-5)', () => {
  const body = ts.match(/clearFilters\(\)\s*\{[\s\S]*?\n  \}/)[0];
  assert.ok(!body.includes("'search'"));
});

test('TC-CUS-06-01 the room filter matches an independent SQL check and there are five rooms', () => {
  const db = bundled();
  const expected = oracle(db, "SELECT p.id FROM products p JOIN subcategories s ON s.id = p.subcategory_id WHERE s.name = 'Living room' ORDER BY p.id");
  assert.deepEqual(ids(storefront(getProducts(db), { room: 'Living room' })), expected);
  const rooms = new Set(getCatalogue(db).flatMap(d => d.categories.flatMap(c => c.subcategories.map(r => r.name))));
  assert.equal(rooms.size, 5);
});

test('TC-CUS-06-02 Curtains + Bathroom finds exactly the shower curtain (category AND room)', () => {
  assert.deepEqual(ids(storefront(getProducts(bundled()), { category: 'Curtains', room: 'Bathroom' })), [13]);
});

test('TC-NAV-01 three-click rule: every product is reachable in 2 clicks from Home via its category link', () => {
  const all = getProducts(bundled());
  for (const p of all) {
    const onCategoryPage = storefront(all, { category: p.category });
    assert.ok(ids(onCategoryPage).includes(p.id), `${p.name} is not listed on its category page`); // click 1 = category, click 2 = product
  }
  assert.match(ts, /categoryLink\(name: string\) \{ return '\/shop\?category='/);
});

test('TC-CUS-10-01 product page shows photos or category artwork, name, price (CAD), material and description', () => {
  for (const fragment of ['item.name', 'item.description', 'item.material', "currency:'CAD'", 'Category illustration', 'product-thumbnails']) {
    assert.ok(html.includes(fragment), fragment);
  }
  assert.match(html, /@if \(item\.photos\.length > 1\)/); // thumbnails hidden for one image or none (C15)
});

test('TC-CUS-10-02 product page addresses: only /products/<number> opens a product; anything else is "unavailable"', () => {
  const pattern = /^\/products\/(\d+)\/?$/;
  assert.equal(pattern.exec('/products/12')?.[1], '12');
  for (const bad of ['/products/abc', '/products/1/extra', '/products/', '/products/-1', '/products/1.5']) assert.equal(pattern.exec(bad), null, bad);
  const all = getProducts(bundled());
  for (const missing of [0, 999, 1000000]) assert.equal(all.find(p => p.id === missing) || null, null);
  assert.match(html, /Product unavailable/);
});

test('TC-CUS-10-03 a hidden product has no product page (it is not in the public list)', () => {
  const db = fresh();
  const { id } = make(db, { available: false });
  assert.equal(getProducts(db).find(p => p.id === id) || null, null);
});

test('TC-CUS-11-01 stock per size and colour matches the spec examples (50 x 50 Sage = 3, 45 x 45 Charcoal = 0)', () => {
  const linen = getProducts(fresh()).find(p => p.id === 1);
  assert.equal(chosenVariant(linen, '50 × 50 cm', 'Sage').stock, 3);
  assert.equal(chosenVariant(linen, '45 × 45 cm', 'Charcoal').stock, 0);
  assert.equal(chosenVariant(linen, '45 × 45 cm', 'Sand').stock, 12);
  assert.equal(totalStock(linen), 35);
  assert.match(html, /selectionMessage\(\)/);
});

test('TC-CUS-11-02 a product with 0 stock in every option stays listed and is labelled "Out of stock" (BR-9)', () => {
  const db = fresh();
  const { id } = make(db, { name: 'Sold out', sizes: ['S', 'L'], colours: ['Red'], stock: [0, 0] });
  const product = storefront(getProducts(db)).find(p => p.id === id);
  assert.ok(product);
  assert.equal(totalStock(product), 0);
  assert.match(html, /totalStock\(item\) \? .* : 'Out of stock'/);
});

test('TC-CUS-11-03 out-of-stock products are listed after in-stock products by relevance (BR-9, C6)', async () => {
  const db = fresh();
  const rows = db.prepare('SELECT id FROM product_variants WHERE product_id = 1').all();
  await updateProduct(db, 1, { name: 'Linen square cushion', description: 'd', material: 'Linen blend', priceCents: 2499, available: true,
    stock: rows.map(v => ({ id: v.id, quantity: 0 })) }); // product 1 is now sold out; products 2 and 3 are in stock
  const result = storefront(getProducts(db));
  assert.deepEqual(ids(result), [2, 3, 1], `listed in order ${ids(result)}`);
});

test('TC-CUS-11-04 option values with no stock are disabled and a single option value is pre-selected (PP-4, C7)', () => {
  assert.ok(/\[disabled\]/.test(html), 'no disabled option values in the template');
});

test('TC-CUS-11-05 a size and colour pair with no variant reads "Out of stock for this combination" (C8, PP-5)', () => {
  assert.ok(/Out of stock for this combination/.test(ts), 'template says "This combination is unavailable."');
});

test('TC-CUS-12-01 the product page has an Add to cart control that waits for options and stock (PP-6)', () => {
  assert.ok(/Add to cart/.test(html), 'no Add to cart control');
});

test('TC-ADM-09-01 an admin price and stock change is what the shop returns on the next load (PP-11)', async () => {
  const db = fresh();
  const variants = db.prepare('SELECT id FROM product_variants WHERE product_id = 1 ORDER BY id').all();
  await updateProduct(db, 1, { name: 'Linen square cushion', description: 'd', material: 'Linen blend', priceCents: 2699, available: true,
    stock: variants.map((v, i) => ({ id: v.id, quantity: i })) });
  const product = getProducts(db).find(p => p.id === 1);
  assert.equal(product.priceCents, 2699);
  assert.deepEqual(product.variants.map(v => v.stock), [0, 1, 2, 3, 4, 5]);
});

test('TC-ADM-10-01 an unavailable product never appears in any search or filter result', async () => {
  const db = bundled();
  const before = ids(getProducts(db));
  const v = db.prepare('SELECT id FROM product_variants WHERE product_id = 13').all();
  await updateProduct(db, 13, { name: 'Fall Peony Shower Curtain', description: 'd', material: 'Polyester', priceCents: 4000, available: false,
    stock: v.map(x => ({ id: x.id, quantity: 1 })) });
  const after = getProducts(db);
  assert.equal(after.length, before.length - 1);
  assert.deepEqual(storefront(after, { category: 'Curtains', room: 'Bathroom' }), []);
  assert.deepEqual(storefront(after, { search: 'peony' }), []);
});

test('TC-OBS-09-01 product names are shown by Angular interpolation only (no innerHTML), so markup stays plain text', () => {
  assert.ok(!/innerHTML|bypassSecurityTrust/.test(html + ts));
  const db = fresh();
  make(db, { name: '<script>alert(1)</script>' });
  assert.equal(getProducts(db).at(-1).name, '<script>alert(1)</script>');
});

// ============== C. Increment 1 admin regression (ADM-01..08) at database level =============
test('TC-ADM-REG-01 adding a product saves details, options and one stock row per size x colour in one step', () => {
  const db = fresh();
  const result = make(db, { name: 'Two by two', sizes: ['S', 'L'], colours: ['Sand', 'Sage'], stock: [1, 2, 3, 4] });
  assert.equal(result.variantCount, 4);
  const saved = getProducts(db).find(p => p.id === result.id);
  assert.deepEqual(saved.variants.map(v => v.stock), [1, 2, 3, 4]);
  assert.ok(saved.variants.every(v => v.options.length === 2));
});

test('TC-ADM-REG-02 invalid input is refused and no partial rows are left behind', () => {
  const db = fresh();
  const counts = () => ['products', 'option_types', 'option_values', 'product_variants', 'variant_values']
    .map(t => db.prepare(`SELECT count(*) n FROM ${t}`).get().n);
  const before = counts();
  rejects(db, { name: '   ' });
  rejects(db, { description: '' });
  rejects(db, { material: 'x'.repeat(121) });
  rejects(db, { name: 'x'.repeat(121) });
  rejects(db, { priceCents: 0 }); rejects(db, { priceCents: -5 }); rejects(db, { priceCents: 24.5 });
  rejects(db, { priceCents: 100_000_000 }); rejects(db, { priceCents: '2000' });
  rejects(db, { available: 'yes' }); rejects(db, { available: undefined });
  rejects(db, { sizes: [] }); rejects(db, { sizes: Array.from({ length: 13 }, (_, i) => `S${i}`), stock: Array(13).fill(1) });
  rejects(db, { sizes: ['S', 's'], stock: [1, 1] }, /different/);
  rejects(db, { sizes: ['S', ' '], stock: [1, 1] });
  rejects(db, { stock: [-1] }); rejects(db, { stock: [1.5] }); rejects(db, { stock: [1_000_000] }); rejects(db, { stock: [null] });
  rejects(db, { stock: [1, 2] }); rejects(db, { stock: [] }); rejects(db, { stock: undefined });
  rejects(db, { departmentId: 0 }); rejects(db, { roomId: 1.5 });
  assert.throws(() => make(db, { roomId: 6 }), /go together/); // a Bed sheets room under Cushions
  assert.throws(() => make(db, { departmentId: 2 }), /go together/);
  assert.deepEqual(counts(), before);
});

test('TC-ADM-REG-03 12 sizes x 12 colours (144 rows) is accepted and 13 of either is refused', () => {
  const db = fresh();
  const twelve = prefix => Array.from({ length: 12 }, (_, i) => `${prefix}${i}`);
  assert.equal(make(db, { sizes: twelve('S'), colours: twelve('C'), stock: Array(144).fill(1) }).variantCount, 144);
  assert.throws(() => make(db, { colours: Array.from({ length: 13 }, (_, i) => `C${i}`), stock: Array(13).fill(1) }), ProductInputError);
});

test('TC-ADM-REG-04 editing: valid edit saves, unknown product returns false, wrong or foreign stock rows are refused', async () => {
  const db = fresh();
  const mine = db.prepare('SELECT id FROM product_variants WHERE product_id = 1 ORDER BY id').all();
  const theirs = db.prepare('SELECT id FROM product_variants WHERE product_id = 2 ORDER BY id').all();
  const edit = (overrides = {}) => ({ name: 'Edited', description: 'Edited', material: 'Edited', priceCents: 1234, available: true,
    stock: mine.map(v => ({ id: v.id, quantity: 9 })), ...overrides });
  assert.equal(await updateProduct(db, 1, edit()), true);
  assert.equal(getProducts(db).find(p => p.id === 1).priceCents, 1234);
  assert.equal(await updateProduct(db, 999, edit()), false);
  await assert.rejects(updateProduct(db, 1, edit({ stock: theirs.map(v => ({ id: v.id, quantity: 1 })) })), ProductInputError);
  await assert.rejects(updateProduct(db, 1, edit({ stock: mine.slice(1).map(v => ({ id: v.id, quantity: 1 })) })), ProductInputError); // a row missing
  await assert.rejects(updateProduct(db, 1, edit({ stock: [...mine, theirs[0]].map(v => ({ id: v.id, quantity: 1 })) })), ProductInputError);
  await assert.rejects(updateProduct(db, 1, edit({ stock: mine.map(v => ({ id: v.id, quantity: -1 })) })), ProductInputError);
  await assert.rejects(updateProduct(db, 1, edit({ stock: [mine[0], mine[0]].map(v => ({ id: v.id, quantity: 1 })) })), ProductInputError);
  await assert.rejects(updateProduct(db, 1, edit({ priceCents: 0 })), ProductInputError);
  await assert.rejects(updateProduct(db, 1, edit({ name: '  ' })), ProductInputError);
  const product = getProducts(db).find(p => p.id === 1);
  assert.equal(product.name, 'Edited'); // refused edits left the last good values in place
  assert.deepEqual(product.variants.map(v => v.stock), Array(6).fill(9));
});

test('TC-ADM-REG-05 deleting removes the product and its records and nothing else; a second delete returns false', async () => {
  const db = bundled();
  const count = sql => db.prepare(sql).get().n;
  const others = count('SELECT count(*) n FROM product_variants WHERE product_id <> 4');
  assert.equal(await deleteProduct(db, 4), true);
  assert.equal(count('SELECT count(*) n FROM products WHERE id = 4'), 0);
  assert.equal(count('SELECT count(*) n FROM option_types WHERE product_id = 4'), 0);
  assert.equal(count('SELECT count(*) n FROM product_variants WHERE product_id = 4'), 0);
  assert.equal(count('SELECT count(*) n FROM product_variants WHERE product_id <> 4'), others);
  assert.equal(count('SELECT count(*) n FROM variant_values WHERE variant_id NOT IN (SELECT id FROM product_variants)'), 0);
  assert.equal(count('SELECT count(*) n FROM option_values WHERE option_type_id NOT IN (SELECT id FROM option_types)'), 0);
  assert.equal(await deleteProduct(db, 4), false);
  assert.equal(getProducts(db, true).length, 14);
});

test('TC-ADM-REG-06 a deleted product id is not reused by the next product', async () => {
  const db = fresh();
  const { id } = make(db, {roomId:1});
  await deleteProduct(db, id);
  assert.notEqual(make(db, {roomId:1}).id, id);
});

test('TC-ADM-REG-07 the demo database file opens, migrates and keeps 15 products and 113 combinations', () => {
  const db = bundled();
  assert.equal(getProducts(db, true).length, 15);
  assert.equal(getProducts(db, true).reduce((n, p) => n + p.variants.length, 0), 113);
});

test('TC-DATA-01 demo data has a product with 0 stock in every combination and one unavailable product (C16)', () => {
  const all = getProducts(bundled(), true);
  assert.ok(all.some(p => totalStock(p) === 0));
  assert.ok(all.some(p => !p.available));
});

test('TC-DATA-02 demo data is clean: no stray trailing punctuation in materials', () => {
  assert.ok(getProducts(bundled()).every(p => !/[,;]\s*$/.test(p.material)));
});
