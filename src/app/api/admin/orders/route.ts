import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendShippedEmail, sendOrderConfirmedEmail } from '@/lib/email'
import { earnPoints } from '@/lib/points'
import { maybeSweepExpiredUnpaidOrders } from '@/lib/order-maintenance'
import type { OrderStatus } from '@prisma/client'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  // Opportunistic cleanup — auto-cancel unpaid orders that passed the 48h window
  // so the admin list reflects them. Throttled internally to once / 10 min.
  await maybeSweepExpiredUnpaidOrders()

  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status') as OrderStatus | null
  const orderNumber = searchParams.get('orderNumber') || ''
  const page        = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize    = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || 20)))

  const where = {
    ...(status      && { status }),
    ...(orderNumber && { orderNumber: { contains: orderNumber } }),
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, emoji: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({ data: orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const body = await req.json()
  const schema = z.object({
    id:             z.string(),
    status:         z.enum(['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED']).optional(),
    trackingNumber: z.string().optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { id, ...data } = parsed.data

  // ดึง order เดิมก่อน เพื่อเช็คว่าเปลี่ยนจาก non-CONFIRMED → CONFIRMED
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { status: true, userId: true, pointsEarned: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  let order
  try {
    order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: data as { status?: OrderStatus; trackingNumber?: string },
        include: { user: { select: { id: true, name: true, email: true } }, items: true },
      })

      // เพิ่มแต้มเมื่อเปลี่ยนสถานะเป็น SHIPPED ครั้งแรก (สร้าง point lot อายุ 12 เดือน)
      if (
        data.status === 'SHIPPED' &&
        existing.status !== 'SHIPPED' &&
        existing.pointsEarned > 0
      ) {
        await earnPoints(tx, existing.userId, existing.pointsEarned, { reason: 'order', orderId: id })
      }

      return updated
    })
  } catch (err) {
    console.error('[admin orders PATCH] error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${msg}` }, { status: 500 })
  }

  // ส่ง email แจ้งลูกค้าเมื่อเปลี่ยนสถานะเป็น CONFIRMED ครั้งแรก (ตรวจสอบการชำระเงินแล้ว)
  if (data.status === 'CONFIRMED' && existing.status !== 'CONFIRMED' && order.user?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://modcava.com'
    sendOrderConfirmedEmail({
      to:          order.user.email,
      name:        order.user.name ?? '',
      orderNumber: order.orderNumber,
      total:       order.total.toNumber(),
      items:       order.items.map((it) => ({
        productName: it.productName,
        quantity:    it.quantity,
        price:       it.price.toNumber(),
      })),
      orderUrl:    `${appUrl}/orders/${order.orderNumber}/payment`,
    }).catch((e) => console.error('[sendOrderConfirmedEmail]', e))
  }

  // ส่ง email แจ้งลูกค้าเมื่อเปลี่ยนสถานะเป็น SHIPPED
  if (data.status === 'SHIPPED' && existing.status !== 'SHIPPED' && order.user?.email) {
    sendShippedEmail({
      to:             order.user.email,
      name:           order.user.name ?? '',
      orderNumber:    order.orderNumber,
      shippingMethod: order.shippingMethod ?? '',
      trackingNumber: order.trackingNumber,
    }).catch((e) => console.error('[sendShippedEmail]', e))
  }

  // Audit: only log if something actually changed
  if (ctx) {
    const changed: Record<string, unknown> = {}
    if (data.status && data.status !== existing.status) {
      changed.status = { from: existing.status, to: data.status }
    }
    if (data.trackingNumber !== undefined) {
      changed.trackingNumber = data.trackingNumber
    }
    if (Object.keys(changed).length > 0) {
      await logAudit(ctx, {
        action: data.status === 'CANCELLED' ? 'order.cancel' : 'order.update',
        resource: 'order',
        resourceId: order.id,
        details: { orderNumber: order.orderNumber, ...changed },
        req,
      })
    }
  }

  return NextResponse.json({ data: order })
}
