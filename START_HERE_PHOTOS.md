# Team 3: product photos and editing update

Prepared for the existing SDLC_G3 project. Based on main at b673c72.

## 1. Copy the changed files

1. Close the running app with Ctrl+C. Back up your current SDLC_G3 folder.
2. Check GitHub Desktop for any uncommitted team work before replacing files.
3. Extract this ZIP directly into SDLC_G3, where package.json is located.
   Merge the apps/scripts folders and choose Replace for matching files.
   Do not create another SDLC_G3 folder inside the current one.
4. Keep the ZIP outside your repository. It is a delivery file, not source code.

The ZIP contains only changed/new source files, tests and instructions. It does
not contain a database, credentials, node_modules, team reports or Git history.
It will not replace Nir’s populated SQLite file. The app upgrades a valid local
database on startup; keep a backup before running the update.

## 2. Run on your Windows laptop

Open PowerShell in SDLC_G3 and use Node.js 24. Enter these lines one at a time:

```powershell
npm.cmd ci --include=dev
npm.cmd test
npm.cmd run build
$env:ADMIN_PASSWORD = Read-Host "Enter a demo password (12 to 256 characters)"
npm.cmd run dev
```

Open http://localhost:4200/admin and sign in using the password you entered.
Keep that PowerShell window open. Stop the app with Ctrl+C when finished.
If you see “Admin access is not configured”, set the password in the same
PowerShell window that starts the app, then restart it.

Without DATABASE_URL, local development uses your existing SQLite database.
If you previously set DATABASE_URL in this window and want SQLite instead,
run `Remove-Item Env:DATABASE_URL` before starting the app.

## 3. Try the new features

- New product: fill in the normal form and choose up to four photos. Check the
  previews, then save. The first photo is the main photo in the shop.
- Existing product: find it under Manage products and choose Edit product.
  Change its name, description, material, price, visibility or stock. Choose
  Save details and stock.
- Existing photos: upload more, remove a photo or choose Make main. Choose
  Save photos to apply the changes. Removing a preview alone does not save it.
- Shop: check that the real product photo appears. Expand View options and
  stock to switch between photos. Products without photos keep the artwork.
- Restart the app and check that the product, photos and stock remain saved.
- Ask Romit to test both new products and existing products, including invalid
  files, hidden products, zero stock and a narrow mobile screen.

Supported uploads: JPG, PNG and WebP, up to 5 MB per file and four photos per
product. The server checks the actual image, reduces it to a maximum of
1600 × 1600 pixels and saves a JPEG copy without the original metadata.
Animated images and unsupported formats are rejected.

Existing product editing keeps the department/category/room and size/colour
structure unchanged. It edits the stock of the existing option combinations.
Checkout, payment and Nir’s separate Bug 08 proposal are outside this update.

## 4. Before committing and going live

This bundle includes the PostgreSQL storage update as well as product photos.
For production, the server now REQUIRES DATABASE_URL. Before pushing to main
if Render deploys automatically, arrange the database setting with Nir using
HOSTED_DATABASE_SETUP.md. Pushing files alone does not set up hosted storage.

Local files on free Render hosting are temporary. To retain both products and
photos online, connect the separate hosted PostgreSQL database, import Nir’s
populated SQLite backup once, and test an actual Render redeployment. Uploaded
photos are stored in the database, so a separate image-hosting account is not
needed. Database storage limits still apply.

Do not commit passwords, .env files, SQLite databases or the downloaded ZIP.
A file already tracked by Git is not removed just by updating .gitignore.
The hosted setup guide explains how to keep a backup and stop tracking it.
Commit the changed source files, SQL migrations, tests, instructions and both
package files. The new dependencies are installed by npm ci.

Suggested commit summary: Add product photo uploads and admin product editing

Suggested description:
Add photo previews, main photo selection, removal and storefront galleries.
Allow admins to edit existing product details and stock. Validate uploads and
store images in SQLite locally or PostgreSQL online. Include hosted database
setup and safe SQLite import instructions.

The live website has not been changed by this ZIP. Finish local testing and
hosted setup before telling the team that deployment persistence is resolved.
