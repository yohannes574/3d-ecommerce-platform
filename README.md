# ⚡ Voltix — 3D Electronics Marketplace

A multi-vendor electronics marketplace with **interactive 3D product visualization**. Customers explore smartphones as real 3D models — rotating, zooming and clicking hotspot markers to learn about features before buying. Approved sellers manage rich listings with images, specs, variants, GLB models and interactive hotspots.

> Smartphone-first by design; the category-aware architecture is ready for laptops, tablets, headphones, smartwatches and more.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · Vite 7 · Tailwind CSS 4 · react-router 7 |
| 3D | three.js · @react-three/fiber 9 · @react-three/drei 10 |
| Backend | Node.js · Express 5 |
| Database | MongoDB · Mongoose 8 |
| Auth | JWT (7-day tokens) · bcryptjs |
| Uploads | Multer 2 (images + `.glb`, max 64 MB; license docs ≤ 10 MB, magic-byte validated) |
| Security | helmet · express-rate-limit · role guards · admin audit log |

## Quick start

```bash
# 1. install everything (root + server + client)
npm run install-all

# 2. configure the API (defaults work out of the box)
#    server/.env → MONGODB_URI=mongodb://127.0.0.1:27017/voltix

# 3. seed demo users + catalog
npm run seed

# 4. run API (:5000) + client (:5173) together
npm run dev
```

Open **http://localhost:5173** 🎉

### Demo accounts

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@voltix.com` | `admin123` | approve sellers & products |
| Seller | `seller@voltix.com` | `seller123` | approved, owns the seeded catalog |
| Seller | `pending@voltix.com` | `seller123` | blocked until admin approval |
| Customer | `customer@voltix.com` | `cust123` | shopping account |

## Feature map

**Customers**
- Home hero with a live 3D phone + featured grid
- Catalog with search, category chips, brand & sort filters + **pagination**
- Product page: **3D viewer** (orbit/zoom, auto-rotate), clickable numbered hotspots, photo gallery tab, variant pickers (**color choice re-tints the 3D model**, **priced options change the price live** — e.g. 512GB +$150), specs table
- **Verified-purchase reviews** — star ratings + comments, one review per delivered item, editable aggregates on every product card
- Cart (per-variant line items), COD checkout, order history with **self-service cancellation** (auto-restock) and per-item "review" shortcuts

**Sellers** (`/seller`)
- Analytics overview: revenue, units sold, order count, product pipeline + **Orders tab** scoped to their own products
- Pending sellers see a friendly "awaiting approval" gate instead of the dashboard
- Product form: basics, image URLs/uploads, dynamic specs, **priced variant editor** (per-option price deltas, color swatches), GLB model URL/upload
- **Visual hotspot editor** — click the 3D model surface to drop markers, edit title/description/position inline
- Save private drafts or submit for approval

**Admins** (`/admin`)
- Platform stats strip: revenue, orders, customers, sellers, pending queues
- Seller approval queue (approve/reject) with **business-license verification** — approving without a license on file is blocked server-side
- Product review queue (approve & publish / reject), feature/unfeature products
- **Order pipeline** — confirm → ship → deliver, or cancel with automatic stock restock

**Under the hood**
- Products only go public after `status = approved`; drafts stay private
- Free-form `specs[]` + `variants[]` keep any future electronics category supported with zero migrations
- Procedural fallback smartphone renders when a product has no `.glb` — demos never look broken
- Studio lighting is generated procedurally (drei `Environment` + `Lightformer`) — no network HDRI needed
- Reviews are tied to `orderId:itemIndex`, so only genuine buyers of delivered orders can review — no moderation burden
- Order cancellation (customer or admin) automatically restores product stock

## Project layout

```
├── server/                 Express + Mongoose API
│   ├── src/config/db.js    Mongo connection
│   ├── src/models/         User · Product · Cart · Order · Review
│   ├── src/controllers/    auth · product · seller · admin · cart · order · review · upload
│   ├── src/routes/         /api/auth /api/products /api/seller /api/admin
│   │                       /api/cart /api/orders /api/upload
│   ├── src/middleware/     JWT auth, role guards, error handler
│   ├── src/seed.js         demo data (npm run seed)
│   └── uploads/            uploaded images + .glb models (static-served)
└── client/                 React + R3F storefront
    └── src/
        ├── api/client.js   axios wrapper (token interceptor)
        ├── context/        AuthContext · CartContext
        ├── components/     Navbar · ProductCard · Rating · ReviewSection · HotspotEditor · Toaster …
        ├── pages/          Home · Products · ProductDetail · Cart · Checkout ·
        │                   Orders · Login/Register · seller/* · admin/*
        └── three/          ModelViewer · PhoneModel · HotspotsLayer
```

## API summary

```
POST /api/auth/register|login      GET  /api/auth/me
POST /api/upload/license           seller business license (pdf/image, required at registration)
GET  /api/products                 ?q&category&brand&sort&featured
GET  /api/products/meta            GET  /api/products/:id
GET  /api/seller/products          POST|PUT|DELETE /api/seller/products/:id?
PATCH /api/admin/sellers/:id/status      {status}
GET  /api/admin/products           PATCH /api/admin/products/:id/status|featured
GET|POST /api/cart                PATCH|DELETE /api/cart/:itemId
POST /api/orders                  GET  /api/orders/mine
PATCH /api/orders/:id/cancel      GET  /api/orders           (admin)
PATCH /api/orders/:id/status      (admin) GET /api/orders/seller
GET  /api/reviews/product/:id     POST /api/reviews           (verified purchase)
GET  /api/reviews/mine            PUT|DELETE /api/reviews/:id
GET  /api/admin/stats             GET  /api/seller/stats
POST /api/upload                  multipart "file" (image or .glb)
```

## Notes & roadmap

- Chapa uses hosted checkout with server-side transaction verification. Set `CHAPA_SECRET_KEY` and `CHAPA_PUBLIC_KEY` in `server/.env`; receipt screenshots remain only for Telebirr and bank transfer.
- Set `API_ORIGIN` to the publicly reachable API URL in production so Chapa can redirect to `/api/payments/chapa/callback`; configure the same callback URL as a webhook URL in the Chapa dashboard.
- Editing an already-approved product keeps its status (re-review flow can be added easily).
- Roadmap ideas: wishlist, AR quick-look, more categories, refresh tokens, review helpfulness votes.

## Tests

Automated API suite (no extra deps, uses `node:test`) — API must be running:

```bash
npm test        # from /server — 16 tests: auth, variant pricing, per-option stock,
                # oversell guard, order pipeline, reviews, admin guards, rate limiting
```

Manual browser smoke check: `node client/tests/browser-check.mjs` (client on :5173).

## Production-hardening notes

- **Race-safe stock**: order placement decrements stock with atomic conditional MongoDB updates (`$gte` check inside the update) — concurrent orders can never oversell; per-option counters roll back on failure.
- **Per-option inventory**: any variant option may carry its own `stock`; availability = min(product stock, option stocks).
- **License lifecycle**: pending/rejected sellers can log in, view their license status, and re-apply from the Seller Hub gate.
- **Notifications**: in-app feed + pluggable stub mailer (`server/src/utils/notify.js`) fire on seller/product/order/license events; swap in Nodemailer in one file.
- **Audit trail**: admin actions (seller/product/order status changes) are recorded in an append-only log, viewable at `GET /api/admin/audit`.
- **Code splitting**: three.js is lazy-loaded only when a 3D viewer renders — the main bundle is ~100 KB gzipped.
