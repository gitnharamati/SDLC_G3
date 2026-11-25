# Home Décor Store

Team 3 · Software Development Life Cycle · Laurentian University

A course project for browsing home décor products and managing product details,
photographs and inventory. The customer pages and admin area use the same API
and database.

[Hosted demonstration](https://sdlc-g3.onrender.com/) · [Developer reports](roles/DEV/README.md)

This document describes the development branch. Features reach the hosted site
when the reviewed branch is merged and deployed.

## Project Team

| Team member | Student number | Responsibility |
| --- | --- | --- |
| Nir Haramati | 0474218 | Business analysis and requirements |
| Omkumar Patel | 0480176 | Application development and integration |
| Romit Tejani | 0476882 | Quality assurance and defect reporting |

## Current Functionality

| Area | Functionality |
| --- | --- |
| Catalogue | Category and room browsing with consistent product cards |
| Search | Case-insensitive name, description and material matching; minimum two characters; name matches ranked first |
| Filters | Multiple categories and rooms; inclusive CAD price limits; choices preserved in the URL |
| Sorting | Relevance, price low to high and price high to low; sold-out products last within relevance groups |
| No results | Search term, active filters, category links and Clear filters that preserves the search |
| Product pages | Photos, description, material, price, Size and Colour buttons, and stock per combination |
| Guest cart | Option selection, quantities, merged combinations, removal, item count and totals |
| Cart validation | Current server prices, stock caps and exclusion of hidden, deleted or invalid combinations |
| Admin | Username and password sign-in, sessions, product creation, editing, photo management and confirmed deletion |
| Duplicate products | Same placement blocked; same name elsewhere requires confirmation; duplicate cases recorded |
| Storage | SQLite locally; PostgreSQL for hosted storage; uploaded photos stored in the database |

## Customer Pages

The home page links to each launch category and room. Shop opens `/shop`,
product links open `/products/:id`, and the guest cart is available at `/cart`.
The header shows search, Shop and the total quantity in the cart. Staff sign-in
remains at `/admin`. Following the BA’s updated request, a verified signed-in
admin sees an Admin link in the storefront header; guests do not. The link is
rechecked when the page regains focus. Server authentication remains required.

Category and room choices combine with OR inside a group and AND across groups.
Search ignores a single character and explains the two-character minimum.
Relevance ranks name matches before description or material matches, with
in-stock products first inside each group. Empty searches use stock followed
by product ID. Price sorting compares integer cents.

Product options follow the order entered by the admin. Single-value options
are preselected. A value with no stock in any of its variants is disabled.
The selected combination shows its stock and chosen values; missing or sold-out
combinations cannot be added. Product photos can be selected through thumbnails
or swiped on a touch screen. Category artwork is the fallback.

## Cart Behaviour

The browser stores only product ID, variant ID and quantity for each cart line.
It does not store a price as the source of truth. The cart survives reloads and
closing the tab on the same browser. Clearing browser data removes it.

`POST /api/cart/check` is a read-only stock and price check used on Add to cart
and whenever the cart opens. Repeated additions merge the same combination.
A different combination creates another line. The header count is the sum of
quantities, not the number of lines.

Line totals and the order total use whole cents. Quantity changes recheck stock;
quantities above stock are capped with an Only N left message. An unavailable
or deleted item remains removable and is excluded from the total. A price
change detected during the current page session is shown with its previous
and current price. After a full page reload only the current server price is
available, because old prices are not persisted in browser storage.

Delivery reads Calculated at checkout. Checkout remains disabled for Increment 2.
Adding an item does not reserve or reduce inventory. Stock reduction and payment
belong to the later checkout increment.

## Product Management

Products are organised by department, category and room. Each has Size and Colour
values, with stock stored separately for each combination. Database rules reject
missing options, duplicate combinations, invalid references and invalid stock.
Product creation saves details, options, stock and photos together.

The BA's BUG-08 rule defines duplicates by placement rather than name. A new
product cannot be added to an occupied placement. The response identifies all
matching products and offers the admin an Update existing product action.
The existing product is changed only when its edit form is saved. A duplicate
name in a different placement produces a warning with an explicit option to
keep that name. Warnings, blocked additions and confirmed duplicate names are
recorded in `product_audit`.

Existing inventory is preserved, including any older products that share a
placement. This update does not merge or delete them automatically. Existing
product editing retains its placement and option definitions.

## Photographs and Deletion

Products support up to four JPG, PNG or WebP uploads, with a maximum input size
of 5 MB each. The backend validates and processes image content, applies
orientation, removes metadata and stores JPEG data resized to fit within
1600 by 1600 pixels. The first photo is the main image. Hidden or deleted
products do not expose photographs through the public image endpoint.

Deletion requires a signed-in admin and explicit matching confirmation.
Cancellation leaves records unchanged. Photos, options and variants are removed
in one transaction; a failure rolls back the deletion. SQLite keeps a record
of issued product and variant IDs so they are not reused after deletion.
PostgreSQL uses its existing sequences. IDs deleted before the SQLite identity
migration cannot be reconstructed from earlier history.

## Admin Access

The default username is `admin`; `ADMIN_USERNAME` can configure another username.
The password continues to come from `ADMIN_PASSWORD`. Passwords are checked
against an in-memory scrypt hash. Session cookies are random, HttpOnly,
SameSite Strict, scoped to the admin API and Secure in production.

Sessions expire after 30 minutes. Sign-out ends the session; restarts end
in-memory sessions. Expired-session messages preserve drafts on the page.
Admin writes require a session and the X-Admin-Request header.

Five failed sign-ins within 15 minutes block that username and network-address
pair for 15 minutes from the fifth failure. Success clears that pair's failures.
Forwarded addresses are trusted only when `TRUST_PROXY_HOPS` is explicitly set.
Its correct value depends on the actual proxy path and needs verification on
the deployed service. Authenticated session diagnostics report the configured
proxy value and observed client address for that check.

## Database and Repository

Local development defaults to SQLite when DATABASE_URL is absent. Hosted
production requires a PostgreSQL DATABASE_URL and does not fall back to temporary
SQLite storage. The existing import reads a SQLite backup without changing it
and refuses to overwrite changed hosted data. Uploaded database photos are
included in the import; separate legacy image files are not.

Startup migrations preserve existing product data. SQLite files, credentials,
installed dependencies and generated build output are excluded from source
control. The cleanup utility preserves the local database and creates an
external backup before untracking it. Tests use a controlled catalogue fixture
rather than a mutable development database.

## API Summary

| Endpoint | Purpose |
| --- | --- |
| GET /api/health | Connection and storage status |
| GET /api/catalogue | Departments, categories and rooms |
| GET /api/products | Visible products, options, photos and stock |
| GET /api/photos/:id | Public photograph for a visible product |
| POST /api/cart/check | Validate cart lines against current prices, visibility and stock |
| POST /api/admin/login | Sign in |
| GET /api/admin/session | Session and protected proxy diagnostics |
| POST /api/admin/logout | Sign out |
| GET /api/admin/products | Products including hidden records |
| POST /api/admin/products | Create a product with duplicate checks |
| POST /api/admin/products/:id | Update details and stock |
| GET /api/admin/products/:id/photos | Admin photo list |
| POST /api/admin/products/:id/photos | Add, remove and reorder photos |
| GET /api/admin/photos/:id | Protected photo preview |
| POST /api/admin/products/:id/delete | Delete a confirmed product |

## Development Validation

| Check | Recorded result for this branch |
| --- | --- |
| Automated API, database, access and storefront rules | 107 passed; no failures or TODOs |
| PostgreSQL integration | 27 passed; no failures or TODOs |
| Browser checks | 20 scenarios passed, including desktop and 390 px layouts |
| Angular production build | Passed |
| Production dependency audit | No reported findings |
| Full dependency audit | 16 moderate findings remain in development tooling |

The QA fixture contains controlled sold-out and hidden examples and cleaned
material text. It does not update the live catalogue or establish its current
data quality. Independent QA review and hosted verification of this Week 5
branch are still required.

## Remaining Scope

Checkout, orders, payment, notifications and in-store QR scanning belong to
later increments. The existing hosted data-retention test was confirmed by Nir
in Week 4. Week 5 cart and access-control changes still need a deployment check,
including client isolation through Render's actual proxy path. Moderate tooling
findings remain for dependency maintenance.

## Repository Structure

| Location | Contents |
| --- | --- |
| apps/api/src | API, access control and product operations |
| apps/api/src/migrations | SQLite migrations |
| apps/api/src/postgres | PostgreSQL schema and operations |
| apps/api/test | Automated checks and controlled fixtures |
| apps/web/src | Angular components, templates and styles |
| scripts | Startup, import and repository cleanup utilities |
| docs | Shared documentation and validation records |
| roles | BA, developer and QA weekly deliverables |

Products, prices, materials and stock are course demonstration content.
The application does not process purchases or move money.
