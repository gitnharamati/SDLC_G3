# Keep products saved after deployment

This update keeps the site on Render and lets it store products in a separate
PostgreSQL database. It supports Neon's Free plan. No paid Render disk is needed.
The local SQLite option still works for development. Uploaded photos are
stored as compressed image data in the selected database, alongside products.
They do not depend on Render’s temporary filesystem. Photos use the database
plan’s storage allowance, so keep course demo images reasonably small.

The code is ready to test locally. The live fix is complete only after the
database is connected and the team passes the redeployment check below.

## 1 Copy the update and test on Windows

1. Stop the app with Ctrl+C.
2. Pull the latest team code before copying this update. The bundle was made
   from main at b673c72. If there are newer changes to the same files, review
   them before replacing files.
3. Extract the ZIP into your existing SDLC_G3 folder. The apps and scripts
   folders must merge with the existing folders. Choose Replace when asked.
   Keep the ZIP itself outside the repo.
4. Open PowerShell in SDLC_G3. Use Node 24.

   ```powershell
   npm.cmd ci --include=dev
   npm.cmd test
   npm.cmd run build
   $env:ADMIN_PASSWORD = Read-Host "Enter a temporary demo password with at least 12 characters"
   npm.cmd run dev
   ```

5. Open http://localhost:4200/admin. Without DATABASE_URL this uses your local
   SQLite database. This check alone does not prove hosted persistence.

## 2 Create a free hosted database

Nir or another team member needs to do this in their own account.

1. Open https://neon.com and create a project on the Free plan. Choose a region
   close to the Render service. Keep the plan free and do not enable paid
   upgrades. The plan has usage limits; check them in the account dashboard.
2. Open the project's connection details. Select a Node.js/PostgreSQL connection
   string for the main database. A pooled connection is suitable for the app.
3. Copy the entire connection string, including its query parameters.
   It contains a password. Do not post it in WhatsApp, commit it, or include
   it in screenshots or reports. Enter it directly in Render's Environment page.
4. Before deploying this code, set these Environment values on the existing
   Render web service:

   - DATABASE_URL: the private PostgreSQL connection string
   - NODE_ENV: production
   - ADMIN_PASSWORD: keep the existing demo password setting

5. Keep the build command as `npm ci --include=dev && npm run build` and start command as
   `npm start`. Deploy the commit after setting DATABASE_URL. If Render triggers
   a deploy while editing settings, redeploy after both code and settings are ready.
6. Open https://sdlc-g3.onrender.com/api/health.
   It should show `"storage":"postgres"` and `"database":"connected"`.
   A successful shop page by itself is not enough to check database selection.

The server refuses to start in production without DATABASE_URL. It also stops if
the connection fails instead of silently creating a new local SQLite database.
Do not disable TLS certificate verification to work around a connection error.

## 3 Import Nir's existing local products once

Do this before anyone adds new products to the hosted PostgreSQL database.

1. Nir should stop his local app and copy its populated SQLite file to a safe
   backup location outside the repo. Keep that backup.
2. In his updated SDLC_G3 folder, open PowerShell:

   ```powershell
   $env:DATABASE_URL = Read-Host "Paste the private PostgreSQL connection string"
   npm.cmd run db:import -- "C:\path\to\populated-backup.sqlite"
   Remove-Item Env:DATABASE_URL
   ```

3. Replace the example path with the actual backup path. The import copies
   product IDs, names, descriptions, prices, options, visibility and stock.
   The original SQLite file is opened read-only.
4. The import accepts an empty database or an unchanged sample catalogue.
   It refuses to replace a hosted catalogue that already has added or changed
   data. Reimporting the exact same snapshot is a harmless no-op.
5. Invalid combinations or references cause the import to roll back. Do not
   delete the hosted database or your backup to get around an import error.
6. Photos uploaded with this update are stored inside the database and copied
   by the import. Older photo path text is also copied, but separate image files
   referenced by old paths are not transferred. Upload those photos through the
   admin page after import.

Keep databases and credentials out of Git. If someone has already tracked a
SQLite file, `.gitignore` alone will not untrack it. Back it up, then run
`git rm --cached -- apps/api/data/home-decor.sqlite` only if
`git ls-files apps/api/data` lists that file. This keeps the local file.

## 4 Confirm the live fix

1. Verify the health endpoint reports PostgreSQL.
2. Add one clearly named sample product online. Record its price, size, colour
   and stock; include a photo and check them in the shop.
3. Ask Nir to redeploy the same Render service.
4. Reload the shop and confirm the same product, photo, price, options and stock remain.
5. Sign in again if needed. Admin sessions are still held in server memory and
   end after a restart. Signing out does not delete products.
6. Only after this check passes should the team report the hosted issue resolved.

## Testing included

- SQLite/API suite: 41 passes and one existing QA TODO for BUG-03. That TODO
  uses the same client for both sets of login attempts. This update does not
  change Romit's test or claim the remaining hosted proxy check is complete.
- PostgreSQL integration: fresh setup, variant constraints, SQLite import,
  repeat import, restart, stock preservation, admin writes, hidden products,
  invalid input, refusal to overwrite changed data, and import rollback.
- Product photos: real image decoding, limits, protected admin access, creation,
  reorder/removal, invalid input rollback, hidden photos and restart persistence
  on both SQLite and PostgreSQL.
- Browser checks: photo previews, create/edit, main photo, shop gallery, and
  mobile layout at 390 pixels.
- Angular production build.

To repeat PostgreSQL integration tests, use a separate disposable test database:

```powershell
$env:TEST_DATABASE_URL = Read-Host "Paste a test database connection string"
npm.cmd run test:postgres
Remove-Item Env:TEST_DATABASE_URL
```

The tests create and remove their own temporary schemas. Do not use the live
project database for tests. Provider setup and an actual Render redeployment
must still be checked by the team.

## Reference

- Render local file limitations: https://render.com/docs/free
- Neon Free plan: https://neon.com/pricing
- Node PostgreSQL transactions: https://node-postgres.com/features/transactions
