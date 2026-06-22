import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// แต้มหมดอายุ 12 เดือนหลังได้รับ · แจ้งเตือนเมื่อเหลือ ≤ 60 วัน
export const POINT_EXPIRY_MONTHS = 12
export const EXPIRY_WARNING_DAYS = 60

type Tx = Prisma.TransactionClient

function addMonths(d: Date, m: number): Date {
  const r = new Date(d)
  r.setMonth(r.getMonth() + m)
  return r
}

/**
 * ได้แต้ม — เพิ่ม balance + สร้าง lot ใหม่ (หมดอายุ +12 เดือน)
 * เรียกภายใน transaction เดียวกับการเปลี่ยนสถานะออเดอร์ เพื่อให้ atomic
 */
export async function earnPoints(
  tx: Tx, userId: string, amount: number,
  opts?: { reason?: string; orderId?: string | null },
): Promise<void> {
  if (amount <= 0) return
  await tx.user.update({ where: { id: userId }, data: { points: { increment: amount } } })
  await tx.pointLot.create({
    data: {
      userId, amount, remaining: amount,
      expiresAt: addMonths(new Date(), POINT_EXPIRY_MONTHS),
      reason:  opts?.reason ?? 'order',
      orderId: opts?.orderId ?? null,
    },
  })
}

/**
 * ใช้แต้ม — ตัด balance (race-free ผ่าน WHERE guard) แล้วตัด lot ที่ใกล้หมดอายุก่อน (FIFO)
 * คืน false ถ้ายอดไม่พอ (ผู้เรียกควร throw/ยกเลิก)
 */
export async function spendPoints(tx: Tx, userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true
  const dec = await tx.user.updateMany({
    where: { id: userId, points: { gte: amount } },
    data: { points: { decrement: amount } },
  })
  if (dec.count === 0) return false

  let left = amount
  const lots = await tx.pointLot.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },   // ตัดก้อนที่จะหมดอายุก่อน
  })
  for (const lot of lots) {
    if (left <= 0) break
    const take = Math.min(lot.remaining, left)
    await tx.pointLot.update({ where: { id: lot.id }, data: { remaining: lot.remaining - take } })
    left -= take
  }
  return true
}

/** คืนแต้ม (เช่น ยกเลิกออเดอร์) — ออกเป็น lot ใหม่อายุ 12 เดือน */
export async function refundPoints(
  tx: Tx, userId: string, amount: number, orderId?: string | null,
): Promise<void> {
  return earnPoints(tx, userId, amount, { reason: 'refund', orderId: orderId ?? null })
}

/**
 * ดึงแต้มที่ "เคยให้ไปแล้ว" ของออเดอร์คืน (กรณียกเลิกออเดอร์ที่เคยถึง SHIPPED)
 * — ตัดเฉพาะส่วนที่ยังไม่ถูกใช้ (lot.remaining) ของ lot ที่ผูกกับออเดอร์นี้
 *   (reason='order'). แต้มที่ลูกค้าใช้ไปแล้วเอาคืนไม่ได้ · กัน balance ติดลบ
 * — ถ้าออเดอร์ยังไม่เคยให้แต้ม (เช่น PENDING) จะเป็น no-op
 * lot ถูก zero ทิ้งไว้ → กันการให้แต้มซ้ำหากกลับเป็น SHIPPED อีกครั้ง
 */
export async function clawbackEarnedPoints(
  tx: Tx, userId: string, orderId: string,
): Promise<void> {
  const lots = await tx.pointLot.findMany({
    where: { userId, orderId, reason: 'order', remaining: { gt: 0 } },
    select: { remaining: true },
  })
  const clawable = lots.reduce((s, l) => s + l.remaining, 0)
  if (clawable <= 0) return

  const u = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
  const dec = Math.min(u?.points ?? 0, clawable)   // กัน balance ติดลบ
  if (dec > 0) {
    await tx.user.update({ where: { id: userId }, data: { points: { decrement: dec } } })
  }
  await tx.pointLot.updateMany({
    where: { userId, orderId, reason: 'order', remaining: { gt: 0 } },
    data: { remaining: 0 },
  })
}

/** แอดมินตั้งแต้มเอง — ล้าง lot เดิมแล้วสร้างก้อนเดียวเท่ายอดใหม่ (อายุ 12 เดือน) */
export async function setPointsManually(userId: string, points: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { points } })
    await tx.pointLot.deleteMany({ where: { userId } })
    if (points > 0) {
      await tx.pointLot.create({
        data: {
          userId, amount: points, remaining: points,
          expiresAt: addMonths(new Date(), POINT_EXPIRY_MONTHS),
          reason: 'manual',
        },
      })
    }
  })
}

/**
 * หมดอายุแต้ม — ตัดยอดของทุก lot ที่หมดอายุ แล้ว zero ก้อนนั้น
 * (เรียกจาก cron) คืนจำนวนแต้มที่หมดอายุทั้งหมด
 */
export async function expirePoints(): Promise<number> {
  const now = new Date()
  const expired = await prisma.pointLot.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { userId: true, remaining: true },
  })
  if (expired.length === 0) return 0

  const byUser = new Map<string, number>()
  for (const l of expired) byUser.set(l.userId, (byUser.get(l.userId) ?? 0) + l.remaining)

  let total = 0
  for (const [userId, amt] of Array.from(byUser.entries())) {
    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
      const dec = Math.min(u?.points ?? 0, amt)   // กัน balance ติดลบ
      if (dec > 0) {
        await tx.user.update({ where: { id: userId }, data: { points: { decrement: dec } } })
      }
      await tx.pointLot.updateMany({
        where: { userId, remaining: { gt: 0 }, expiresAt: { lte: now } },
        data: { remaining: 0 },
      })
    })
    total += amt
  }
  return total
}

/** แต้มที่กำลังจะหมดอายุภายใน N วัน + วันหมดอายุที่ใกล้ที่สุด (สำหรับแจ้งเตือน) */
export async function getExpiringSoon(
  userId: string, days: number = EXPIRY_WARNING_DAYS,
): Promise<{ amount: number; date: Date } | null> {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const lots = await prisma.pointLot.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now, lte: until } },
    orderBy: { expiresAt: 'asc' },
    select: { remaining: true, expiresAt: true },
  })
  if (lots.length === 0) return null
  return {
    amount: lots.reduce((s, l) => s + l.remaining, 0),
    date:   lots[0].expiresAt,
  }
}
