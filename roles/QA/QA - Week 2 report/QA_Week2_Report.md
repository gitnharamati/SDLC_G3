# QA Week 2 Report

**Tester:** Romit Tejani (0476882), QA / Tester
**Project:** Team 3 Home Decor E-Commerce Website
**Build tested:** Developer Week 2 update on `main` (Omkumar Patel): admin sign-in and sign-out, new shop theme
**Report date:** 8 November 2026
**Hours spent:** 6.5 hours (reading the developer report and code review 1.5; writing test cases 1.5; writing automated QA tests 1.5; running tests and build 0.5; browser testing 1.0; bug log and report 0.5)
**Test environment:** Windows laptop, Node 24, Angular dev server on http://localhost:4200, API on http://127.0.0.1:3000, SQLite sample data (3 products, 14 option combinations)

## 1. Scope

Tested the Week 2 features from the developer report: admin sign-in / sign-out, the new shop and admin theme, and the stock display ("View options and stock"). Also re-tested the two Week 1 bugs.

Not in scope (not built yet): editing products and stock, search, filters, cart, checkout, orders, payments.

## 2. Approach

Following the proposal's QA plan (slide 8): plan test cases, run tests, log bugs, retest fixes. The developer's own results are treated as input, not as QA approval.

- Read the developer report, README and code (`admin.js`, `app.js`, `admin.component.ts`, `app.component.html`, `styles.css`, `schema.sql`).
- Wrote 31 test cases (`QA_Test_Plan_and_Results_Increment1.xlsx`), continuing from Week 1 (TC-24 to TC-54).
- Wrote automated QA tests: `apps/api/test/qa-admin.test.js` (14 admin tests) and `apps/api/test/qa-regression.test.js` (8 database tests).
- Re-ran the Week 1 bug checks on the Week 2 code, checked colour contrast from the theme CSS, and checked `.gitignore` behaviour in a test repository.
- Ran `npm test` and `npm run build` on Node 24 (Windows).
- Ran the manual browser tests: sign-in, sign-out, wrong password, refresh and Back behaviour, options button and stock display, zero-stock labels, mobile widths, keyboard use, error/retry, and a second browser.

## 3. Results so far

| Measure | Count |
|---|---|
| Test cases written | 31 |
| Passed | 26 |
| Failed | 3 |
| Observations | 2 |
| Not yet run | 0 |

Automated run on Node 24 (Windows), `npm test`: 28 tests, 24 pass, 0 fail, 4 `todo`. The `todo` tests are the known bugs (BUG-01a, b, c and BUG-03) and fail as expected. `npm run build` succeeded.

Passed: Developer's 5 tests (re-run independently); build; admin access checks - admin disabled without a password or with a short one, guest/forged/malformed cookies rejected, bad sign-in input rejected, X-Admin-Request header required, cookie flags correct, 30-minute expiry, 429 after 5 failures, sign-out ends the session, public catalogue exposes no admin data and has no write routes; no hard-coded secrets; theme text contrast (lowest text ratio 5.1:1); all 13 manual browser tests (sign-in form, wrong password, sign-in, refresh, sign-out and Back, API restart, options and stock display, out-of-stock labels, mobile widths, keyboard use, error/retry, artwork loading, second browser).

Failed: Week 1 bugs BUG-01 and BUG-02 are still present (TC-26, TC-27); BUG-03 confirmed in the admin lockout (TC-41). BUG-02 was found by code review and still needs a browser confirmation.

Developer report claims: "five automated tests pass" and "build passes" are confirmed. The browser checks the developer asked for (sign-in, sign-out, wrong password, View options and stock) also passed in QA browser testing.

## 3a. Check against the proposal's completion checks (slide 8)

| Completion check | Status this week |
|---|---|
| Required features work | Not complete: admin sign-in and the stock display are built; product/stock editing, search, cart and checkout are not built yet. |
| Totals and stock are correct | Stock data checked at database level (35 / 20 / 11 across the three products) and stock cannot go below zero. Order totals cannot be tested until checkout exists. |
| Admin access is protected | API checks pass (guests, forged cookies, missing header, expiry, sign-out). Browser checks pass. BUG-03 (global lockout) needs a fix. |

## 4. Issues found

| ID | Title | Severity | Status |
|---|---|---|---|
| BUG-01 | Schema allows variants with no options, duplicate combinations, or options from another product | Medium | Open, still reproducible |
| BUG-02 | Unavailable products still shown (page ignores the flag) | Low now, higher once admin edits products | Open, still present |
| BUG-03 | Admin lockout counter is global: 5 failures from anyone block the real admin, even with the right password | Medium | New |
| BUG-04 | SQLite database file is tracked in Git; `.gitignore` pattern `data/*.sqlite*` does not match `apps/api/data/` | Low now, Medium once stock is editable | New |

Observations: OBS-05 (Node version check in README), OBS-07 (Admin link visible to customers), OBS-08 (Week 2 pushed straight to main without review), OBS-09 (admin page does not notice an expired session). Details and reproduction steps are in `Bug_Log.md`.

## 5. Risks

- BUG-01 still affects the planned "two requests for the last item, only one order succeeds" test, because stock is stored per option combination.
- BUG-04 will become a team problem once admins can edit stock: stock edits will change a tracked file and cause merge conflicts.
- Product and stock editing, planned next by the developer, will depend on the admin session. Session expiry handling (OBS-09) and the lockout behaviour (BUG-03) should be settled first.
- BUG-02 and BUG-04 were found by code review and a test repository; both still need confirming on the real project (browser and `git ls-files`).

## 6. Next tasks

1. Confirm BUG-02 in the browser and BUG-04 with `git ls-files apps/api/data`.
2. Report BUG-01 to BUG-04 to Omkumar; retest after fixes. Share OBS-07 and OBS-08 with Nir.
3. Prepare test cases for product/stock editing (admin-only access, validation, stock cannot go below zero) before it is built.
