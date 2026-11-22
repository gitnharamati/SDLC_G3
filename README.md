# Home Décor Store

**Team 3 · Software Development Life Cycle · Laurentian University**

Home Décor Store is a course project that provides an online product catalogue
and an admin interface for managing home décor products and inventory.

**Hosted demonstration:** [sdlc-g3.onrender.com](https://sdlc-g3.onrender.com/)

This README describes the current development version. Availability on the
hosted demonstration depends on the deployed branch and database configuration.

## Project Team

| Team member | Student number | Responsibility |
| --- | --- | --- |
| Nir Haramati | 0474218 | Business analysis, requirements and project documentation |
| Omkumar Patel | 0480176 | Application development and integration |
| Romit Tejani | 0476882 | Quality assurance, test cases and defect reporting |

## Project Overview

The application supports a home décor catalogue with cushions, bed sheets and
curtains. Products are organised by department, category and room. Shoppers can
view product details, photographs, prices in CAD and stock for individual size
and colour combinations.

The project follows an incremental development approach. The current development version includes catalogue management, storefront search
and filters, and a dedicated product page. Shopping cart, checkout and order
management belong to later work. The team’s
requirements and project presentation form the implementation baseline.

## Functional Coverage

| Area | Current functionality |
| --- | --- |
| Storefront | Category browsing, product cards, prices, material and room information |
| Search and filters | Search names, descriptions and materials; category, room and inclusive CAD price filters |
| Search results | Result counts, no-results message, validation and clear filters |
| Product details | Dedicated URL, photographs, description, material, price and stock by size and colour |
| Admin access | Sign-in, session checks and sign-out |
| Product creation | Details, category placement, options, starting stock and photos |
| Product editing | Name, description, material, price, visibility and existing stock |
| Photo management | Upload, preview, main photo selection and removal |
| Product visibility | Hidden products excluded from the public catalogue |
| Product deletion | Confirmation and removal of the product and related records |
| Layout | Responsive pages and consistent card text spacing |
| Storage | SQLite locally and PostgreSQL support for hosted deployment |

### Products and Inventory

Each product contains a name, description, material, price and category placement.
Sizes and colours define its stock combinations. A product with two sizes and
two colours has four combinations, each with its own quantity and SKU.

The backend validates required fields, positive prices, category relationships,
unique options and whole stock quantities. Database rules reject incomplete
variants, duplicate size and colour combinations, and option links belonging to
another product. Product creation saves details, options, stock and photos in
one transaction.

Existing product editing preserves the department, category, room and option
definitions. Visibility can be changed without removing the product’s records.

### Product Photographs

Products support up to four JPG, PNG or WebP uploads, with a maximum input size
of 5 MB per image. The backend checks image content, applies orientation and
resizes images to fit within 1600 by 1600 pixels. It stores JPEG image data
without the original metadata. Animated images are not supported.

The first saved photograph is the main storefront image. Additional photographs
are available through thumbnails in the expanded details. Category artwork is
used when a product has no uploaded photographs. Public image access is blocked
for hidden and deleted products.

### Product Deletion

Deletion requires an active admin session and explicit confirmation of the
selected product. The confirmation identifies the product and explains that
deletion is permanent. Cancellation leaves its records unchanged.

The backend removes the product, photographs, options, stock variants and related
combination records in one transaction. A failure rolls back the operation.
Other products and the department, category and room lists remain unchanged.

## Week 4 Storefront Update

The Week 4 development work follows the feature list in the Business Analyst’s
Dev expectations week 4 document, covering CUS-01–06 and CUS-10–11.

The home page provides category links. Search checks product names, descriptions
and materials without case sensitivity. Category, room and price filters work
together. Price limits are inclusive and use integer cents for comparison.
Invalid prices or a minimum above the maximum produce an explanatory message.
An empty result shows No matching products with a reset option.

The product cards open a separate product page at /products/:id. It displays
photos, full description, material, CAD price, size and colour choices and stock
for each combination. Selecting both options shows that combination’s stock.
Products with no stock remain listed as Out of stock. Hidden products remain
excluded by the public API, and missing or hidden product URLs show unavailable.

Filter choices are retained in the URL across page refresh and the return from
a product page. A shopper can reach product details from the home page directly
or through a category within two link selections. Selecting an option is a
further action. Desktop and mobile layouts use the same catalogue data.

The storefront navigation no longer displays an admin link. The separate admin
page remains available at /admin and still requires authentication. Cart and
checkout are outside this Week 4 update.

## Technical Architecture

| Component | Technology and purpose |
| --- | --- |
| User interface | Angular, TypeScript, HTML and CSS |
| Application server | Node.js 24 and Express |
| Local storage | SQLite with schema migrations and seed data |
| Hosted storage support | PostgreSQL with migrations and transactional writes |
| Upload processing | Multer and Sharp |
| Automated testing | Node.js test runner |
| Version control | Git and GitHub |
| Hosted demonstration | Render |

The Angular frontend exchanges data with the Express API. The backend performs
validation, checks admin access and manages database operations. Uploaded images
are stored in the selected database rather than as temporary application files.

The SQLite import feature preserves product identifiers, details, options,
stock and image data when transferring records to PostgreSQL. It reads the
source without changing it, rejects replacement of changed hosted data and
rolls back invalid imports. Legacy images stored as separate files are outside
this transfer.

## Admin Access Controls

Admin passwords are checked against an in-memory scrypt hash. Successful login
creates a server-side session with a random cookie. Cookies are HttpOnly,
SameSite Strict and scoped to the admin API. Production cookies also use Secure.

Sessions expire after 30 minutes. Sign-out ends the server session, and another
sign-in replaces the previous session. Server restarts end in-memory sessions.
Admin writes require an active session and the X-Admin-Request header. Admin
responses use no-store caching headers.

Failed login attempts are limited per client IP. Five consecutive failures
trigger a temporary block. Successful login clears previous failures. Clients
sharing an IP share the limit. BUG-03 remains a QA TODO, and hosted proxy
behaviour is not yet verified.

## API Summary

| Endpoint | Purpose |
| --- | --- |
| GET /api/health | Database connection and storage status |
| GET /api/catalogue | Departments, categories and rooms |
| GET /api/products | Visible products, options, photographs and stock |
| GET /api/photos/:id | Public image for a visible product |
| POST /api/admin/login | Admin authentication |
| GET /api/admin/session | Admin session check |
| POST /api/admin/logout | End the admin session |
| GET /api/admin/products | Admin product list, including hidden products |
| POST /api/admin/products | Create a product |
| POST /api/admin/products/:id | Update details and stock |
| GET /api/admin/products/:id/photos | List a product’s photographs for admin management |
| POST /api/admin/products/:id/photos | Save photo additions, removals and order |
| GET /api/admin/photos/:id | Protected admin image preview |
| POST /api/admin/products/:id/delete | Delete a confirmed product and related records |

## Validation Status

| Check | Latest recorded result |
| --- | --- |
| Local automated suite | 48 checks: 47 passed, zero counted failures, one TODO |
| Product deletion | Access, confirmation, dependent records and rollback checks passed |
| PostgreSQL integration | 22 checks passed in the development environment |
| Week 4 frontend production build | Passed in the development environment |
| Tests after final dependency update | 47 passed, zero counted failures, one TODO |
| Week 4 browser validation | 20 scenarios passed in the development environment |
| Dependency audit | 16 moderate findings; no high findings in the latest installation output |
| Independent QA review | Pending for the latest update |
| Live database persistence | Awaiting hosted setup and redeployment verification |

The remaining TODO concerns BUG-03. It is tracked separately from passing tests.
Development checks do not establish that the deployed service retains data after
redeployment. The Angular build package is now version 21.2.30; the latest
installation output no longer reports the earlier high-severity dependency finding.

## Open Items and Limitations

- Hosted PostgreSQL configuration and live data retention verification remain pending.
- BUG-03 and client behaviour behind the hosting proxy remain under QA review.
- Duplicate product name rules await review of the Business Analyst’s proposal.
- Sixteen moderate dependency findings remain open.
- Existing product editing does not change category placement or option definitions.
- Shopping cart, checkout and order tracking are not implemented.
- The Week 4 storefront has been checked locally; hosted test-server deployment and QA sign-off remain pending.
- Payment processing and in-store QR scanning are not implemented.

## Repository Structure

| Location | Contents |
| --- | --- |
| apps/api/src | API routes, access controls and product operations |
| apps/api/src/migrations | SQLite migrations |
| apps/api/src/postgres | PostgreSQL schema and database operations |
| apps/api/test | Developer and QA automated checks |
| apps/web/src | Angular components, templates and styles |
| scripts | Development startup and database import utilities |
| docs | Shared project documentation |
| roles | Business Analyst, Developer and QA deliverables |

## Project Data

Products, prices, materials and stock are demonstration content for the course
project. The current release supports catalogue and inventory operations and
does not process purchases or move money.
