# Team 3 Home Decor Course Project

Home decor e-commerce application for Software Development Life Cycle.

The app is live @ https://sdlc-g3.onrender.com/

Nir Haramati: Business Analyst. Omkumar Patel: Developer. Romit Tejani: QA.

## Current milestone

The storefront shows products and stock by size and colour. Signed-in admins
can add products, set starting stock for each combination, and decide whether
the product appears in the shop. Angular displays data from the Express API,
which reads and writes SQLite. Editing existing products, photo uploads, checkout
and payments are not available yet.

## Requirements

- Node.js 24 LTS with npm. Check with `node --version` and `npm --version`.
- VS Code and a terminal. Angular CLI does not need a separate global installation.

Use Node 24 because the API uses its built-in SQLite module. Earlier Node versions
may not support this setup. The module may print an experimental warning on Node 24.

## Run locally

Open a terminal in the project root, where this README and the root package.json live.

```sh
npm ci
npm run dev
```

Open http://localhost:4200. The API runs on http://127.0.0.1:3000.
Leave the terminal running. Press Ctrl+C to stop both services.

If needed, run `npm run dev:api` and `npm run dev:web` in two separate terminals.
If a port is already used, stop the old process before starting again.
If you change the API port, update apps/web/proxy.conf.json to match.

The browser's `/api` requests go through Angular's development proxy. SQLite is
accessed by the backend only. No separate database server or account is needed.

## Try the storefront and Add Product demo

1. Open the shop at http://localhost:4200 and choose **Explore the collection**.
2. Open **View options and stock** on a product to see size, colour, and stock.
3. To test admin sign-in, stop the app and run the following in PowerShell
   from the project root:

   ```powershell
   $env:ADMIN_PASSWORD = Read-Host "Enter a temporary demo password (12 to 256 characters)"
   npm.cmd run dev
   ```

4. Open http://localhost:4200/admin and sign in with your temporary password.
5. Under **Add product**, enter a name, description, material, and price in CAD.
   Choose a department, category, and room. For example: Home Décor → Cushions
   → Living room.
6. Enter sizes such as `Small, Large` and colours such as `Sand, Sage`.
   The form makes four stock rows. Enter a whole quantity in each row.
7. Leave **Available in the shop** checked and choose **Save product**. Open
   the shop and check the new product's price and **View options and stock**.
   Try saving another product with visibility unchecked; it stays out of the shop.
8. Sign out when finished. If a session ends while saving, sign in again on the
   same page to keep your draft. Refreshing or closing the page clears the draft.

The password is set in the current terminal. Keep it out of Git. If PowerShell
blocks npm scripts, use `npm.cmd` in place of `npm` for the other commands too.

## Check the foundation

```sh
npm test
npm run build
```

API endpoints:

- GET /api/health: checks the database connection.
- GET /api/catalogue: returns departments, categories and rooms.
- GET /api/products: returns products, option combinations and stock from SQLite.

The public catalogue endpoints are read-only. `POST /api/admin/products`
requires an admin session and the `X-Admin-Request` header. It saves the product,
its options and stock together. `npm run build` builds Angular. `npm start`
runs Express and serves the built site when the Angular output is present.

## Folders

```text
apps/api/src       Express routes, SQLite schema and seed data
apps/api/test      Automated checks for the foundation
apps/web/src       Angular components and catalogue service
docs              Shared documentation and developer architecture note
roles/BA          Nir's documents
roles/DEV/Week 1   Developer progress and QA handover
roles/DEV/Week 2   Admin and storefront update with demo checks
roles/QA          QA documents
```

The database is created at apps/api/data/home-decor.sqlite on first startup.
The seed runs once, so restarting does not reset stock or duplicate data.
Database files, node_modules and build output stay out of Git. Commit the root
package-lock.json so teammates install the same dependency versions with npm ci.

## Sample data and decisions

All products, prices, stock and materials are demonstration content. The storefront uses original
illustrations for the sample categories. CAD is a display
assumption pending BA confirmation. The initial hierarchy follows Nir's proposed
default: one department, three categories, and five rooms under each category.

The PPT is the implementation baseline. Nir's later additions are proposals that
still need team review. See docs/Developer_Architecture.md for open decisions.


## Database and admin setup for QA

- Use Node 24. Keep the SQLite database out of Git. Each local copy seeds its
  own database on first start. Back up existing SQLite data before switching to
  a branch that removes the old tracked file, or before deploying this update.
- Startup upgrades existing valid variant data in place. A variant must have
  one size and one colour from its product, with no duplicate pair. Create the
  variant and its two option links in one transaction. If old rows violate
  these rules, the upgrade rolls back; check the database before trying again.
- Admin sign-in limits failed attempts per client IP. Direct connections
  ignore forwarded IP headers by default. If hosting behind a proxy, set
  `TRUST_PROXY_HOPS` only after confirming the trusted path length and how the
  proxy handles forwarded client addresses. Retest with two different client
  networks. Clients sharing an IP also share the limit.
- On Render, use a persistent disk with `DATABASE_PATH` pointing into the
  mounted disk if you need SQLite changes to survive restarts or redeploys.
  Keep the hosted demo on sample data until storage is set up.
