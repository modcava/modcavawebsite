import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { InvoiceStatus } from '@prisma/client'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// Validation for invoice creation. The client sends `lineItems` already
// JSON-stringified (column is a String), `discount` as a number, and dates as
// ISO strings. Unknown keys (e.g. customerId) are stripped by z.object().
const createSchema = z.object({
  invoiceNumber:   z.string().min(1, 'invoiceNumber required').max(50),
  orderId:         z.string().optional(),
  status:          z.enum(['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']).optional(),
  customerName:    z.string().max(200).optional(),
  customerEmail:   z.string().max(200).optional(),
  customerPhone:   z.string().max(50).optional(),
  customerAddress: z.string().max(1000).optional(),
  issuedAt:        z.string().optional(),
  dueDate:         z.string().optional(),
  lineItems:       z.string().optional(),
  discount:        z.number().min(0).optional(),
  note:            z.string().max(2000).optional(),
})

// GET /api/admin/invoices
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status') || ''
  const search   = searchParams.get('search') || ''
  const page     = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Number(searchParams.get('pageSize') || 50))

  const where = {
    ...(status && { status: status as InvoiceStatus }),
    ...(search && {
      OR: [
        { invoiceNumber:  { contains: search } },
        { customerName:   { contains: search } },
        { customerEmail:  { contains: search } },
        { order: { orderNumber: { contains: search } } },
        { order: { user:  { name:  { contains: search } } } },
        { order: { user:  { email: { contains: search } } } },
      ],
    }),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        order: {
          include: {
            user:  { select: { id: true, name: true, email: true, phone: true } },
            items: { include: { product: { select: { name: true, emoji: true, imageUrl: true } } } },
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
  ])

  return NextResponse.json({ data: invoices, total, totalPages: Math.ceil(total / pageSize) })
}

// POST /api/admin/invoices — create invoice (standalone or from order)
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const {
    invoiceNumber, orderId, status,
    customerName, customerEmail, customerPhone, customerAddress,
    issuedAt, dueDate, lineItems, discount, note,
  } = parsed.data

  // If linking to an order, validate it exists & no duplicate
  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const existing = await prisma.invoice.findUnique({ where: { orderId } })
    if (existing) return NextResponse.json({ error: 'Invoice already exists for this order', invoice: existing }, { status: 409 })
  }

  let invoice
  try {
    invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        status:          (status || 'ISSUED') as InvoiceStatus,
        orderId:         orderId         || null,
        customerName:    customerName    || null,
        customerEmail:   customerEmail   || null,
        customerPhone:   customerPhone   || null,
        customerAddress: customerAddress || null,
        issuedAt:        issuedAt ? new Date(issuedAt) : new Date(),
        dueDate:         dueDate  ? new Date(dueDate)  : null,
        lineItems:       lineItems ?? null,
        discount:        discount  ?? 0,
        note:            note      || null,
      },
      include: {
        order: {
          include: {
            user:  { select: { id: true, name: true, email: true, phone: true } },
            items: { include: { product: { select: { name: true, emoji: true, imageUrl: true } } } },
          },
        },
      },
    })
  } catch (e: unknown) {
    // invoiceNumber is @unique — duplicate → 409 instead of an unhandled 500
    if ((e as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: `เลขใบแจ้งหนี้ ${invoiceNumber} มีอยู่แล้ว` }, { status: 409 })
    }
    console.error('[admin invoices POST] error:', e)
    return NextResponse.json({ error: 'สร้างใบแจ้งหนี้ไม่สำเร็จ' }, { status: 500 })
  }

  if (ctx) {
    await logAudit(ctx, {
      action: 'invoice.create',
      resource: 'invoice',
      resourceId: invoice.id,
      details: { invoiceNumber: invoice.invoiceNumber, status: invoice.status, orderId: invoice.orderId },
      req,
    })
  }

  return NextResponse.json({ data: invoice }, { status: 201 })
}
