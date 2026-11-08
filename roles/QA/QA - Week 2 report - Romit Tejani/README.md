# QA Week 2 - Romit Tejani (0476882)

QA / Tester, Team 3 Home Decor E-Commerce.

## Documents to submit

| File | Purpose |
|---|---|
| `QA_Week2_Report.md` | Weekly QA report: scope, approach, results, issues, risks, next tasks |
| `QA_Test_Plan_and_Results_Increment1.xlsx` | 31 test cases, results and bug log (summary counts update automatically) |
| `Bug_Log.md` | Bugs and observations to hand to the developer |

## QA code (in `apps/api/test/`)

| File | Purpose |
|---|---|
| `qa-admin.test.js` | 14 independent API tests for admin sign-in, sign-out, cookies, expiry and lockout |
| `qa-regression.test.js` | Database regression tests, including Week 1 BUG-01 (marked `todo` until fixed) |

Run with `npm test` from the repo root (Node 24).

## Build under test

Developer Week 2 update on `main` (Omkumar Patel): admin sign-in and sign-out, new shop theme.
