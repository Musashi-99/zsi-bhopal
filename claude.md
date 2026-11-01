# AranyaValue

Forest Produce Quality-to-Price Intelligence and Digital Traceability platform. One web app, one SQLite database, three portals that read and write the same batch records.

The live application is `honeychain-src/`. `site/` is an older static HTML prototype and is not what the app serves. `design/` holds mockup images only.

## Run

From `honeychain-src/backend` (Node 22.5+, port 4000):

```
npm start
```

From `honeychain-src/frontend` (Vite, port 5173, proxies `/api` to 4000):

```
npm run dev
```

Open `http://localhost:5173/`. That page is the portal hub.

Backend env (see `backend/.env.example`): `PORT`, `FRONTEND_ORIGIN`, `JWT_SECRET`. Optional `DEMO_BUYER=off` or `NODE_ENV=production` disables one-click Demo Buyer. `npm run seed` in `backend` wipes the database and reseeds, then runs `db/seedMarket.js`. `node db/seedMarket.js` adds marketplace demo rows without wiping. `--force` fills missing demo rows and does not overwrite existing ones.

Tests: `node --test test/*.test.js` in `backend`. Marketplace coverage is `test/store.test.js`.

## The three portals

Everyone enters at `/`. The same cookie session is shared. The role decides which home you land in.

### Producer / Collection Centre (`collector`, `centre`)

Home `/dashboard`. Collectors record harvests and batches, quality readings, handling, photos, and a quality passport with a QR code. Collection-centre operators check stock at their centre and answer buyer enquiries. Sidebar includes Marketplace Desk at `/marketplace`.

A collector only edits their own batches. A centre user only sees batches and enquiries for `users.centre_id`. Listing a batch on the marketplace is done from Marketplace Desk: indicative price, minimum order, packaging, description. Listing a batch also sets `public_share` so the QR page can show it.

### Government Officer (`inspector`, `admin`)

Home `/officer/overview`. Officers review batches, record inspections, suspend or reinstate a batch, and set a centre’s AranyaValue accreditation. They do not use the seller desk. Admin can also manage officers and settings.

Officer decisions write the shared `batches.status` and a `verifications` row. The marketplace and the public verify page read that status on the next request. There is no marketplace-only copy of a batch.

Approve, request correction, and reject apply while a batch is pending. Suspend can be applied to any non-draft batch and needs a reason of at least 10 characters. Reinstate puts a suspended batch back to `pending_verification`. Both actions are audited and notify the collector, the centre, and buyers with an open enquiry.

### Marketplace (public, plus `buyer`)

Home `/market`. Browsing, search, the catalogue, collection centres, and QR verification do not require an account. Sending an enquiry, saving an item, or opening the buyer dashboard requires a buyer.

Demo Buyer is a labelled shortcut to the predefined account `U-BUY1`. One click, or any non-empty email and password on the demo form, signs in as that account. It never creates a user and never treats the typed password as a real credential. It is off when `NODE_ENV=production` or `DEMO_BUYER=off`. A normal buyer login with an unknown email returns 401 and does not create an account. Outside production, the older open-login behaviour can still auto-create a collector account; it does not auto-create buyers.

## Marketplace pages

| Path | What it does |
|---|---|
| `/` | Three portal cards. Continue goes to the signed-in user’s home. |
| `/market` | Hero, category grid, featured batches, West Bengal districts, centres. |
| `/market/products` | Search, filters, sort, pagination over live listings. |
| `/market/categories` | The ten NTFP categories with listing counts. |
| `/market/p/:code` | Product detail: gallery, indicative price, quality table, batch, centre, permissions. |
| `/market/verify` and `/market/verify/:code` | Public batch verification. Camera scan uses BarcodeDetector when the browser has it. |
| `/market/centres` and `/market/centres/:id` | Centre directory and profile. |
| `/market/catalogue` and `/market/catalogue/:id` | NTFP catalogue in English, Bengali, and Hindi. |
| `/market/how-it-works`, `/market/about` | How a batch moves, and what the project claims. |
| `/market/login` | Real buyer sign-in, registration link, and Demo Buyer. |
| `/market/basket` | Enquiry basket kept in `localStorage`. It does not reserve stock. |
| `/market/account/*` | Overview, enquiries, orders, saved, recently viewed, verification history, profile. |
| `/marketplace` | Seller desk inside the producer shell. |
| `/verify` and `/verify/:code` | Redirect to the marketplace verify page so older QR links still resolve. |

Search matches product name, local name, scientific name, category, batch code, centre, and district. Filters: category, district, centre, price range, available quantity, accreditation, verification status, lab-tested, officer-verified. Sorts: recently added, price low/high, quantity, recently verified.

