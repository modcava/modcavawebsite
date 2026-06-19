import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { OrderStatus, Prisma } from '@prisma/client'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return null
  return session
}

// Orders that count toward an influencer payout.
//   payable (default) — confirmed-paid and beyond (what you actually owe)
//   all               — everything except cancelled (includes unpaid PENDING)
const PAYABLE: OrderStatus[] = ['CONFIRMED', 'SHIPPED', 'DELIVERED']
const NON_CANCELLED: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED']

// GET /api/admin/influencers/report?mode=payable|all&from=ISO&to=ISO
export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = new URL(req.url).searchParams
  const mode = sp.get('mode') === 'all' ? 'all' : 'payable'
  const fromStr = sp.get('from')
  const toStr = sp.get('to')

  const statuses = mode === 'all' ? NON_CANCELLED : PAYABLE

  // Date range filter on order createdAt (inclusive). `to` is end-of-day.
  const createdAt: Prisma.DateTimeFilter = {}
  if (fromStr) { const d = new Date(fromStr); if (!isNaN(d.getTime())) createdAt.gte = d }
  if (toStr) { const d = new Date(toStr); if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); createdAt.lte = d } }
  const hasDate = createdAt.gte != null || createdAt.lte != null

  // 1) All influencer-attributed coupons (so codes with 0 orders still show).
  const coupons = await prisma.coupon.findMany({
    where: { OR: [{ influencerName: { not: null } }, { commissionType: { not: null } }] },
    orderBy: { createdAt: 'desc' },
  })

  if (coupons.length === 0) {
    return NextResponse.json({ mode, rows: [], totals: { orders: 0, sales: 0, discount: 0, commission: 0 } })
  }

  // 2) Aggregate orders per coupon within the status + date window.
  const grouped = await prisma.order.groupBy({
    by: ['couponId'],
    where: {
      couponId: { in: coupons.map((c) => c.id) },
      status: { in: statuses },
      ...(hasDate ? { createdAt } : {}),
    },
    _count: { _all: true },
    _sum: { total: true, discount: true, commissionAmount: true },
  })
  const byCoupon = new Map(grouped.map((g) => [g.couponId, g]))

  const rows = coupons.map((c) => {
    const g = byCoupon.get(c.id)
    return {
      couponId:          c.id,
      code:              c.code,
      influencerName:    c.influencerName,
      influencerContact: c.influencerContact,
      commissionType:    c.commissionType,
      commissionValue:   c.commissionValue != null ? Number(c.commissionValue) : null,
      discountType:      c.type,
      discountValue:     Number(c.value),
      isActive:          c.isActive,
      orders:            g?._count._all ?? 0,
      sales:             Number(g?._sum.total ?? 0),
      discount:          Number(g?._sum.discount ?? 0),
      commission:        Number(g?._sum.commissionAmount ?? 0),
    }
  })

  const totals = rows.reduce(
    (t, r) => ({
      orders:     t.orders + r.orders,
      sales:      t.sales + r.sales,
      discount:   t.discount + r.discount,
      commission: t.commission + r.commission,
    }),
    { orders: 0, sales: 0, discount: 0, commission: 0 },
  )

  return NextResponse.json({ mode, rows, totals })
}
