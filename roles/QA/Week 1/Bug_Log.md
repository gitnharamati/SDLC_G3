# Bug Log - Increment 0 (PR #1)

Tester: Romit Tejani. Status key: Open / Fixed / Retested / Closed.

## BUG-01 - Schema allows invalid variant combinations
- **Severity:** Medium
- **Where:** `apps/api/src/schema.sql` (`product_variants`, `variant_values`)
- **Steps:** In a database session, (a) insert a `product_variants` row with no `variant_values`; (b) add a second variant with the same size and colour as an existing one; (c) link a variant of product 1 to an option value belonging to product 2.
- **Expected:** Incomplete, duplicate or cross-product combinations are rejected.
- **Actual:** All three succeed.
- **Why it matters:** Stock is held per combination, so checkout stock checks could hit wrong or duplicate rows.
- **Status:** Open - assigned to Omkumar Patel

## BUG-02 - Unavailable products still shown on the storefront
- **Severity:** Low now, High once admin can switch products off
- **Where:** `apps/web/src/app/app.component.html`
- **Steps:** Set `products.available = 0` for a product, reload the page.
- **Expected:** Product is hidden or labelled unavailable.
- **Actual:** API returns `available: false`, but the page never uses it. _(Found by code review - confirm in browser.)_
- **Status:** Open - assigned to Omkumar Patel

## OBS-05 - Node 24 requirement is only a warning (suggestion)
- Running `npm ci` on Node 22 prints an engine warning but continues. Suggest README step 1: "`node --version` must show v24".
- **Status:** Open - suggestion

## OBS-06 - Developer did not browser-test mobile layout, options button, error/retry (QA to cover)
- Covered by TC-08, TC-11, TC-12, TC-14.
- **Status:** Open - QA to run