District sections list only products that have a public batch in that district.

## What a buyer can trust on a page

Status labels come from `batches.status`:

| Stored status | Shown as |
|---|---|
| `submitted` | Submitted |
| `pending_verification` | Pending Officer Review |
| `needs_info` | Under Review |
| `verified`, `verified_with_limitations` | Verified by Officer (limitations stay visible as a note) |
| `rejected`, `failed_checks` | Rejected |
| `suspended` | Suspended |
| `dispatched` | Dispatched |

Centre Checked, Lab Tested, and Verified by Officer are separate. A centre check exists only when a measurement has `evidence_source = measured` and the recorder’s role is `centre`. Lab Tested exists only when an inspection row has `evidence_source = laboratory`. Nothing is promoted to a stronger evidence type than the stored source.

Quality rows are labelled producer-reported, collection-centre checked, instrument-measured, laboratory-tested, or government-officer verified, with method, date, verifier, and reference when those were stored.

Rejected, suspended, and dispatched batches stay out of browse. They still open by batch ID. Suspended and rejected batches show a warning and cannot take a new enquiry.

A QR code only opens this record. The page says so. Unknown IDs 404. Malformed IDs 400. A batch with `public_share = 0` confirms that the ID exists and hides the details. Collector contact details, private documents, and other buyers’ enquiries are not on the public page.

## Centres and accreditation

AranyaValue accreditation (`centres.accreditation_status`: `none`, `active`, `suspended`, `expired`) is a private programme. The UI says it is not a government licence. A verified-centre mark shows only while accreditation is `active` and the centre itself is `active`. A suspended centre loses that mark immediately.

Government registration is a separate field (`govt_registration`) and is empty unless someone recorded it. Product permission notes and buyer quality requirements are shown as their own blocks on the centre page. Operator names on the public page are shortened.

## Buying

An enquiry is a question, a bulk enquiry, or a purchase request. The buyer sets quantity, intended use, and delivery location. The centre or the collector accepts, rejects (with a reason), or counters a price. Accepting creates an order and reserves that quantity. The buyer can accept a counter, which also creates the order. Payment status stays `not_recorded`. This prototype does not take payment and does not pretend a payment succeeded.

Order flow: `confirmed` → `packed` → `dispatched` → `delivered`. The buyer can cancel only while the order is `confirmed`. Available quantity is batch quantity minus quantities on orders that are not cancelled.

Commission, subscriptions, and institutional purchasing are not priced in code. Do not hardcode a commission rate.

## Catalogue

Products live in `products`, linked to states through `product_states` and to a marketplace category through `market_category_id`. Names can be stored in English, Bengali, and Hindi (`local_names`). Scientific name is `species_name` and is left null when it is not reliable (beeswax, bamboo). `permissions_note` is a caution to confirm rules with the forest authority. It is not a legal opinion. `season` is a typical season, not a claim that a batch was collected then.

Admins edit catalogue fields with `POST /api/admin/products` and `PATCH /api/admin/products/:id`.

Categories: Mahua Flowers, Sal Leaves, Kendu Leaves, Forest Honey, Lac and Natural Resins, Sabai Grass, Medicinal and Aromatic Plants, Forest Seeds and Nuts, Natural Fibres, Other NTFPs.

West Bengal is the seeded focus. Jharkhand and Odisha exist as states so more geography can be added without a schema change. The homepage district band defaults to West Bengal. Product, centre, and catalogue APIs are not locked to one state.

## Data

SQLite file `honeychain-src/backend/db/aranyavalue.db`, opened by `node:sqlite` in `backend/db/db.js`. Schema is `backend/db/schema.sql`. New columns are added with `addColumn` in `db.js` so an existing file migrates on boot.

Marketplace tables (they do not duplicate batches):

- `market_categories` — the ten storefront categories.
- `market_listings` — price, unit, minimum order, packaging, description, images, listed flag. Primary key is `batch_id`.
- `buyer_saved` — saved products (by batch code) and centres.
- `buyer_viewed` — recently viewed listings and verification lookups.
- `enquiry_messages` — the thread on an enquiry.

Columns added to existing tables: product catalogue fields (`market_category_id`, `season`, `permissions_note`, `image`, `is_demo`); centre accreditation, equipment, facilities, and public contact; enquiry quantity, intended use, delivery, prices, and resulting `order_id`; `orders.enquiry_id`.

`is_demo = 1` means the row is sample data. The UI prints DEMO DATA. Indicative prices on those rows are labelled illustrative. They are not market rates and not a final sale price.

