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
| Staff dashboard | Protected overview with real product, stock, order and payment figures |
| Inventory | Searchable combinations, low/out-of-stock filters, guarded stock adjustments and audit history |
| Test checkout | Guest contact and Canadian address validation, atomic orders and stock changes, repeat-request protection |
| Orders | Customer and delivery details, saved line snapshots, seven statuses and recorded shipping events |
| Test payments | Server-controlled simulator, payment attempts, pending-work retries and no real charges |
| Admin | Username and password sign-in, sessions, product creation, editing, photo management and confirmed deletion |
| Duplicate products | Same placement blocked; same name elsewhere requires confirmation; duplicate cases recorded |
| Storage | SQLite locally; PostgreSQL for hosted storage; uploaded photos stored in the database |

## Customer Pages

The header provides one product search, Shop and the cart quantity. The
collection keeps category, room, price and sorting choices in Filter & sort.
Explore the collection scrolls to product results. A Back to top button appears
after scrolling. Search guidance dismisses after five seconds, on scrolling,
when typing, or with Escape and the close button.

Customer pages are `/shop`, `/products/:id`, `/cart` and `/checkout`. The footer's
Staff portal link opens `/staff`; `/admin` remains supported. Signed-in staff
also see the Admin header link. Every protected API still verifies the session.

Category and room choices combine with OR inside a group and AND across groups.
Search rejects empty and one-character submissions with guidance and preserves the current page.
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

Delivery reads Calculated at checkout. The test total includes item prices only;
no delivery charge is invented. Adding items does not reserve stock. Checkout
rechecks prices, availability and stock before saving anything.

## Staff Workspace and Test Orders

The staff portal opens on Overview, with Products, Inventory, Orders and Test
payments sections. Counts are read from the database; low stock means one to
five units per combination. Inventory adjustments require the stock loaded by
the admin and a reason. Stale stock writes return STOCK_CHANGED. Product editor
stock changes are also recorded. Products with order lines cannot be deleted;
staff can hide them while order history stays intact.

Guest checkout validates contact and Canadian address fields on the browser
and server. An email or ten-digit mobile number is required. An accepted order
has an HD-YYMMDD-NNNN number, snapshots of each product and option, and E1
history. Product locks and conditional stock updates prevent overselling.
Repeated checkout attempts return the same order; an attempt cannot be reused
with different details. A saved attempt can be recovered after a lost response.

The server calls the payment interface after the order transaction commits.
PAYMENT_SIMULATOR_MODE defaults to always_paid. The local test settings
always_not_paid and error exercise failure paths; production refuses them.
Approved simulation records E2 and a SIM reference. Failed simulation leaves
the order Received with stock reduced. Pending checks have durable scheduling
and up to three automatic retries one minute apart; the server checks due work
every fifteen seconds. Staff can request another pending check.

Orders move through Received, Paid, In assembly, Ready to ship, Handed to
shipper, On its way and Delivered to customer. Only the next shipping event is
offered. Events record the actor, time and optional note, with stale requests
rejected. Staff cannot submit the system-only payment and placement events.

This is a test checkout, not a card gateway. No money moves and no card details
are collected. Email and SMS delivery are not connected in this preview; the
confirmation explicitly asks the customer to keep the order number. Contest
review with a second admin is not included in this update. These remaining
Increment 3 items still require implementation and separate QA acceptance.

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
| POST /api/checkout/orders | Validate and place a guest test order |
| POST /api/checkout/recover | Recover a saved order using its secret attempt ID |
| GET /api/admin/workspace | Protected overview, stock, orders and adjustment records |
| POST /api/admin/inventory/:id | Guarded stock adjustment with reason |
| GET /api/admin/orders/:id | Protected order, customer, history and payment details |
| POST /api/admin/orders/:id/events | Record the next shipping event |
| POST /api/admin/orders/:id/payment | Recheck a pending simulated payment |
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
| Automated API, database, access and storefront rules | 120 passed; no failures or TODOs |
| PostgreSQL integration | 38 passed; no failures or TODOs |
| Browser checks | 10 staff/checkout scenarios and 25 storefront regressions passed; desktop, tablet and phones |
| Angular production build | Passed |
| Production dependency audit | No reported findings |
| Full dependency audit | 16 moderate findings remain in development tooling |

The QA fixture contains controlled sold-out and hidden examples and cleaned
material text. It does not update the live catalogue or establish its current
data quality. Independent QA review and hosted verification of this Week 5
branch are still required.

## Remaining Scope

Email/SMS provider integration, two-admin contest review and in-store QR
scanning remain outside this package. The complete BA rollback/concurrency
scenario set has not been signed off by QA. No live database or Render setting
was changed during development. Deployment, independent QA and the real proxy
path still require team verification. Moderate tooling audit findings remain.

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
The application places test orders only. It does not move money.
