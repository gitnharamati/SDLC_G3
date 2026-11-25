# Week 5 Developer Work

Omkumar Patel · Developer · Student ID 0480176  
Home Décor Course Project · Team 3

This branch implements the cart and closes the nine storefront gaps listed in
the Week 4 group report. It also addresses the listed developer bugs. This is
the development record for review; it is not a claim of QA approval or deployment.

## Implemented Work

| Requirement or finding | Change |
| --- | --- |
| CUS-12 to CUS-15 | Guest cart, option gates, quantity changes, removal, persistence and CAD totals |
| SG-01 and SG-02 | Name matches first and two-character search minimum |
| SG-03 and SG-04 | Multiple category/room choices and price sorting |
| SG-05 and SG-06 | Query-aware no-results state, category links and Clear filters preserving the search |
| SG-07 | Sold-out products last within relevance groups |
| SG-08 and SG-09 | Option buttons, single-value preselection, disabled sold-out values and combination stock messages |
| BUG-08 | Placement collision block, existing-product edit action, duplicate-name confirmation and audit records |
| OBS-12 | Product and variant identifiers are not reused after deletion |
| BUG-03 | Failed sign-ins limited per username/address pair over 15 minutes |
| BUG-04 and OBS-10 | Database untracking utility, corrected ignore rule and removal of retired files |
| PR 9 behaviour | Edit form scrolling and product-name focus retained |

## Checks Recorded

- 107 automated checks passed with no failures or TODOs.
- 27 PostgreSQL checks passed, including simultaneous duplicate additions.
- 20 browser scenarios passed, including cart persistence and 390 px layouts.
- Production build passed.
- Production dependency audit reported no findings; the full audit still lists 16 moderate development-tool findings.

The controlled QA fixture replaces the old dependency on the editable SQLite
file. It includes sold-out and hidden products for repeatable tests. Historical
BA, developer and QA report documents are unchanged.

## Handover

QA should review the updated Week 4 tests and run the cart cases TC-104 to TC-114
and browser cases against this branch on Node 24. Check the actual Render proxy
path and sign-in isolation from two networks after deployment. The app exposes
proxy diagnostics only within an authenticated admin session. This environment
has not changed the Render service settings.

The same-placement rule applies to new additions. Existing products that share
a placement are retained. The admin chooses which one to edit; no inventory
is automatically overwritten or combined.

Checkout remains disabled, and adding to the cart does not reserve stock.
The cart stores IDs and quantities, not historical prices, in local storage.
A price-change note can compare prices seen during the same page session;
a full reload uses the current server price.

## References

- [BA Week 4 package](../../BA/BA%20-%20Week%204%20report/)
- [QA Week 4 report](../../QA/QA%20-%20Week%204%20report/QA_Week4_Report.md)
- [Developer reports](../README.md)
