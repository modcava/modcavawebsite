import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'

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
    const { code, subtotal } = body as { code: string; subtotal: number }

    if (!code || typeof subtotal !== 'number') {
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

    if (coupon.minOrder !== null && subtotal < Number(coupon.minOrder)) {
      return NextResponse.json({
        valid: false,
        error: `ยอดสั่งซื้อขั้นต่ำ ฿${Number(coupon.minOrder).toLocaleString()}`,
      })
    }

    let discount = 0
    let freeShipping = false

    if (coupon.type === 'PERCENTAGE') {
      discount = (subtotal * Number(coupon.value)) / 100
      if (coupon.maxDiscount !== null) {
        discount = Math.min(discount, Number(coupon.maxDiscount))
      }
    } else if (coupon.type === 'FIXED_AMOUNT') {
      discount = Math.min(Number(coupon.value), subtotal)
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
    })
  } catch {
    return NextResponse.json({ valid: false, error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
