import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CARD_SURCHARGE_RATE, CARD_MAX_TOTAL } from '@/lib/payment'

// GET /api/orders/[orderNumber] — single order for its owner (or any admin).
// Used by the payment page to branch the UI by payment method.
export async function GET(
  _req: Request,
  { params }: { params: { orderNumber: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    select: {
      orderNumber: true, userId: true, status: true,
      total: true, discount: true, shippingFee: true, surcharge: true,
      paymentMethod: true, slipUrl: true, createdAt: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // Owner or admin only.
  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    data: {
      orderNumber:   order.orderNumber,
      status:        order.status,
      total:         Number(order.total),
      discount:      Number(order.discount),
      shippingFee:   Number(order.shippingFee),
      surcharge:     Number(order.surcharge),
      paymentMethod: order.paymentMethod,
      slipUrl:       order.slipUrl,
    },
  })
}

// PATCH /api/orders/[orderNumber] — let the owner switch payment method while
// the order is still unpaid (PENDING). Recomputes the credit-card surcharge and
// total from the stored base (total − surcharge), so no need to touch
// coupons/points/stock.
const ALLOWED_METHODS = ['PromptPay', 'Credit Card']

export async function PATCH(
  req: Request,
  { params }: { params: { orderNumber: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const method = (body as { paymentMethod?: string }).paymentMethod
  if (!method || !ALLOWED_METHODS.includes(method)) {
    return NextResponse.json({ error: 'วิธีชำระเงินไม่ถูกต้อง' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    select: { id: true, userId: true, status: true, total: true, surcharge: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.userId !== session.user.id && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (order.status !== 'PENDING') {
    return NextResponse.json({ error: 'เปลี่ยนวิธีชำระเงินได้เฉพาะออเดอร์ที่ยังไม่ชำระ' }, { status: 400 })
  }

  // base = the payable before any card surcharge (always exact round-trip)
  const base = Number(order.total) - Number(order.surcharge)
  const surcharge = method === 'Credit Card' ? Math.round(base * CARD_SURCHARGE_RATE * 100) / 100 : 0
  const total = Math.round((base + surcharge) * 100) / 100

  // Hard ceiling on credit-card orders (manual payment-link flow): can't switch
  // to card if the resulting charge (incl. surcharge) would exceed CARD_MAX_TOTAL.
  if (method === 'Credit Card' && total > CARD_MAX_TOTAL) {
    return NextResponse.json(
      { error: `รับชำระด้วยบัตรเครดิตได้ไม่เกิน ฿${CARD_MAX_TOTAL.toLocaleString()} (ยอดออเดอร์ ฿${total.toLocaleString()})` },
      { status: 400 },
    )
  }

  // Atomic guard: only update if still PENDING (race with admin confirming).
  const upd = await prisma.order.updateMany({
    where: { id: order.id, status: 'PENDING' },
    data: { paymentMethod: method, surcharge, total },
  })
  if (upd.count === 0) {
    return NextResponse.json({ error: 'เปลี่ยนวิธีชำระเงินไม่สำเร็จ (สถานะออเดอร์เปลี่ยนไปแล้ว)' }, { status: 400 })
  }

  return NextResponse.json({ data: { paymentMethod: method, total, surcharge } })
}