A backup from before the marketplace seed is `.backup/aranyavalue.pre-market.db`.

## API

Marketplace routes are `backend/routes/store.js`, mounted at `/api/store`.

Public: `GET /meta`, `/home`, `/listings`, `/listings/:code`, `/verify/:code`, `/catalogue`, `/catalogue/:id`, `/centres`, `/centres/:id`.

Demo: `POST /demo-login`.

Buyer (`requireRole('buyer')`): `/my/overview`, `/my/saved`, `/my/viewed`, `/my/enquiries`, `/my/orders`, `POST /enquiries`, message, cancel, accept-counter, cancel order.

Seller (`collector`, `centre`, `admin`): `/seller/enquiries`, `/seller/orders`, `/seller/listings`, respond, advance an order, `PUT /seller/listings/:code`.

Officer: `POST /api/officer/batches/:id/suspend` and `/reinstate`. `PATCH /api/officer/centres/:id` accepts `accreditation_status` and `accreditation_note`.

Auth stays `/api/auth/login`, `/register`, `/logout`, `/me`. Buyer portal login never creates a user.

The read model is `backend/services/marketplace.js`. It joins listings to `batches`, `products`, `centres`, `measurements`, `inspection_records`, and `verifications`.

## Demo sign-in

All of these are demo accounts. Passwords are the seeded ones.

| Who | Email | Password |
|---|---|---|
| Demo Buyer (also the one-click account) | buyer.haat@aranya.demo | buyer12345 |
| Other buyers | buyer.desk@aranya.demo, buyer.herbal@aranya.demo | buyer12345 |
| Collector, Purulia | mina@aranya.demo | collector123 |
| Collector, Jhargram | sukurmoni@aranya.demo | collector123 |
| Collector, Bankura | basanti@aranya.demo | collector123 |
| Centre, Purulia | centre.purulia@aranya.demo | centre12345 |
| Centre, Jhargram | centre.jhargram@aranya.demo | centre12345 |
| Centre, Bankura | centre.bankura@aranya.demo | centre12345 |
| Centre, Paschim Medinipur | centre.medinipur@aranya.demo | centre12345 |
| Officer | inspector@aranya.demo | inspector123 |
| Admin | admin@aranya.demo | admin12345 |

Sample batches worth opening in a demo: `AV-WB-HON-0015` (forest honey, Jhargram, officer verified, lab moisture on file), `AV-WB-MAH-0011` (mahua, Purulia, lab summary attached), `AV-WB-TAM-0026` (tamarind, suspended), `AV-WB-SAL-0029` (rejected, hidden from browse). Birbhum centre `CE-BIR` has a suspended accreditation. Jalpaiguri centre `CE-JAL` is not accredited.

## Producer portal, beyond the marketplace

The producer shell still has Dashboard, My Batches, Create Batch, Quality Passport, Quality to Price, Buyers, Post-Harvest Assistant, Rejection and Recovery, Audit Ledger, Government Schemes, and Profile. Passport QR links point at `/market/verify/{batch_code}`.

The officer shell still has Overview, Batch Verification, Quality Inspection, Collection Centres, Collectors, Buyer and Market, Schemes, Reports, Audit, Officer Management, and Settings.

Batch status changes go through `backend/services/batchStateMachine.js`. The append-only event log is `backend/services/ledger.js`. It is a local hash chain, not a public blockchain, and it does not prove where a product was collected.

## Frontend

React 19, Vite, React Router 7, TanStack Query, Framer Motion. Marketplace UI is scoped under `.mk` in `frontend/app/styles/market.css` so it does not restyle the producer or officer shells. The hub uses `.hub`. Brand colours: forest green `#173F2B`, cream `#F7F3E9`, sage `#A7B88A`, gold `#C69A45`, charcoal `#343A35`. Headings use Poppins, body uses Inter.

Do not reuse the global class names `main`, `hero`, or `card` inside marketplace markup. `.main` is the producer content column and will squash a gallery.

Product photos are in `frontend/public/img/` and `frontend/public/img/market/`. A missing file falls back to a category tile.

## Limits

No payment gateway. No live market prices. Seeded prices, lab PDFs, accreditation, and district–product links are demonstration records. Laboratory PDFs in `backend/uploads` are generated by the seed and say they are not certificates. Kendu, bamboo, and other NTFPs may be regulated; the catalogue tells the user to confirm with the forest department and does not state a legal position. Hindi and Bengali on the producer login are marked coming soon; the marketplace catalogue already shows those names on products. Camera QR scan depends on the browser. There is no separate mobile app.
