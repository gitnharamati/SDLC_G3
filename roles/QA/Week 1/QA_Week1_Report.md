# QA Week 1 Report

**Tester:** Romit Tejani (0476882), QA / Tester
**Project:** Team 3 Home Decor E-Commerce Website
**Build tested:** Developer foundation, PR #1 (Omkumar Patel)
**Report date:** 26 October 2026
**Hours spent:** _(add your actual hours - not estimated here)_

## 1. Scope

Tested the read-only catalogue foundation: three sample products with size/colour options and stock, the Express API and the SQLite schema.

Not in scope (not built yet): admin login, product editing, search, filters, cart, checkout, orders. These will be tested as each feature is delivered (see slides 8 and 9 of the proposal).

## 2. Approach

Following the proposal's QA plan: plan test cases, run tests, log bugs, retest fixes. Developer checks were treated as input, not as QA approval.

- Reviewed the README, developer handover (`roles/DEV/Week 1/README.md`) and code.
- Wrote 23 test cases (`QA_Test_Plan_and_Results_Increment0.xlsx`).
- Ran database/schema checks against the project's real schema and seed data.
- Browser, mobile and error/retry checks: _(update after your local run on Node 24)_

## 3. Results so far

| Measure | Count |
|---|---|
| Test cases written | 23 |
| Passed | 5 |
| Failed | 2 |
| Not yet run | 16 |

Passed: product data and hierarchy are correct (3 products, 6/4/4 option combinations, stock totals 35/20/11, 3 categories x 5 rooms); database rejects negative, decimal and text stock, price 0, blank names, duplicate SKUs and invalid references; seed does not duplicate data on restart.

Failed: see section 4.

## 4. Issues found

| ID | Title | Severity |
|---|---|---|
| BUG-01 | Schema allows variants with no options, duplicate combinations, or options from another product | Medium |
| BUG-02 | Products with `available = 0` are still shown (UI ignores the flag) | Low now, higher once admin exists |

Details and reproduction steps are in `Bug_Log.md`.

## 5. Risks

- Option/stock integrity (BUG-01) affects the "only one order can succeed for the last item" test planned for checkout.
- Mobile layout and error/retry display were not browser-tested by the developer; they are covered by TC-11, TC-12 and TC-14.

## 6. Next tasks

1. Finish manual browser tests (TC-01 to TC-19) and update results.
2. Report BUG-01 and BUG-02 to the developer and retest after fixes.
3. Prepare test cases for admin access control and for the stock-conflict checkout test.
4. Confirm with Nir which acceptance criteria apply to the next increment.
