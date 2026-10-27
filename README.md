# Team 3 Home Decor Course Project

Home decor e-commerce application for Software Development Life Cycle.

Nir Haramati: Business Analyst. Omkumar Patel: Developer. Romit Tejani: QA.

## Current milestone

This is the developer foundation, not a finished store or a completed Increment 1.
It connects Angular to Express and a persistent SQLite database. It displays three
labelled sample products and stock for each size and colour combination. No
customer orders, payments, admin login or editing are available yet.

The existing BA and QA folders and documents have been kept.

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

## Check the foundation

```sh
npm test
npm run build
```

API endpoints:

- GET /api/health: checks the database connection.
- GET /api/catalogue: returns departments, categories and rooms.
- GET /api/products: returns products, option combinations and stock from SQLite.

All are read-only. Write endpoints will be added with admin authentication.
`npm run build` checks and builds Angular. `npm start` starts only the API;
serving the built frontend and HTTPS deployment are future work. This milestone
is for running locally using the development commands above.

## Folders

```text
apps/api/src       Express routes, SQLite schema and seed data
apps/api/test      Automated checks for the foundation
apps/web/src       Angular components and catalogue service
docs              Shared documentation and developer architecture note
roles/BA          Nir's documents
roles/DEV/Week 1   Developer progress and QA handover
roles/QA          QA documents
```

The database is created at apps/api/data/home-decor.sqlite on first startup.
The seed runs once, so restarting does not reset stock or duplicate data.
Database files, node_modules and build output stay out of Git. Commit the root
package-lock.json so teammates install the same dependency versions with npm ci.

## Sample data and decisions

All products, prices, stock and materials are demonstration content. Real product
photos are not included; the page labels the photo placeholders. CAD is a display
assumption pending BA confirmation. The initial hierarchy follows Nir's proposed
default: one department, three categories, and five rooms under each category.

The PPT is the implementation baseline. Nir's later additions are proposals that
still need team review. See docs/Developer_Architecture.md for open decisions.

