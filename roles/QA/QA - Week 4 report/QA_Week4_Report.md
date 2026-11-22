# QA Week 4 Report

**Tester:** Romit Tejani (0476882), QA / Tester
**Project:** Team 3 Home Decor E-Commerce Website
**Build tested:** `main` as received for Week 4 (storefront search, filters and product page; admin product add, edit, delete and photos)
**Report date:** 22 November 2026
**Hours spent:** ____ (fill in)
**Test environment:** Automated checks run on Node 22 against the repository code and a copy of the demo database. Express, Angular and browser checks are listed in section 7 and still need to be run on Node 24.

## 1. Summary

The Week 4 storefront works for the core cases: search by name, description and material, category, room and price filters, the product page, and stock per size and colour. 32 of 70 test cases pass, 16 fail (4 older bugs still open, 9 gaps against Nir's Increment 2 spec, 3 observations), 12 are blocked because the cart is not built, and 10 need a browser.

Week 3 retest: BUG-07, BUG-01, BUG-02 and OBS-07 are fixed. OBS-09 is fixed in the code and needs one browser check. BUG-03 is only partly fixed. BUG-08, BUG-04 and OBS-10 are still open.

No new blocking bug was found. Recommendation: accept the storefront for Week 4 on condition that the spec gaps in section 5 are either built in Week 5 or accepted by Nir in writing.

## 2. Scope and method

Following the proposal's QA plan (slide 8) and Nir's "QA expectations week 4": retest the Week 3 findings, test browsing, search, filters and the product page (CUS-01 to 06, CUS-10 to 11), write the Increment 2 cart tests (CUS-13 to 15), and run an Increment 1 regression.

- Read Nir's Increment 2 specification, his clarifications C1 to C16, the Bug 08 Resolution, and the Dev expectations.
- Read the code: `admin.js`, `app.js`, `catalogue.js`, `product-editor.js`, `update-product.js`, `delete-product.js`, the schema and migrations, and the Angular storefront and admin components.
- Wrote `apps/api/test/qa-week4.test.js` (50 tests). Results are checked against independent SQL queries where possible. Tests for known open items are marked `todo`, so `npm test` stays green and they turn into normal tests once fixed.
- The Angular filter rules cannot run without a browser, so the test file holds a copy of them and a guard test fails if `app.component.ts` changes.
- Wrote 70 test cases in `QA_Test_Plan_and_Results_Increment2.xlsx` (TC-55 to TC-124), each with the matrix ID Nir asked for.

Automated results: `qa-week4.test.js` 50 tests, 33 pass, 0 fail, 17 `todo` (the open items in sections 3 and 5). `qa-regression.test.js` 9 of 9 pass. The developer's Express-based suites (admin, product editor, delete workflow, startup, foundation API) and the photo tests were not run in this review: see section 7.

## 3. Retest of Week 3 findings

| ID | Finding | Result | Evidence |
|---|---|---|---|
| BUG-07 | Hidden products in the public API | **Closed** (browser check pending) | Hidden product absent from the public list, present in the admin list |
| BUG-01 | Invalid variant combinations | **Closed** | `qa-regression.test.js` 9 of 9 |
| BUG-02 | Unavailable products shown | **Closed** (browser check pending) | Server filter and storefront filter both exclude them |
| OBS-07 | Admin link in the shop | **Closed** | Link only appears on `/admin` |
| OBS-09 | Expired session | **Closed in code**, wording differs from AE-1 | Banner shown, editor stays open. Needs AP-16 in a browser |
| BUG-03 | Lockout counter | **Partly fixed** | Now per IP and cleared on success. Spec SI-8 wants per username + address and 15 minutes. Window is still 60 seconds |
| BUG-08 | Duplicate product names | **Still open** | Same name and same placement is accepted. Nir's rule (block same placement, warn on same name) is not built |
| BUG-04 | SQLite file in Git | **Still open** | `.gitignore` line is commented out. Now Medium: admin edits and deletes change this tracked file |
| OBS-10 | Stray files | **Still open** | `app_.js`, `server_.js`, `deploy-changes.patch` still present |

## 4. Increment 2 storefront results

| Requirement | Result | Notes |
|---|---|---|
| CUS-01 Category browsing | Pass | 3 categories, 5 rooms each, links on Home |
| CUS-02 Search | Pass with gaps | Name, description and material, any case, part of a word. No minimum of 2 characters (SG-02), name matches not first (SG-01) |
| CUS-03 Product card | Pass | Placement, name, material, CAD price, stock label, options button |
| CUS-04 Filters | Pass with gaps | AND across category and room, inclusive price in whole cents, bad input refused. Single-select only (SG-03), no sort (SG-04) |
| CUS-05 No results | Pass with gaps | Message and reset work. Wording, search term and category links differ from spec (SG-05). Clear filters also clears the search (SG-06) |
| CUS-06 Room filter | Pass | Matches an independent SQL check |
| Three-click rule | Pass | Every product is 2 clicks from Home |
| CUS-10 Product page | Pass | Own address `/products/:id`; bad or hidden ids show "Product unavailable" |
| CUS-11 Options and stock | Pass with gaps | Stock per combination matches the spec examples (50 x 50 Sage = 3, 45 x 45 Charcoal = 0). Sold-out products listed first, not last (SG-07). Drop-downs, nothing disabled or pre-selected (SG-08). Wording (SG-09) |
| ADM-09, ADM-10 | Pass | Price, stock and visibility changes reach the shop |

## 5. Issues

**Bugs and observations (open)**

| ID | Title | Severity | Owner |
|---|---|---|---|
| BUG-08 | Duplicate products accepted | Medium | Omkumar, rule from Nir |
| BUG-04 | SQLite file tracked in Git | Medium | Omkumar |
| BUG-03 | Lockout not per username, 60 s window (SI-8) | Low to Medium | Omkumar |
| OBS-13 | Behind Render the client IP may be the proxy, so the limit could be shared by everyone again. Needs `TRUST_PROXY_HOPS` on the host. README says this is unverified | Medium if unset | Omkumar to confirm |
| OBS-10 | Stray files in the repo | Low | Omkumar |
| OBS-12 | A deleted product's id is reused by the next product (no AUTOINCREMENT). Orders in Increment 3 could then point at the wrong product | Low now | Omkumar |
| OBS-14 | Demo data has no sold-out or unavailable product (C16) and product 6 material ends with a comma | Low | Nir |

**Gaps against the Increment 2 spec** (not bugs until Nir confirms the spec still applies)

| ID | Gap | Rule |
|---|---|---|
| SG-01 | Name matches not listed first | BR-4, C4 |
| SG-02 | Search runs on 1 character | BR-4 |
| SG-03 | Category and room filters are single-select | FL-1, FL-2 |
| SG-04 | No sort by price | BR-8 |
| SG-05 | No-results text, active filters, search term and category links; results page has no breadcrumb | NR-1, NR-2, BR-5 |
| SG-06 | Clear filters also clears the search term | FL-5 |
| SG-07 | Sold-out products are not listed after in-stock ones | BR-9, C6 |
| SG-08 | Size and Colour are drop-downs; no disabled values, no pre-selection of a single value | PP-2, PP-4, C7 |
| SG-09 | Wording: "This combination is unavailable", "N in stock for this option" | PP-5, C8 |

## 6. Questions

**For Omkumar:** Which of SG-01 to SG-09 will be built in Week 5? Is `TRUST_PROXY_HOPS` set on Render? Can the sqlite file be untracked and the stray files removed? Can product ids stop being reused before orders are built? When will the BUG-08 rule be built?

**For Nir:** Do you accept drop-downs and single-select filters for Release 1, or should they change? Please provide a sold-out and an unavailable demo product (C16). For BUG-08, should the same placement block the add, or update the existing product as your item 3 suggests?

## 7. Still to run on your computer (Node 24)

| Check | Result |
|---|---|
| `npm ci`, `npm test` (full suite, developer + QA): tests ____, passed ____, failed ____, todo ____ | |
| `npm run build` | |
| Browser cases TC-115 to TC-124 in the workbook (phone width, keyboard, sign-in, add product with Available on and off, expired session, edit, delete, photos, live site) | |
| AP-14 and AP-15 (hidden product, from Week 3) | |

The Increment 2 cart tests (TC-104 to TC-114) are written and wait for the cart.

## 8. Check against the proposal's completion checks (slide 8)

| Completion check | Status |
|---|---|
| Required features work | Catalogue, search, filters, product page and admin product management work. Cart, guest checkout and order numbers are not built yet |
| Totals and stock are correct | Stock per combination is correct. Totals cannot be tested until the cart exists |
| Admin access is protected | Guest, forged cookie and header checks passed in Week 2. Lockout is only partly fixed (BUG-03, OBS-13) |

## 9. Files in this submission

| File | Purpose |
|---|---|
| `QA_Week4_Report.pdf` | This report (the file to submit) |
| `QA_Test_Plan_and_Results_Increment2.xlsx` | 70 test cases with matrix IDs and results |
| `Bug_Log.md` | Open and closed issues |
| `apps/api/test/qa-week4.test.js` | New automated tests (run with `npm test`) |
