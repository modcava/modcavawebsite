import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { generateOrderNumber } from '@/lib/utils'
import { spendPoints } from '@/lib/points'
import { parseCategoryIds, eligibleSubtotal } from '@/lib/coupon'

const SHIPPING_FEES: Record<string, number> = { 'Store Pickup': 0, EMS: 50, Flash: 45, SPX: 40 }
const DEFAULT_SHIPPING_FEE = 60
// Free shipping once the post-discount product total (after coupon + points) reaches this amount.
const FREE_SHIPPING_THRESHOLD = 1000

// Validation errors thrown inside the transaction → caught and returned as 400
class OrderError extends Error {
  constructor(public publicMessage: string) {
    super(publicMessage)
  }
}

// Note: client `price` field is intentionally NOT in the schema — server always
// uses DB price (priceMap). If checkout still sends it, Zod strips it silently.
const checkoutSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity:  z.number().int().positive(),
  })).min(1),
  recipientName:  z.string().min(2),
  phone:          z.string().min(9),
  address:        z.string().min(5),
  district:       z.string().min(1),
  province:       z.string().min(1),
  postalCode:     z.string().length(5),
  shippingMethod: z.string().default('Kerry'),
  paymentMethod:  z.string().default('PromptPay'),
  note:           z.string().optional(),
  couponCode:     z.string().optional(),
  pointsToUse:    z.number().int().min(0).default(0),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 10 orders per minute per user.
  // Prevents accidental double-submits and abusive bots.
  const rl = enforceRateLimit(req, {
    key: 'orders:create',
    by: session.user.id,
    limit: 10,
    windowMs: 60 * 1000,
    message: 'สั่งซื้อบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  })
  if (rl) return rl

  const body = await req.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { items, couponCode, pointsToUse, ...shipping } = parsed.data
  const userId = session.user.id

  // ──────────────────────────────────────────────────────────────
  // PRE-CHECK (fast-fail with friendly 400 before opening a tx)
  // All values that affect grandTotal come from DB, never from client.
  // ──────────────────────────────────────────────────────────────
  const productIds = items.map((i) => i.productId)
  const dbProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, price: true, stock: true, name: true, maxPerOrder: true, maxPerCustomer: true, releaseAt: true, categoryId: true },
  })

  if (dbProducts.length !== productIds.length) {
    return NextResponse.json({ error: 'สินค้าบางรายการไม่มีในระบบหรือถูกปิดการขายแล้ว' }, { status: 400 })
  }

  // Reject any item that hasn't reached its scheduled release time yet (pre-release / "coming soon").
  const now = new Date()
  for (const product of dbProducts) {
    if (product.releaseAt && product.releaseAt > now) {
      return NextResponse.json({ error: `สินค้า "${product.name}" ยังไม่เปิดจำหน่าย` }, { status: 400 })
    }
  }

  // priceMap is the server's source of truth for prices.
  const priceMap = Object.fromEntries(dbProducts.map((p) => [p.id, Number(p.price)]))

  for (const item of items) {
    const product = dbProducts.find((p) => p.id === item.productId)!
    if (product.stock < item.quantity) {
      return NextResponse.json({ error: `สินค้า "${product.name}" สต็อกไม่เพียงพอ` }, { status: 400 })
    }
    if (product.maxPerOrder && item.quantity > product.maxPerOrder) {
      return NextResponse.json({ error: `สินค้า "${product.name}" จำกัดการซื้อสูงสุด ${product.maxPerOrder} ชิ้น/ออเดอร์` }, { status: 400 })
    }
  }

  // ── Compute money amounts server-side (no client input) ─────────
  const subtotal = items.reduce((s, i) => s + priceMap[i.productId] * i.quantity, 0)

  let coupon: Awaited<ReturnType<typeof prisma.coupon.findUnique>> = null
  let couponDiscount = 0
  let freeShipping = false

  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.trim().toUpperCase() } })
    if (!coupon || !coupon.isActive) {
      return NextResponse.json({ error: 'Invalid or inactive coupon' }, { status: 400 })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 })
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 })
    }

    // Category restriction: the discount applies only to items in the allowed
    // categories. With no restriction, eligibleBase == subtotal (whole cart).
    const allowedCats = parseCategoryIds(coupon.categoryIds)
    const lineItems = items.map((i) => ({
      categoryId: dbProducts.find((p) => p.id === i.productId)!.categoryId,
      lineTotal:  priceMap[i.productId] * i.quantity,
    }))
    const eligibleBase = eligibleSubtotal(lineItems, allowedCats)
    if (allowedCats.length > 0 && eligibleBase <= 0) {
      return NextResponse.json({ error: 'คูปองนี้ใช้กับสินค้าในตะกร้าไม่ได้ (จำกัดเฉพาะบางหมวด)' }, { status: 400 })
    }
    if (coupon.minOrder !== null && eligibleBase < Number(coupon.minOrder)) {
      return NextResponse.json({ error: 'Order subtotal below coupon minimum' }, { status: 400 })
    }

    if (coupon.type === 'PERCENTAGE') {
      couponDiscount = (eligibleBase * Number(coupon.value)) / 100
      if (coupon.maxDiscount !== null) {
        couponDiscount = Math.min(couponDiscount, Number(coupon.maxDiscount))
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      couponDiscount = Math.min(Number(coupon.value), eligibleBase)
    } else if (coupon.type === 'FREE_SHIPPING') {
      freeShipping = true
    }
    couponDiscount = Math.round(couponDiscount * 100) / 100
  }

  // Influencer commission for this order (snapshot onto the order so payout
  // reports stay stable even if the coupon is later edited). Based on subtotal
  // (gross product total) — the sales the influencer's code drove.
  let commissionAmount = 0
  if (coupon && coupon.commissionType && coupon.commissionValue != null) {
    if (coupon.commissionType === 'PERCENTAGE') {
      commissionAmount = (subtotal * Number(coupon.commissionValue)) / 100
    } else {
      commissionAmount = Number(coupon.commissionValue)
    }
    commissionAmount = Math.round(commissionAmount * 100) / 100
  }

  const userSnapshot = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } })
  const availablePoints = userSnapshot?.points ?? 0
  // pointsToUse is clamped: can't exceed user's balance or subtotal — re-verified inside tx.
  const pointsDiscount = Math.floor(Math.min(pointsToUse, availablePoints, subtotal))

  // Free shipping when a FREE_SHIPPING coupon applies OR the product total after
  // coupon + points discounts reaches the threshold (computed AFTER discounts).
  const netAfterDiscounts = subtotal - couponDiscount - pointsDiscount
  const qualifiesFreeShipping = freeShipping || netAfterDiscounts >= FREE_SHIPPING_THRESHOLD

  const shippingFee = qualifiesFreeShipping ? 0 : (SHIPPING_FEES[shipping.shippingMethod] ?? DEFAULT_SHIPPING_FEE)
  const grandTotal = Math.max(0, subtotal + shippingFee - couponDiscount - pointsDiscount)
  const pointsEarned = Math.floor(grandTotal / 100)

  // ──────────────────────────────────────────────────────────────
  // TRANSACTION (re-verify atomically + commit mutations together)
  //
  // Race-condition strategy:
  //   • Stock:   updateMany WHERE stock >= qty → atomic decrement-or-fail
  //   • Points:  updateMany WHERE points >= deduction → atomic decrement-or-fail
  //   • Coupon:  updateMany WHERE usedCount < usageLimit → atomic increment-or-fail
  //   • Customer lifetime limit (maxPerCustomer): cannot be expressed as
  //     an atomic WHERE — uses SELECT … FOR UPDATE on the user row first to
  //     serialize concurrent orders from the same customer. Lock is released
  //     on commit/rollback.
  // ──────────────────────────────────────────────────────────────
  let order
  try {
    order = await prisma.$transaction(async (tx) => {
      // (1) Lock the user row FIRST so subsequent reads in this tx see a
      // snapshot taken AFTER the lock is acquired. This serializes concurrent
      // order placement for the same user. Other users are unaffected.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`

      // (2) Fetch product names (also establishes the consistent-read snapshot)
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
      const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]))

      // (3) Atomically decrement stock — race-free via WHERE guard.
      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        })
        if (updated.count === 0) {
          throw new OrderError(`สินค้า "${nameMap[item.productId] || item.productId}" หมดสต็อก กรุณารีเฟรชและลองใหม่`)
        }
      }

      // (4) Re-check customer lifetime limit INSIDE tx (under per-user lock)
      const itemsWithCustomerLimit = items.filter((i) => {
        const p = dbProducts.find((p) => p.id === i.productId)
        return p && p.maxPerCustomer
      })
      if (itemsWithCustomerLimit.length > 0) {
        const pastOrderIds = await tx.order.findMany({
          where: { userId, status: { not: 'CANCELLED' } },
          select: { id: true },
        }).then((rs) => rs.map((r) => r.id))

        for (const item of itemsWithCustomerLimit) {
          const product = dbProducts.find((p) => p.id === item.productId)!
          let alreadyBought = 0
          if (pastOrderIds.length > 0) {
            const agg = await tx.orderItem.aggregate({
              where: { productId: item.productId, orderId: { in: pastOrderIds } },
              _sum: { quantity: true },
            })
            alreadyBought = agg._sum.quantity ?? 0
          }
          if (alreadyBought + item.quantity > product.maxPerCustomer!) {
            const remaining = Math.max(0, product.maxPerCustomer! - alreadyBought)
            throw new OrderError(
              `สินค้า "${product.name}" จำกัดการซื้อ ${product.maxPerCustomer} ชิ้น/ลูกค้า (ซื้อไปแล้ว ${alreadyBought} ชิ้น, เหลือได้อีก ${remaining} ชิ้น)`,
            )
          }
        }
      }

      // (5) Atomically deduct points — race-free via WHERE guard + ตัด point lot (FIFO)
      if (pointsDiscount > 0) {
        const ok = await spendPoints(tx, userId, pointsDiscount)
        if (!ok) {
          throw new OrderError('แต้มสะสมไม่เพียงพอ กรุณารีเฟรชและลองใหม่')
        }
      }

      // (6) Atomically increment coupon usage — race-free via WHERE guard.
      if (coupon) {
        const couponWhere: {
          id: string
          isActive: boolean
          usedCount?: { lt: number }
        } = { id: coupon.id, isActive: true }
        if (coupon.usageLimit !== null) {
          couponWhere.usedCount = { lt: coupon.usageLimit }
        }
        const couponUpdate = await tx.coupon.updateMany({
          where: couponWhere,
          data: { usedCount: { increment: 1 } },
        })
        if (couponUpdate.count === 0) {
          throw new OrderError('คูปองหมดสิทธิ์ใช้งานแล้ว')
        }
      }

      // (7) Create the order — all amounts are server-computed from DB state
      return tx.order.create({
        data: {
          orderNumber:    generateOrderNumber(),
          userId,
          total:          grandTotal,
          recipientName:  shipping.recipientName,
          phone:          shipping.phone,
          address:        shipping.address,
          district:       shipping.district,
          province:       shipping.province,
          postalCode:     shipping.postalCode,
          shippingMethod: shipping.shippingMethod,
          paymentMethod:  shipping.paymentMethod,
          note:           shipping.note || null,
          pointsUsed:     pointsDiscount,
          pointsEarned,
          discount:       couponDiscount,
          shippingFee,
          commissionAmount,
          couponId:       coupon?.id ?? null,
          items: {
            create: items.map((i) => ({
              productId:   i.productId,
              quantity:    i.quantity,
              price:       priceMap[i.productId], // ← DB price, never client
              productName: nameMap[i.productId] || '',
            })),
          },
        },
        include: { items: true },
      })
    })
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.publicMessage }, { status: 400 })
    }
    console.error('[orders POST] transaction error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `สั่งซื้อไม่สำเร็จ: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ data: order }, { status: 201 })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: orders })
}
