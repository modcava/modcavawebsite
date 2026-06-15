/**
 * Seed 50 load-test users into the test database.
 *
 * รัน: node load-test/seed-load-users.mjs
 *
 * ต้องการ:
 *   - DB_ENV=test (หรือ DATABASE_URL_TEST) ใน .env
 *   - MySQL container กำลังรันอยู่ (docker compose up -d)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const dbEnv = (process.env.DB_ENV ?? 'test').toLowerCase()
const databaseUrl =
  dbEnv === 'test'
    ? (process.env.DATABASE_URL_TEST || process.env.DATABASE_URL)
    : (process.env.DATABASE_URL_PROD || process.env.DATABASE_URL)

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
  log: ['error'],
})

const PASSWORD_PLAIN = 'Load@1234'
const USER_COUNT     = 50

async function main() {
  console.log(`[seed-load-users] DB_ENV=${dbEnv}`)
  console.log(`[seed-load-users] Creating ${USER_COUNT} test users…`)

  const hash = await bcrypt.hash(PASSWORD_PLAIN, 10)

  let created = 0
  let skipped = 0

  for (let i = 1; i <= USER_COUNT; i++) {
    const email = `loadtest${i}@test.local`
    try {
      await prisma.user.upsert({
        where: { email },
        update: {}, // ไม่อัปเดตถ้ามีอยู่แล้ว
        create: {
          email,
          name:          `Load Test ${i}`,
          password:      hash,
          role:          'CUSTOMER',
          emailVerified: new Date(), // verified ทันที — ไม่ต้องผ่าน email flow
          points:        0,
        },
      })
      created++
    } catch (err) {
      console.error(`  ✗ ${email}: ${err.message}`)
      skipped++
    }
  }

  console.log(`[seed-load-users] Done — created/updated: ${created}, skipped: ${skipped}`)
  console.log(`[seed-load-users] Credentials: loadtest{1..${USER_COUNT}}@test.local / ${PASSWORD_PLAIN}`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
