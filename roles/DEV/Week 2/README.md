# Week 2 Developer Update

I added an admin sign-in page to the Home Decor project. The server checks the
password and creates a session that lasts up to 30 minutes. Opening the admin
page while signed out shows the sign-in form. Signing out ends the session on
the server. Product and stock editing are the next step.

I also updated the storefront and admin page to use the same theme. The shop
now has a living-room illustration, product category artwork, and a layout that
adapts to narrower screens. Product options and stock still come from SQLite.

The Angular build and all five automated tests passed. The new API test checks
guest access, a wrong password, a correct password, sign-out, and the limit on
repeated failed attempts. Browser testing on the team's computers is still pending.

## Run and test locally

Stop the running development server first. In PowerShell at the repository root:

```powershell
$env:ADMIN_PASSWORD = Read-Host "Enter a local demo password (12-256 characters)"
npm.cmd run dev
```

Use a temporary demo password. It is set only in the current terminal and is not
part of the repo. Without it, the admin API stays disabled. Open
http://localhost:4200/admin and check:

1. A signed-out visitor sees the sign-in form.
2. A wrong password shows an error. The correct password opens the admin area.
3. Refreshing keeps the user signed in. Signing out and refreshing returns to the form.
4. The public catalogue and stock details still work.

Sessions are held in memory for this local demo, so restarting the API signs
everyone out. Use `npm.cmd test` and `npm.cmd run build` to repeat the checks.
