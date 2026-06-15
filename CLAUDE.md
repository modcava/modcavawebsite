# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build (runs type-check — must pass)
npm run lint         # ESLint

npm run db:push      # Sync schema → DB without migration file (dev)
npm run db:migrate   # Create + apply migration (production schema changes)
npm run db:studio    # Open Prisma Studio GUI (port 5555)
npm run db:seed      # Seed sample data
npm run db:reset     # Drop, re-migrate, re-seed (destructive)

# Two-database setup — prod + test on the same MySQL server.
# Switch the running app's DB by setting DB_ENV=prod|test in .env.
npm run db:bootstrap     # One-time: create mocava_db_test on existing MySQL container
npm run db:push:test     # Push schema to test DB
npm run db:seed:test     # Seed test DB
npm run db:studio:test   # Studio against test DB
npm run db:reset:test    # Drop + re-migrate test DB
# (same with :prod suffix for production DB)
```

**No test runner is configured.** There is a manual test document at `TEST_MANUAL.md`.

Infrastructure: MySQL runs in Docker (`docker compose up -d`). Adminer DB UI at port 8080.

---

## Architecture

### Request flow

```
Browser
  ├─ Server Components   → call Prisma directly (no fetch)
  └─ Client Components   → fetch /api/* routes → Prisma
```

- **`src/app/page.tsx`** — Server Component. Fetches all active products (`price > 0`, cap 2000) directly from Prisma, passes as `initialProducts` prop to `ShopClient`.
- **`src/app/shop-client.tsx`** — Client Component (~1100 lines). Receives the full product list and does **all filtering/sorting client-side**. No re-fetching after initial load. This is the central shop UI: category tabs, sidebar filters per category, cart, wishlist, pagination.
- **`src/app/admin/products/page.tsx`** — Client Component. Uses TanStack Query to fetch products **server-side with pagination** (`pageSize=50`). Filters are sent as `f_<key>=<value>` query params; the API handles them via `FILTER_FIELDS`. Sort is client-side on the current page.

### Product data model

The `products` table uses a **flat schema** — one table for all product types (MTG cards, Riftbound cards, sealed, paints, airbrush tools). Fields are nullable and type-specific:

| Field group | Used by |
|---|---|
| `setName`, `setCode`, `collectorNumber`, `rarity`, `colors`, `formats`, `cardType`, `foil` | MTG Singles |
| `chapter`, `domain`, `rbRarity`, `rbType`, `altArt` | Riftbound Singles |
| `sealedCat`, `productType` | MTG Sealed |
| `rbSealedCat` | Riftbound Sealed |
| `brand`, `paintCat`, `colorCode`, `colorFamily`, `size`, `finish` | Paints |
| `airbrushCat`, `nozzle`, `feedType`, `compatibleWith` | Airbrush / Model Tools |

Category slugs: `mtg-single`, `mtg-sealed`, `rb-single`, `rb-sealed`, `paint`, `model-tools`.

MTG Singles category ID is hardcoded in `src/app/api/admin/import-mtg/route.ts` as `MTG_SINGLE_CATEGORY_ID`.

### Admin product filtering

`GET /api/admin/products` accepts `f_<key>=<value>` params mapped via `FILTER_FIELDS` in the route file. Modes: `contains` (LIKE), `eq` (exact), `bool` (foil/true), `status` (active/hidden), and a special case for `altFoil` (maps to `foil` + `altArt` fields). To add a new filterable column: add to both `FILTER_FIELDS` in the route and `FILTER_TYPES` in the admin page. Static dropdown options live in `STATIC_OPTIONS` in `admin/products/page.tsx`.

### Delete behavior

Admin product DELETE does **hard delete first**, falling back to soft delete (`isActive: false`) only when a Prisma FK error `P2003`/`P2014` indicates the product has order history.

### Cart & Wishlist

- **Cart**: Zustand store with `skipHydration: true`. Must call `useCart.persist.rehydrate()` in a `useEffect`. Per-user snapshots are saved to `localStorage` under key `mocava-cart-{userId}` and restored on login.
- **Wishlist**: `string[]` of `product.id` values, stored in `localStorage` under `mocava_wishlist`. Uses `product.id` directly — never array indices.
- Login/logout merges or restores per-user cart + wishlist (logic in `shop-client.tsx` `useEffect` #3).

### Auth

NextAuth JWT strategy. Roles: `CUSTOMER` / `ADMIN`. All `/admin/*` routes are guarded by `AdminLayout` (server-side session check → redirect). All `/api/admin/*` routes call `requireAdmin()` at the top of each handler. Admin role is stored in the JWT token under `token.role`.

### Bilingual UI

Language toggle sets `data-lang="en|th"` on `<html>`. CSS classes `.en-text` / `.th-text` show/hide content accordingly. This is CSS-only — no i18n library.

### Import MTG (Scryfall)

`src/app/admin/products/import-mtg/page.tsx` fetches all pages from Scryfall (follows `has_more` + `next_page` until done). Uses a generation counter (`searchGenRef`) to cancel stale in-flight loops when a new search starts. Import POSTs to `/api/admin/import-mtg` in batches of 50. SKU format: `{SET}{collectorNumber}` for non-foil, `{SET}{collectorNumber}F` for foil.

---

## Key conventions

**Decimal handling**: Prisma returns `price` as a `Decimal` object on the server but it serializes as a plain number through JSON. Always guard with:
```ts
const price = typeof p.price === 'object' ? p.price.toNumber() : Number(p.price)
```

**Set/Iterator spread**: TypeScript config target does not support `downlevelIteration`. Always use `Array.from(someSet)` instead of `[...someSet]`. Same applies to `URLSearchParams.entries()` — use `Array.from(searchParams.entries())`.

**`cn()` utility**: `src/lib/utils.ts` exports `cn(...classes)` (clsx + tailwind-merge). Use this for all conditional Tailwind class composition.

**`ProductWithCategory` type**: Defined in `src/types/index.ts`. The type includes all optional product-type-specific fields. Many fields are `string | null` even if the Prisma schema guarantees them for a given category — always null-guard.

**Zod schemas**: Each API route defines its own Zod schema. The `ProductFormModal` mirrors the API schema locally. When adding a product field, update: Prisma schema → `prisma generate` → API route schema → `ProductFormModal` schema → `COLS`/`getValue`/`Cell` in admin page → `ProductWithCategory` type if needed.
