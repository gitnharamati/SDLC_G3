# Bug Log - Increment 2 (Week 4 build)

Tester: Romit Tejani. Status key: Open / Partly fixed / Closed. "Spec gap" = differs from the Increment 2 specification; Nir to confirm.

## Closed this week

| ID | Title | How closed |
|---|---|---|
| BUG-01 | Invalid variant combinations | `qa-regression.test.js` 9 of 9 pass |
| BUG-02 | Unavailable products shown | Server and storefront filter; test TC-57 |
| BUG-07 | Hidden products in public API | Test TC-55. Browser check AP-14, AP-15 pending |
| OBS-07 | Admin link in the shop | Link only on `/admin`; test TC-62 |
| OBS-09 | Expired session ignored | Banner and kept draft in code; wording differs from AE-1. Browser check AP-16 pending |

## Open

### BUG-08 - Duplicate products accepted (Medium)
- **Where:** `apps/api/src/product-editor.js` (`addProduct`), `update-product.js`
- **Steps:** Add "Woven cushion" twice with the same department, category and room.
- **Expected (Bug 08 Resolution):** Same placement is blocked or flagged for the inventory manager and logged; same name in another placement warns and can be ignored.
- **Actual:** Both saved. Same name in another room also saves silently (no warning).
- **Test:** `RT-BUG-08` (todo). **Status:** Open, README says awaiting review.

### BUG-04 - SQLite database file tracked in Git (Medium now)
- **Where:** `/.gitignore` (line `# /apps/api/data/*.sqlite*` is commented out), `apps/api/data/home-decor.sqlite`
- **Why Medium:** admin edits, deletes and photo uploads now write to this file, so teammates will get binary merge conflicts.
- **Fix:** active rule `apps/api/data/*.sqlite*`, then `git rm --cached apps/api/data/home-decor.sqlite`.
- **Test:** `RT-BUG-04` (todo). **Status:** Open.

### BUG-03 - Lockout rule (Low to Medium)
- **Fixed:** per client address, cleared on success (Week 3 complaint).
- **Not yet:** SI-8 asks for per username + address, 5 failures in 15 minutes, message "Too many attempts from this device. Try again in 15 minutes." Code uses a 60 second window and "Try again in a minute."
- **Test:** `RT-BUG-03` (todo). **Status:** Partly fixed.

### OBS-13 - Lockout may be shared behind the host proxy (Medium if unset)
- `req.ip` is only the real client when `TRUST_PROXY_HOPS` is set. Otherwise every visitor on Render may share one counter, which brings BUG-03 back. README: "hosted proxy behaviour is not yet verified".
- **To verify:** ask Omkumar; or on the live site send 6 wrong passwords from one device, then sign in correctly from another network. **Status:** Open.

### OBS-10 - Stray files (Low)
- `apps/api/src/app_.js`, `apps/api/src/server_.js`, `deploy-changes.patch`. **Test:** `RT-OBS-10` (todo). **Status:** Open.

### OBS-12 - Deleted product ids are reused (Low now)
- Delete the newest product, add another: it gets the same id. Once orders refer to products (Increment 3) this can attach an old order to a new product. Use AUTOINCREMENT or soft delete.
- **Test:** `TC-ADM-REG-06` (todo). **Status:** Open.

### OBS-14 - Demo data (Low)
- No product with 0 stock in every combination and none unavailable (spec C16). Product 6 material ends with a comma. **Test:** `TC-DATA-01`, `TC-DATA-02` (todo). **Status:** Open, for Nir.

## Spec gaps (Increment 2) - Nir to confirm

| ID | Gap | Rule | Test |
|---|---|---|---|
| SG-01 | Name matches not listed first (search "cotton": 2,4,5,6 instead of 2,4,6,5) | BR-4, C4 | TC-CUS-02-04 |
| SG-02 | Search runs on 1 character | BR-4 | TC-CUS-02-05 |
| SG-03 | Category and room filters single-select | FL-1, FL-2 | TC-CUS-04-05 |
| SG-04 | No sort by price | BR-8 | TC-CUS-04-06 |
| SG-05 | No-results wording, no term, no category links; no breadcrumb or active filters on results | NR-1, NR-2, BR-5 | TC-CUS-05-02 |
| SG-06 | Clear filters also clears the search term | FL-5 | TC-CUS-05-03 |
| SG-07 | Sold-out products not listed last | BR-9, C6 | TC-CUS-11-03 |
| SG-08 | Drop-downs; nothing disabled; single value not pre-selected | PP-2, PP-4, C7 | TC-CUS-11-04 |
| SG-09 | Wording of stock and missing-combination messages | PP-5, C8 | TC-CUS-11-05 |

## Notes
- Developer README says "20 browser scenarios passed" and 47 of 48 tests pass; QA has not independently reproduced the browser results or the Express-based suites yet (see report section 7).
- Dependency audit: README reports 16 moderate findings, no high ones.
