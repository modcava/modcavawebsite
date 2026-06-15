# Mocava — Tech Stack Summary

> เอกสารสรุป Technology ที่ใช้ในโปรเจค Mocava TCG & Hobby Store

---

## ภาพรวมสถาปัตยกรรม

```
Browser (Client)
    │
    ├── React 18 + Next.js 14 (App Router)
    │       ├── Server Components  ← render บน server, ดึงข้อมูล DB โดยตรง
    │       └── Client Components  ← interactive UI, state management
    │
    ├── NextAuth.js  ← จัดการ session / JWT
    │
    └── Zustand  ← cart state ใน localStorage

Next.js API Routes (/api/*)
    │
    └── Prisma ORM
            │
            └── MySQL 8.0 (Docker container)
```

---

## 1. Frontend Framework

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **Next.js** | 14.2 | Full-stack framework, App Router, SSR/SSG |
| **React** | 18.3 | UI library, Hooks, Suspense |
| **TypeScript** | 5.5 | Type safety ทั้งโปรเจค |

### Next.js App Router Structure
```
src/app/
├── page.tsx              ← หน้าร้านค้า (Server Component)
├── layout.tsx            ← Root layout + Providers
├── checkout/page.tsx     ← หน้าสั่งซื้อ
├── account/              ← ประวัติออเดอร์
├── admin/                ← จัดการสินค้า/ออเดอร์
├── (auth)/login/         ← หน้า Login
└── api/                  ← REST API routes
```

---

## 2. Styling

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **Tailwind CSS** | 3.4 | Utility classes (ใช้บางส่วน) |
| **CSS Variables** | — | Design system หลัก (สี, radius, spacing) |
| **Google Fonts** | — | Inter (body) + Lora (heading/serif) |

### CSS Variables หลัก
```css
--paper        /* พื้นหลังหลัก (cream) */
--paper-2/3    /* พื้นหลังรอง */
--ink          /* ข้อความหลัก */
--ink-2/3      /* ข้อความรอง */
--sienna       /* สีแบรนด์ (น้ำตาล-แดง) */
--sienna-bg    /* พื้นหลัง accent */
--divider      /* เส้นขั้น */
--r / --r-lg   /* border radius */
```

### Bilingual (EN/TH)
- สลับภาษาด้วย attribute `data-lang="en|th"` บน `<html>`
- CSS class `.en-text` / `.th-text` ซ่อน/แสดงตามภาษา

---

## 3. State Management

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **Zustand** | 4.5 | Cart state, persist ลง localStorage |
| **TanStack Query** | 5.51 | Server state caching (admin pages) |
| **React useState** | built-in | UI state (drawer open, filters, etc.) |

### Zustand Cart Store
```ts
// skipHydration: true → ต้อง rehydrate() ใน useEffect เอง
useCart.persist.rehydrate()
```

---

## 4. Forms & Validation

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **React Hook Form** | 7.52 | จัดการ form state + validation |
| **Zod** | 3.23 | Schema validation (type-safe) |
| **@hookform/resolvers** | 3.9 | เชื่อม Zod กับ React Hook Form |

```ts
// ตัวอย่าง checkout form
const schema = z.object({
  recipientName: z.string().min(2),
  phone:         z.string().min(9),
  postalCode:    z.string().length(5),
  ...
})
```

---

## 5. Authentication

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **NextAuth.js** | 4.24 | Session management, JWT |
| **bcryptjs** | 2.4 | Hash passwords ก่อนเก็บ DB |

### การทำงาน
- Strategy: **JWT** (ไม่ใช้ database sessions)
- Provider: **Credentials** (email + password)
- Roles: `CUSTOMER` / `ADMIN`
- Custom pages: `/login`, `/register`
- Middleware: ป้องกัน routes ที่ต้องการ auth

---

## 6. Database & ORM

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **MySQL** | 8.0 | Relational database |
| **Prisma ORM** | 5.16 | Schema, migrations, queries, seeding |
| **Adminer** | latest | Web UI จัดการ database (port 8080) |

