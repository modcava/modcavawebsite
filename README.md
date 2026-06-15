# MOCAVA — Fullstack TCG & Hobby Store

Next.js 14 fullstack webstore for MTG, Riftbound, and miniature painting supplies.

## Tech Stack

| Layer       | Technology                         |
|-------------|-----------------------------------|
| Framework   | Next.js 14 (App Router, TypeScript)|
| Styling     | Tailwind CSS + custom warm theme  |
| Database    | MySQL 8.0 (Docker)                |
| ORM         | Prisma                            |
| Auth        | NextAuth.js (JWT + credentials)   |
| State       | Zustand (cart, persisted)         |
| Forms       | React Hook Form + Zod             |
| Query       | TanStack React Query              |
| Toasts      | Sonner                            |
| Dev DB GUI  | Adminer (http://localhost:8080)   |

---

## Quick Start

### 1. Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for MySQL)
- [Node.js 18+](https://nodejs.org/)

### 2. Clone & install

```bash
cd mocava
npm install
```

### 3. Environment setup

```bash
cp .env.example .env
# Edit .env if you want to change passwords
```

### 4. Start MySQL with Docker

```bash
docker compose up -d
# Wait ~15 seconds for MySQL to initialize
```

### 5. Push database schema & seed

```bash
npm run db:push      # Create tables from Prisma schema
npm run db:seed      # Populate with sample products & users
```

### 6. Start the dev server

```bash
npm run dev
# Open http://localhost:3000
```

---

## Default Accounts

| Role     | Email                    | Password      |
|----------|--------------------------|---------------|
| Admin    | admin@mocava.com         | admin1234     |
| Customer | customer@example.com     | password123   |

---

## Key URLs

| URL                          | Description              |
|------------------------------|--------------------------|
| http://localhost:3000        | Shop (public)            |
| http://localhost:3000/login  | Sign in                  |
| http://localhost:3000/admin  | Admin dashboard          |
| http://localhost:8080        | Adminer (DB GUI)         |

---

## Project Structure

```
mocava/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Shop home
│   │   ├── shop-client.tsx           # Interactive shop (client)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── cart/                     # Cart page (via drawer)
│   │   ├── checkout/page.tsx         # Checkout + order creation
│   │   ├── account/
│   │   │   ├── page.tsx              # Account overview
│   │   │   └── orders/page.tsx       # Order history
│   │   ├── admin/
│   │   │   ├── page.tsx              # Dashboard + stats
│   │   │   ├── products/page.tsx     # Product CRUD
│   │   │   └── orders/page.tsx       # Order management
│   │   └── api/
│   │       ├── auth/[...nextauth]/   # NextAuth handler
│   │       ├── auth/register/        # Customer registration
│   │       ├── products/             # Public product API
│   │       ├── categories/           # Public categories API
│   │       ├── orders/               # Authenticated orders API
│   │       └── admin/                # Admin-only APIs
│   ├── components/
│   │   ├── layout/  Header, Footer
│   │   ├── shop/    ProductCard, CartDrawer
│   │   └── admin/   ProductFormModal
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma singleton
│   │   ├── auth.ts                   # NextAuth config
│   │   └── utils.ts                  # Helpers, formatters
│   ├── store/
│   │   └── cart.ts                   # Zustand cart (persisted)
│   ├── types/
│   │   ├── index.ts                  # App types
│   │   └── next-auth.d.ts            # Session type augmentation
│   └── middleware.ts                 # Route protection
├── prisma/
│   ├── schema.prisma                 # MySQL schema
│   └── seed.ts                       # Sample data
├── docker-compose.yml                # MySQL + Adminer
├── .env.example                      # Environment template
└── tailwind.config.ts                # Warm amber theme
```

---

## API Reference

### Public
- `GET /api/products` — list products (search, filter, sort, paginate)
- `GET /api/products/:id` — single product
- `GET /api/categories` — all categories

### Authenticated (customer)
- `POST /api/orders` — place order
- `GET  /api/orders` — my orders

### Admin only
- `GET/POST/PUT/DELETE /api/admin/products`
- `GET/PATCH /api/admin/orders`
- `GET /api/admin/stats`

---

## Useful Commands

```bash
npm run db:studio    # Open Prisma Studio (visual DB editor)
npm run db:reset     # Reset + re-seed database
docker compose down  # Stop MySQL
docker compose up -d # Start MySQL
```

---

## Adding Your Logo

Place `logo.png` (the Mocava cat mascot) inside `public/logo.png`. It will appear in the header and hero section automatically using CSS `mix-blend-mode: screen`.

---

## Production Deployment

1. Set `NEXTAUTH_SECRET` to a strong random value (`openssl rand -base64 32`)
2. Set `NEXTAUTH_URL` to your production domain
3. Set `DATABASE_URL` to your production MySQL connection string
4. Run `npm run build && npm run start`
