# QA Report – Add Product flow (Increment 1 admin catalogue)

Tester: Romit Tejani (QA) · Build: `main` at 53a98f4 (includes PR #3 QA Week 2 and PR #4 `fix/week-2-qa`) · Date: 2026-11-10

## 1. Scope
Admin sign-in → Add Product form → saved product, option/stock rows, visibility toggle → what shoppers see.
Out of scope (per README): editing products, photo upload, checkout, payments.

## 2. How this was tested
| Method | Status |
|---|---|
| Code review of `product-editor.js`, `admin.js`, `catalogue.js`, schema, Angular editor | Done |
| Direct API-logic checks (script calling `addProduct` / `getProducts` on a fresh in-memory DB, Node 22), re-run on current `main` | Done |
| `apps/api/test/qa-regression.test.js` on current `main` | **9/9 pass** (updated this week, see BUG-01) |
| Dev's other automated tests (`npm test`, need Express) | **Run locally before submitting** and record the result here: ______ |
| Browser/manual cases (section 4) | **To run locally** with `npm run dev` + `ADMIN_PASSWORD` |

## 3. Findings so far

### BUG-07 – Hidden products were returned by the public API (High) – FIXED on `main`, browser retest pending
- **Was:** `getProducts()` had no `WHERE available = 1`, so a product saved with "Available in the shop" unchecked still came back from `GET /api/products`.
- **Cause:** the fix existed on Omkumar's `fix/week-2-qa` branch but was not merged when the Add Product commit landed on `main`. This explains why his tests and browser check passed on his side.
- **Now:** PR #4 merged the fix. On current `main`, `catalogue.js` has `WHERE p.available = 1`, and my API-level check shows the hidden product is **not** returned.
- **Still to do:** confirm in the browser (AP-14, AP-15) that the shop page also hides it.

### BUG-01 (Week 1) – Invalid variant combinations – FIXED, regression tests updated
- Migration `001-variant-combinations.sql` (from PR #4) now rejects a variant with no options, a duplicate size+colour, an option value from another product, and two options of the same type.
- The three `todo` tests in `qa-regression.test.js` were failing only because the database now throws earlier than they expected. They are rewritten to assert the rejection, plus a new BUG-01d test. They pass on current `main` and fail on the pre-fix code (`3a5acb8`), so they do guard the fix.

### BUG-08 – Duplicate product names accepted (Low/Medium)
- Re-checked on current `main`: two products called "Woven cushion" still save without warning. Admin can accidentally create duplicates (double-click, re-submit). No unique rule in schema or API.
- **Ask:** Decide with Nir whether names must be unique (or at least warn).

### OBS-09 – Markup in the name is stored as typed (Low)
- `<script>alert(1)</script>` saves. Angular interpolation should escape it on display; **verify in the browser** that it shows as plain text on the shop and the success message.

### OBS-10 – Stray / duplicate files in the repo (Low)
- Still on current `main`: `apps/api/src/app_.js`, `server_.js`, and `deploy-changes.patch` look like leftovers. `app_.js` calls `adminRouter(adminOptions)` with the old signature. Suggest deleting before merge.

### OBS-11 – No double-submit/duplicate protection beyond a disabled button (Low)
- Saving is disabled while a request runs (good), but a refresh after a lost response can create a second copy (see BUG-08).

## 4. Manual test cases (run in browser)

| ID | Test | Expected | Result |
|---|---|---|---|
| AP-01 | Open `/admin` signed out | Sign-in form only, no product form | Not run yet |
| AP-02 | Wrong password | "Incorrect password.", no form | Not run yet |
| AP-03 | 6 wrong passwords within a minute | 429 "Too many attempts" | Not run yet |
| AP-04 | Correct password | Signed-in message + Add product form | Not run yet |
| AP-05 | Submit empty form | Error message, nothing saved | Not run yet |
| AP-06 | Name / description / material of spaces only | Rejected | API: Pass (name of spaces rejected). Browser: not run yet |
| AP-07 | Price: `0`, `-5`, `abc`, `24.999`, `1000000`, `24.5`, `24.99` | Only `24.5` and `24.99` accepted (saved as $24.50 / $24.99) | Not run yet |
| AP-08 | Choose department → category → room; change department after | Category/room reset, can't save mismatched placement | Not run yet |
| AP-09 | Sizes `Small, Large`; colours `Sand, Sage` | 4 stock rows appear | Not run yet |
| AP-10 | Sizes `S, s` (case duplicate) | Rows not generated; clear error on save | Not run yet |
| AP-11 | 13 sizes / 12×12 = 144 rows | 13 rejected; 144 rows usable | API: Pass (13 sizes rejected). Browser: not run yet |
| AP-12 | Stock `-1`, `1.5`, `1000000`, blank | Rejected | API: Pass (1,000,000 rejected). Browser: not run yet |
| AP-13 | Change sizes after typing stock | Stock for kept combinations preserved, new ones default 0 | Not run yet |
| AP-14 | Save with "Available" checked | Success message with link; product on shop with correct price and per-option stock | Not run yet |
| AP-15 | Save with "Available" **unchecked** | Success message says hidden; product **not** on shop and **not** in `/api/products` | API on current `main`: Pass (BUG-07 fixed). Browser: not run yet |
| AP-16 | Session expires/ signs out in another tab, then Save | "Session ended", draft kept, sign in and save works | Not run yet |
| AP-17 | Sign out | Form disappears; direct POST to `/api/admin/products` returns 401 | Not run yet |
| AP-18 | POST `/api/admin/products` without `X-Admin-Request` header | 403 | Not run yet |
| AP-19 | Refresh the page mid-draft | Draft cleared (documented in README) | Not run yet |
| AP-20 | Phone width (375px) and keyboard-only use | Labels visible, table scrolls, tab order sensible, errors announced | Not run yet |
| AP-21 | Restart the server, reopen shop | New products and stock persist | Not run yet |
| AP-22 | Name containing `<b>x</b>` | Shown as plain text everywhere | Not run yet |

## 5. Questions for the developer
1. Are duplicate product names allowed? If not, add a check or a warning.
2. Should hidden products be fetchable by the admin later (for editing)? If so, use a separate admin endpoint rather than the public one.
3. Can `app_.js`, `server_.js` and `deploy-changes.patch` be removed?

## 6. Status
The blocking bug (BUG-07) is fixed on `main` and BUG-01 is closed. Add Product can be signed off once the browser cases (especially AP-14 and AP-15) pass. BUG-08 and OBS-10 remain open for the developer.