### Database Schema (ตาราง)
```
users        ← ข้อมูลผู้ใช้ + role
categories   ← หมวดหมู่สินค้า (6 หมวด)
products     ← สินค้าทั้งหมด + field เฉพาะแต่ละประเภท
orders       ← ออเดอร์ + ข้อมูลจัดส่ง
order_items  ← รายการสินค้าในแต่ละออเดอร์
```

### Prisma Scripts
```bash
npm run db:push      # sync schema → database (dev)
npm run db:migrate   # สร้าง migration file (production)
npm run db:seed      # ใส่ข้อมูลตัวอย่าง
npm run db:studio    # เปิด Prisma Studio (GUI)
npm run db:reset     # รีเซ็ต + seed ใหม่
```

---

## 7. Infrastructure

| รายการ | หน้าที่ |
|--------|---------|
| **Docker Desktop** | รัน containers บน local |
| **Docker Compose** | จัดการ MySQL + Adminer |
| **WSL2** | Linux layer สำหรับ Docker บน Windows |

### Docker Services
```yaml
mysql:    port 3306  ← database หลัก
adminer:  port 8080  ← web UI สำหรับดู/แก้ DB
```

---

## 8. UI Components & Libraries

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **Lucide React** | 0.408 | Icon library (SVG icons) |
| **Sonner** | 1.5 | Toast notifications (บน/ล่างจอ) |
| **clsx** | 2.1 | Conditional className helper |
| **tailwind-merge** | 2.4 | Merge Tailwind classes ไม่ให้ conflict |

---

## 9. API Routes

```
POST /api/auth/[...nextauth]   ← NextAuth handler
GET  /api/products             ← ดึงสินค้า (public)
GET  /api/categories           ← ดึงหมวดหมู่ (public)
POST /api/orders               ← สร้างออเดอร์ (auth required)
GET  /api/orders               ← ดึงออเดอร์ของตัวเอง (auth)
GET  /api/admin/orders         ← ดึงออเดอร์ทั้งหมด (admin)
PUT  /api/admin/orders/[id]    ← อัปเดตสถานะ (admin)
GET  /api/admin/products       ← จัดการสินค้า (admin)
POST /api/admin/products       ← เพิ่มสินค้า (admin)
DELETE /api/admin/products/[id] ← ลบสินค้า (admin)
```

---

## 10. Development Tools

| รายการ | เวอร์ชัน | หน้าที่ |
|--------|---------|---------|
| **ESLint** | 8.57 | Code linting |
| **tsx** | 4.16 | รัน TypeScript โดยตรง (seed script) |
| **Prisma Studio** | — | GUI ดู/แก้ข้อมูลใน DB |

---

## 11. Port ที่ใช้

| Port | Service |
|------|---------|
| **3000** | Next.js dev server (เว็บหลัก) |
| **3306** | MySQL database |
| **8080** | Adminer (DB web UI) |

---

## 12. Environment Variables (.env)

```env
DATABASE_URL          # MySQL connection string
NEXTAUTH_SECRET       # JWT signing secret
NEXTAUTH_URL          # URL ของเว็บ (http://localhost:3000)
MYSQL_ROOT_PASSWORD   # MySQL root password
MYSQL_DATABASE        # ชื่อ database
MYSQL_USER            # MySQL user
MYSQL_PASSWORD        # MySQL password
```

---

## สรุป Dependencies

```
Production (14 packages)
├── next 14          Framework
├── react 18         UI
├── typescript 5     Type safety
├── prisma-client    ORM
├── next-auth 4      Auth
├── bcryptjs         Password hash
├── zustand 4        State (cart)
├── zod 3            Validation
├── react-hook-form  Forms
├── @hookform/res.   Form+Zod bridge
├── @tanstack/query  Server state
├── lucide-react     Icons
├── sonner           Toasts
└── clsx/tw-merge    Class utils

Development (9 packages)
├── prisma           ORM CLI + schema
├── tailwindcss 3    CSS framework
├── tsx              TS runner (seed)
├── eslint           Linter
└── @types/*         TypeScript types
```

---

*อัปเดต: พฤษภาคม 2026*
