# Bug Log - Increment 1 (Week 2 build)

Tester: Romit Tejani. Status key: Open / Fixed / Retested / Closed.

## BUG-01 - Schema allows invalid variant combinations (carried over from Week 1)
- **Severity:** Medium
- **Where:** `apps/api/src/schema.sql` (`product_variants`, `variant_values`)
- **Steps:** (a) insert a `product_variants` row with no `variant_values`; (b) add a second variant with the same size and colour; (c) link a variant of product 1 to an option value of product 2. Or run `qa-regression.test.js` (BUG-01a, b, c).
- **Expected:** All three rejected.
- **Actual:** All three still accepted on the Week 2 build (schema unchanged). Confirmed on Node 24 by the three `todo` tests.
- **Why it matters:** Stock is per combination; checkout stock checks could hit wrong or duplicate rows.
- **Status:** Open - assigned to Omkumar Patel

## BUG-02 - Unavailable products still shown on the storefront (carried over from Week 1)
- **Severity:** Low now, High once admin can switch products off
- **Where:** `apps/web/src/app/app.component.html`
- **Steps:** Set `products.available = 0` for a product, reload the shop.
- **Expected:** Product hidden or labelled unavailable.
- **Actual:** API returns `available: false`; the template does not use it (code review - confirm in browser).
- **Status:** Open - assigned to Omkumar Patel

## BUG-03 - Admin sign-in lockout is global
- **Severity:** Medium (Low for local demo)
- **Where:** `apps/api/src/admin.js`, `/login` (one shared `failures` counter)
- **Steps:** From any client send 5 wrong passwords. Within 60 seconds sign in with the correct password.
- **Expected:** Correct password works, or the limit applies per client.
- **Actual:** 429 "Too many attempts" for everyone, including the correct password, until the minute ends. A successful sign-in also does not clear the counter. The developer's own `admin.test.js` asserts the 429 for the correct password.
- **Why it matters:** Anyone can keep the admin locked out with one request every few seconds.
- **Suggestion:** Count failures per client address, or at least per client, and clear on success.
- **Retest:** Confirmed on Node 24 by `qa-admin.test.js` (BUG-03 test: 429 instead of 200).
- **Status:** Open - to report to Omkumar Patel

## BUG-04 - SQLite database file is tracked in Git
- **Severity:** Low now, Medium once admin can edit stock
- **Where:** `/.gitignore` line `data/*.sqlite*`; file `apps/api/data/home-decor.sqlite`
- **Steps:** `git ls-files apps/api/data` and `git check-ignore -v apps/api/data/home-decor.sqlite`.
- **Expected:** Database file ignored and not in the repo (README: "Database files ... stay out of Git").
- **Actual:** A pattern containing a slash is anchored to the repo root, so it never matches `apps/api/data/`. In a test repository the file was not ignored, and the file is present in the main branch download.
- **Why it matters:** Stock edits will modify a tracked binary file and cause merge conflicts between teammates.
- **Suggestion:** Use `**/data/*.sqlite*` (or `apps/api/data/*.sqlite*`) and run `git rm --cached apps/api/data/home-decor.sqlite`. The app recreates and reseeds it on startup.
- **Status:** Open - to report to Omkumar Patel (please confirm with `git ls-files` on your clone)

## OBS-05 - Node 24 requirement is only a warning (suggestion)
- Older Node prints an engine warning and continues. Suggest README step 1: "`node --version` must show v24".
- **Status:** Open - suggestion

## OBS-07 - Admin link shown in the public navigation
- Every customer sees the Admin link. The page is protected, so no security risk; a design choice for Nir.
- **Status:** Open - for Nir

## OBS-08 - Week 2 pushed directly to main
- The developer report says this was agreed with Nir. The proposal (slide 7) plans small commits reviewed by a teammate before merging. Suggest using a branch and pull request for future changes, so QA can test before merge.
- **Status:** Open - suggestion

## OBS-09 - Admin page does not notice an expired session
- Session lasts 30 minutes (or until the API restarts). The page stays on "signed in" until the next request. Sign out then shows an error. Matters once product and stock editing needs a valid session.
- **Status:** Open - suggestion

## OBS-06 - Developer did not browser-test mobile layout, options button, error/retry (carried over)
- Developer said browser testing on team computers was pending. QA ran these checks (TC-31 to TC-34, TC-45 to TC-52) and they passed.
- **Status:** Closed - done by QA
