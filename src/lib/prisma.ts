import { PrismaClient } from '@prisma/client'

// ──────────────────────────────────────────────────────────────
// DB selector — choose between production and test databases.
//
// Set DB_ENV in .env to "prod" (default) or "test". The app reads
// DATABASE_URL_PROD or DATABASE_URL_TEST accordingly. Falls back to
// DATABASE_URL if those aren't set (backward-compatible).
//
// Prisma CLI (db push, migrate, etc.) reads DATABASE_URL directly —
// use `npm run db:push:test` etc. which proxy through scripts/prisma-env.mjs.
// ──────────────────────────────────────────────────────────────

const dbEnv = (process.env.DB_ENV ?? 'prod').toLowerCase()

const databaseUrl =
  dbEnv === 'test'
    ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL)
    : (process.env.DATABASE_URL_PROD || process.env.DATABASE_URL)

// Use a global flag so the "which DB" log fires only once even under
// Next.js dev HMR (which re-imports this module on every change).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaLogged?: boolean
}

if (!globalForPrisma.prismaLogged) {
  const masked = (databaseUrl ?? '').replace(/:[^@/]+@/, ':***@')
  // eslint-disable-next-line no-console
  console.log(`[prisma] DB_ENV=${dbEnv} → ${masked || '(default DATABASE_URL)'}`)
  globalForPrisma.prismaLogged = true
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Only override if we explicitly resolved a URL — otherwise let
    // PrismaClient pick up DATABASE_URL on its own (matches old behavior).
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
