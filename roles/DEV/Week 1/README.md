# Developer foundation and handover

Omkumar Patel 0480176, Team 3 Developer

## Work in this package

- Added an npm workspace with Angular frontend and Express backend.
- Added a persistent SQLite catalogue with products, per-product options and stock
  for each combination.
- Added sample department, categories, rooms and three products.
- Connected the Angular page to the backend product API.
- Added loading, connection error and retry states, and option stock details.
- Added automated database/API checks, setup instructions and architecture notes.

This is development setup and an early read-only catalogue, not a completed
Increment 1. The photo blocks are labelled placeholders. Admin login, catalogue
editing, photos, cart, checkout and orders still need implementation.

## QA handover

From the root, run npm ci, then npm run dev. Open http://localhost:4200.

1. Three sample products should load from the backend.
2. Open the cushion options. Six size/colour combinations should appear, including
   one with zero stock. Open another product and confirm the details change.
3. Check the page on a phone-width viewport and desktop.
4. Start the frontend without the backend (npm run dev:web). It should show a clear
   error and a Try again button. Start the API separately and retry.
5. Run npm test for database constraints, seed repeatability, persistence and API checks.
6. Run npm run build to check Angular compilation.

No completion status is assigned to ADM-01 to ADM-08. The seed supports the proposed
ADM-06 structure, but admin screens and their acceptance cases remain pending.

## Developer verification on 26 October 2026

- Four automated API/database tests passed.
- Angular production compilation passed.
- A live development check confirmed that Angular serves the page and forwards
  health and product requests to Express, which reads SQLite.
- Automated visual browser checks could not run because the browser download was
  unavailable in the development environment. Mobile appearance, button behaviour
  and error/retry display still need a browser check by the team.

## Weekly submission notes

Review this package and run it on the student's machine before submitting a report.
Record actual time spent; no hours are invented here. Copy the verified outcomes
into the weekly report and add the work date, issues and next tasks. Romit should
record independent QA results rather than treating developer checks as QA approval.

## Next work

Admin authentication and server access checks, followed by catalogue editing.
Team review is needed for proposed additions and the final deadline.
