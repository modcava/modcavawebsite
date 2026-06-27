import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { sendShippedEmail, sendOrderConfirmedEmail, sendBalanceDueEmail, sendBalancePaidEmail } from '@/lib/email'
import { earnPoints } from '@/lib/points'
import { maybeSweepExpiredUnpaidOrders, restoreOrderResources } from '@/lib/order-maintenance'
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
    // พรีออเดอร์ยอดคงเหลือ: remind = แจ้งของมาถึง/ทวงยอด, confirm = ยืนยันรับยอดครบ
    balanceAction:  z.enum(['confirm','remind']).optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { id, balanceAction, ...data } = parsed.data

  // ── Balance actions (preorder remaining balance) — จัดการแยกจากการเปลี่ยนสถานะ ──
  if (balanceAction) {
    const ord = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true, orderNumber: true, total: true, shippingFee: true,
        remainingBalance: true, balanceShippingFee: true, balancePaidAt: true,
        user: { select: { name: true, email: true } },
      },
    })
    if (!ord) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const remaining = Number(ord.remainingBalance)
    // Deposit orders defer shipping to the balance payment — collected together with it.
    const balanceShip = Number(ord.balanceShippingFee)
    if (remaining <= 0 || ord.balancePaidAt) {
      return NextResponse.json({ error: 'ออเดอร์นี้ไม่มียอดคงเหลือค้างชำระ' }, { status: 400 })
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://modcava.com'

    if (balanceAction === 'remind') {
      if (!ord.user?.email) {
        return NextResponse.json({ error: 'ลูกค้าไม่มีอีเมล — ส่งแจ้งเตือนไม่ได้' }, { status: 400 })
      }
      // ส่งจริงแบบ await + รู้ผล (ระบบเดียวกับ api/admin/send-email) — ไม่ fire-and-forget
      // เพื่อให้แอดมินเห็นผลสำเร็จ/ล้มเหลวจริง (เดิมเด้ง success เสมอแม้เมลไม่ออก)
      try {
        const result = await sendBalanceDueEmail({
          to:               ord.user.email,
          name:             ord.user.name ?? '',
          orderNumber:      ord.orderNumber,
          remainingBalance: remaining,
          shippingFee:      balanceShip,
          depositPaid:      Number(ord.total),
          paymentUrl:       `${appUrl}/orders/${ord.orderNumber}/payment?type=balance`,
        })
        if (ctx) {
          await logAudit(ctx, {
            action: 'order.balance_remind', resource: 'order', resourceId: id,
            details: { orderNumber: ord.orderNumber, remaining, to: ord.user.email }, req,
          })
        }
        return NextResponse.json({ data: { ok: true, messageId: result?.messageId ?? null } })
      } catch (e) {
        console.error('[sendBalanceDueEmail]', e)
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'ส่งอีเมลแจ้งเตือนไม่สำเร็จ' },
          { status: 500 },
        )
      }
    }

    // confirm — ปิดยอดคงเหลือแบบ atomic (กันกดซ้ำ/แอดมินสองคน). ค่าจัดส่งที่เลื่อนมา
    // เก็บรอบนี้ ถูกพับเข้า shippingFee + total เพื่อให้รายงาน/ใบเสร็จเห็นยอดที่เก็บจริง.
    const upd = await prisma.order.updateMany({
      where: { id, balancePaidAt: null },
      data:  {
        balancePaidAt: new Date(),
        remainingBalance: 0,
        ...(balanceShip > 0 && {
          total:              Number(ord.total) + balanceShip,
          shippingFee:        Number(ord.shippingFee) + balanceShip,
          balanceShippingFee: 0,
        }),
      },
    })
    if (upd.count === 0) {
      return NextResponse.json({ error: 'ยืนยันไม่สำเร็จ (ยอดถูกปิดไปแล้ว)' }, { status: 400 })
    }
    const balanceCollected = remaining + balanceShip
    if (ord.user?.email) {
      sendBalancePaidEmail({
        to:          ord.user.email,
        name:        ord.user.name ?? '',
        orderNumber: ord.orderNumber,
        amount:      balanceCollected,
      }).catch((e) => console.error('[sendBalancePaidEmail]', e))
    }
    if (ctx) {
      await logAudit(ctx, {
        action: 'order.balance_confirm', resource: 'order', resourceId: id,
        details: { orderNumber: ord.orderNumber, amount: balanceCollected, shippingFee: balanceShip }, req,
      })
    }
    return NextResponse.json({ data: { ok: true } })
  }

  // ดึง order เดิมก่อน เพื่อใช้เทียบสถานะตอนส่งอีเมล / audit หลัง tx
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
      // ล็อกแถวออเดอร์ก่อน เพื่อ serialize การเปลี่ยนสถานะที่เข้ามาพร้อมกัน
      // (กันการให้แต้ม/คืนสต็อกซ้ำ จากการกดรัว หรือแอดมินสองคนพร้อมกัน)
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`

      // อ่านสถานะปัจจุบันภายใต้ล็อก — ใช้ตัดสินใจให้/คืนแต้มแบบ atomic
      const current = await tx.order.findUnique({
        where: { id },
        select: {
          status: true, userId: true, pointsUsed: true, pointsEarned: true,
          couponId: true,
          items: { select: { productId: true, quantity: true } },
        },
      })
      if (!current) throw new Error('Order not found')

      const updated = await tx.order.update({
        where: { id },
        data: data as { status?: OrderStatus; trackingNumber?: string },
        include: { user: { select: { id: true, name: true, email: true } }, items: true },
      })

      // เพิ่มแต้มเมื่อเปลี่ยนเป็น SHIPPED ครั้งแรก — ให้ "ครั้งเดียว" จริงๆ
      // เช็คว่ามี point lot ของออเดอร์นี้ (reason='order') อยู่แล้วหรือยัง เพื่อกัน
      // การบวกแต้มซ้ำจากการสลับสถานะ SHIPPED→CONFIRMED→SHIPPED
      if (
        data.status === 'SHIPPED' &&
        current.status !== 'SHIPPED' &&
        current.pointsEarned > 0
      ) {
        const alreadyCredited = await tx.pointLot.count({
          where: { orderId: id, reason: 'order' },
        })
        if (alreadyCredited === 0) {
          await earnPoints(tx, current.userId, current.pointsEarned, { reason: 'order', orderId: id })
        }
      }

      // คืนสต็อก/แต้ม/คูปอง เมื่อเปลี่ยนเป็น CANCELLED ครั้งแรก (กันคืนซ้ำด้วยเงื่อนไขสถานะ)
      if (data.status === 'CANCELLED' && current.status !== 'CANCELLED') {
        await restoreOrderResources(tx, {
          id,
          userId:     current.userId,
          pointsUsed: current.pointsUsed,
          couponId:   current.couponId,
          items:      current.items,
        })
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
