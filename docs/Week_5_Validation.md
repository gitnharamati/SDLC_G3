# Week 5 Development Validation

Branch: `feat/week-5-cart-and-storefront`  
Base: `da412e8` from main  
Runtime: Node 24

## Scope

This combined update implements CUS-12 to CUS-15, SG-01 to SG-09, the BA's
BUG-08 placement rule, stable product/variant identifiers, the revised sign-in
limit and repository cleanup. It retains the merged PR 9 editor behaviour.

No checkout, order, payment or notification flow is added. Existing local and
hosted product records are not replaced by the update package.

## Automated Results

| Check | Result |
| --- | --- |
| Clean dependency installation | Passed with the committed lockfile |
| API, SQLite, access and shared storefront rules | 107 passed; 0 failed; 0 TODO |
| Disposable PostgreSQL integration database | 27 passed; 0 failed; 0 TODO |
| Browser scenarios | 20 passed on the production build |
| Production build | Passed |
| Production dependency audit | 0 reported findings |
| Full dependency audit | 16 moderate development-tool findings remain |

The PostgreSQL checks use isolated schemas. They cover imports, image data,
updates, deletion rollback, current cart values, duplicate-name confirmation,
audit records, simultaneous additions in one placement and identifier reuse.
They do not connect to the team's live inventory.

The browser checks cover navigation, multiple filters, URL persistence,
short searches, no results, sorting, price bounds, option buttons, stock
messages, add-to-cart gates, merged combinations, changed prices, capped
quantities, removal, local storage, a new tab, unavailable items, single-value
options, desktop/390 px layouts and the duplicate-to-edit flow.

## QA Test Maintenance

The Week 4 QA case IDs are retained. Their old copied filtering implementation
has been replaced by imports of the storefront rules used by Angular. Assertions
for the former single-select controls and old messages now follow the final
specification. Product creation fixtures use distinct free placements under the
new BUG-08 rule. Blocked and confirmed duplicate cases are also tested directly.

The QA catalogue is a JSON test fixture, not a live database. It supplies sold-out
and hidden examples and clean material values. Tests no longer depend on the
contents of `apps/api/data/home-decor.sqlite`. These fixture changes do not mean
that the current hosted inventory has been checked or edited.

## Local Repository Cleanup

The update includes `npm run repo:prepare-week5`. With the app stopped, it backs
up the local SQLite database and retired files outside the repository, untracks
the database and removes `app_.js`, `server_.js` and `deploy-changes.patch`.
The active local database stays in place. The corrected ignore rule covers
SQLite files and their journal files. The ZIP does not contain a database file.

The cleanup utility was tested in a disposable Git repository. Checks confirmed
backup creation, a WAL-file guard, database preservation, staged untracking,
retired-file removal and a repeat run. It does not commit or push changes.

## Hosted Verification After Review

The existing DATABASE_URL and ADMIN_PASSWORD remain in Render. The default
username is `admin` unless ADMIN_USERNAME is configured. Migration 3 adds an
audit table on PostgreSQL; the SQLite migration also records issued IDs.
Older inventory with repeated placements is preserved and remains editable.

TRUST_PROXY_HOPS must match the actual ingress path, rather than being set to
an assumed universal value. An authenticated GET /api/admin/session reports
proxyHops and clientAddress. Compare the observed address from two networks,
confirm the forwarded-header handling and then test that failures on one
username/address pair do not block the other. The local tests use an explicitly
trusted test proxy and also check that untrusted forwarding headers cannot
bypass the limit. No Render settings were changed by this development run.

After deployment, QA should repeat TC-104 to TC-114, the affected storefront
cases, admin access checks and a photo/redeployment check. Those hosted checks
and independent QA acceptance remain pending.

## Known Boundaries

The cart rechecks stock but does not reserve it. It persists IDs and quantities
only. Price-change notes compare values held during the current page session;
a full page reload displays the current server price without an old-price
comparison. Existing stock is changed only by the admin until checkout is built.

Existing duplicate placements are not automatically merged or deleted. New
additions are blocked until the admin chooses an existing product to edit.
Past identifiers deleted before the SQLite migration cannot be reconstructed;
all identifiers present at migration and issued afterwards are retained.
