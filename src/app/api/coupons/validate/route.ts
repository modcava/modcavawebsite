import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseCategoryIds, eligibleSubtotal } from '@/lib/coupon'

export async function POST(req: NextRequest) {
  // Rate limit: prevent brute-force discovery of valid coupon codes
  const rl = enforceRateLimit(req, {
    key: 'coupon:validate',
    limit: 30,
    windowMs: 60 * 1000, // 30 per minute per IP
  })
  if (rl) return rl

  try {
    const body = await req.json()
    const { code, subtotal, items } = body as {
      code: string
      subtotal?: number
      items?: { productId: string; quantity: number }[]
    }

    if (!code || (typeof subtotal !== 'number' && !Array.isArray(items))) {
      return NextResponse.json({ valid: false, error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 })
    }

    const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } })

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'ไม่พบรหัสคูปอง' })
    }
    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, error: 'คูปองนี้ถูกปิดใช้งานแล้ว' })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, error: 'คูปองหมดอายุแล้ว' })
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return NextResponse.json({ valid: false, error: 'คูปองถูกใช้ครบจำนวนแล้ว' })
    }

    // Resolve the subtotal eligible for this coupon. Prefer cart items (so we
    // can honour category restrictions with authoritative DB prices); fall back
    // to the raw subtotal for unrestricted coupons / legacy callers.
    const allowedCats = parseCategoryIds(coupon.categoryIds)
    let cartSubtotal = typeof subtotal === 'number' ? subtotal : 0
    let eligibleBase = cartSubtotal

    if (Array.isArray(items) && items.length > 0) {
      const ids = items.map((i) => i.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true, categoryId: true },
      })
      const pmap = new Map(products.map((p) => [p.id, p]))
      const lineItems = items
        .map((i) => {
          const p = pmap.get(i.productId)
          if (!p) return null
          return { categoryId: p.categoryId, lineTotal: Number(p.price) * i.quantity }
        })
        .filter((x): x is { categoryId: string; lineTotal: number } => x !== null)
      cartSubtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0)
      eligibleBase = eligibleSubtotal(lineItems, allowedCats)
    } else if (allowedCats.length > 0) {
      // Restricted coupon but no item breakdown sent — can't scope safely.
      return NextResponse.json({ valid: false, error: 'คูปองนี้จำกัดเฉพาะบางหมวดสินค้า' })
    }

    if (allowedCats.length > 0 && eligibleBase <= 0) {
      return NextResponse.json({ valid: false, error: 'คูปองนี้ใช้กับสินค้าในตะกร้าไม่ได้ (จำกัดเฉพาะบางหมวด)' })
    }
    if (coupon.minOrder !== null && eligibleBase < Number(coupon.minOrder)) {
      return NextResponse.json({
        valid: false,
        error: `ยอดสั่งซื้อขั้นต่ำ ฿${Number(coupon.minOrder).toLocaleString()}`,
      })
    }

    let discount = 0
    let freeShipping = false

    if (coupon.type === 'PERCENTAGE') {
      discount = (eligibleBase * Number(coupon.value)) / 100
      if (coupon.maxDiscount !== null) {
        discount = Math.min(discount, Number(coupon.maxDiscount))
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(Number(coupon.value), eligibleBase)
    } else if (coupon.type === 'FREE_SHIPPING') {
      freeShipping = true
      discount = 0
    }

    discount = Math.round(discount * 100) / 100

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
      },
      discount,
      freeShipping,
      // true when the discount was scoped to a subset of the cart
      categoryRestricted: allowedCats.length > 0 && eligibleBase < cartSubtotal,
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
