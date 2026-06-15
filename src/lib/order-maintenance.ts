import { prisma } from '@/lib/prisma'
import { sendOrderCancelledEmail } from '@/lib/email'

// Orders that are still PENDING with no payment slip after this long are
// abandoned and get auto-cancelled (stock/points/coupon restored).
const UNPAID_TTL_MS = 48 * 60 * 60 * 1000 // 48 hours

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

        // Restore stock for each line item
        for (const it of order.items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          })
        }

        // Refund loyalty points the customer spent
        if (order.pointsUsed > 0) {
          await tx.user.update({
            where: { id: order.userId },
            data: { points: { increment: order.pointsUsed } },
          })
        }

        // Release one coupon use (guarded so it never goes negative)
        if (order.couponId) {
          await tx.coupon.updateMany({
            where: { id: order.couponId, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          })
        }

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
