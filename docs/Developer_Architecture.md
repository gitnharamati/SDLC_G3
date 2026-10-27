# Developer architecture

## Foundation

Angular runs in the browser and calls Express endpoints through HTTP. Express reads
SQLite and returns JSON. The browser never opens or edits the database directly.
An Angular service handles API calls separately from the page template.

Prices use integer cents to avoid storing currency as floating point. The API
returns priceCents; the page formats it for display. CAD is a temporary sample
display assumption, not an agreed business currency.

Products point to a subcategory. Category and department follow through the parent
relationships, which avoids storing contradictory placement. The read API returns
all three names. Catalogue tables use foreign keys and names unique per parent.

Each product defines option types and their values. A product variant represents
one combination and holds its own stock. Stock must be a nonnegative whole number.
The cushion sample has two sizes and three colours, giving six variants. Zero stock
is shown separately from other combinations. Photos have a separate table so their
order can be stored later. No photo upload workflow is implemented yet.

The sample seed runs in a transaction and records its version. It is safe to restart.
This is a first schema, not a final migration system. A later schema change needs a
versioned migration to preserve existing data.

## Next steps

1. Review the BA's Increment 1 specification and settle its open decisions.
2. Add admin accounts with password hashing, server sessions, logout and protected
   APIs. Agree session limits and the local versus deployed HTTPS setup first.
3. Add catalogue and product editing, including photos and option combinations.
4. Extend customer browsing, search and filters. Add cart and guest test checkout.
5. Save an order and decrement stock in one transaction. Test competing requests
   for the last unit. Create order records and unique order numbers.

No admin authentication or permissions are claimed in this foundation. No mutation
endpoints are exposed. The admin user/session, orders and order items tables will
be added with their corresponding features. Order items should retain the ordered
name, selected options and unit price even if a product later changes.

For the planned SQLite stock check, use an atomic conditional stock update within
a write transaction and check the affected row count. SQLite does not provide
the per-row locking described in the HTML schedule. The concurrency acceptance
criterion stays the same: only one request can take the last unit.

## Decisions needing team agreement

- Confirm the submission deadline before mapping the eight proposed weeks to dates.
- Confirm currency, taxes and delivery charges.
- Confirm the hierarchy, photo limits and admin session rules proposed by the BA.
- Decide whether email/SMS belongs in this release. It adds an external provider.
- Define or defer the seven-status event flow and order contesting process.
- Keep QR scanning and store billing pending discussion, as previously agreed.
- Confirm whether a deployed demo is required. Public hosting was outside the PPT's
  first version. Local setup is what this foundation currently supports.

## Relation to the PPT

Slides 5 to 7 describe the customer journey, Angular/Express/SQLite architecture,
reuse of code, separate responsibilities and validation. This foundation starts
the architecture. It does not claim the shopping journey, security or checkout is
complete. Full acceptance testing belongs to each feature as it is delivered.
