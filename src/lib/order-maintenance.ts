import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendOrderCancelledEmail } from '@/lib/email'
import { refundPoints, clawbackEarnedPoints } from '@/lib/points'

// Orders that are still PENDING with no payment slip after this long are
// abandoned and get auto-cancelled (stock/points/coupon restored).
const UNPAID_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

type Tx = Prisma.TransactionClient

interface RestorableOrder {
  id: string
  userId: string
  pointsUsed: number
  couponId: string | null
  items: { productId: string; quantity: number }[]
}

/**
 * คืนทรัพยากรที่ออเดอร์ "กินไป" ตอนสร้าง — สต็อก, แต้มที่ลูกค้าใช้, สิทธิ์คูปอง —
 * และดึงแต้มที่เคยให้ (ถ้าออเดอร์เคยถึง SHIPPED) กลับ. ใช้ร่วมกันทั้ง auto-cancel
 * (cron) และการที่แอดมินกดยกเลิกเอง เพื่อให้ logic คืนค่าอยู่ที่เดียว.
 *
 * ต้องรันภายใน transaction และผู้เรียกต้องกันไม่ให้เรียกซ้ำบนออเดอร์เดิม
 * (เช่น เช็คว่าสถานะเดิม !== CANCELLED ก่อน) มิฉะนั้นสต็อกจะถูกบวกซ้ำ.
 */
export async function restoreOrderResources(tx: Tx, order: RestorableOrder): Promise<void> {
  // (1) คืนสต็อกทุกบรรทัด
  for (const it of order.items) {
    await tx.product.update({
      where: { id: it.productId },
      data: { stock: { increment: it.quantity } },
    })
  }

  // (2) คืนแต้มที่ลูกค้าใช้ (ออก point lot ใหม่อายุ 12 เดือน)
  if (order.pointsUsed > 0) {
    await refundPoints(tx, order.userId, order.pointsUsed, order.id)
  }

  // (3) คืนสิทธิ์คูปอง 1 ครั้ง (guarded so it never goes negative)
  if (order.couponId) {
    await tx.coupon.updateMany({
      where: { id: order.couponId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    })
  }

  // (4) ดึงแต้มที่เคยให้ของออเดอร์นี้คืน (no-op ถ้ายังไม่เคยให้ เช่น PENDING)
  await clawbackEarnedPoints(tx, order.userId, order.id)
}

/**
 * Cancel every PENDING order that has no payment slip and is older than 48h.
 * Restores the inventory, loyalty points, and coupon usage the order consumed,
 * then best-effort emails the customer. Returns how many orders were cancelled.
 *
 * Each order is handled in its own transaction with a re-check, so a slip that
 * lands in the same instant is never clobbered.
 */
export async function sweepExpiredUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - UNPAID_TTL_MS)

  const expired = await prisma.order.findMany({
    where: { status: 'PENDING', slipUrl: null, createdAt: { lt: cutoff } },
    select: {
      id: true, orderNumber: true, userId: true, pointsUsed: true, couponId: true,
      items: { select: { productId: true, quantity: true } },
      user: { select: { name: true, email: true } },
    },
  })

  let cancelled = 0
  for (const order of expired) {
    try {
      const didCancel = await prisma.$transaction(async (tx) => {
        // Re-check inside the tx — a slip upload may have raced us.
        const fresh = await tx.order.findUnique({
          where: { id: order.id },
          select: { status: true, slipUrl: true },
        })
        if (!fresh || fresh.status !== 'PENDING' || fresh.slipUrl) return false

        // Restore stock, spent points, and coupon usage (shared with admin cancel)
        await restoreOrderResources(tx, order)

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' },
        })
        return true
      })

      if (didCancel) {
        cancelled++
        if (order.user?.email) {
          sendOrderCancelledEmail({
            to: order.user.email,
            name: order.user.name ?? '',
            orderNumber: order.orderNumber,
          }).catch((e) => console.error('[auto-cancel] email failed', order.orderNumber, e))
        }
      }
    } catch (e) {
      console.error('[auto-cancel] failed for', order.orderNumber, e)
    }
  }

  if (cancelled > 0) console.log(`[auto-cancel] cancelled ${cancelled} unpaid order(s)`)
  return cancelled
}

// ── Throttled wrapper ───────────────────────────────────────
// Lets request handlers (e.g. the admin orders list) trigger a sweep cheaply
// without running it on every single request. Safe to call often.
let lastSweep = 0
const SWEEP_THROTTLE_MS = 10 * 60 * 1000 // at most once / 10 min per process

export async function maybeSweepExpiredUnpaidOrders(): Promise<void> {
  const now = Date.now()
  if (now - lastSweep < SWEEP_THROTTLE_MS) return
  lastSweep = now
  try {
    await sweepExpiredUnpaidOrders()
  } catch (e) {
    console.error('[auto-cancel] sweep error', e)
  }
}
