import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

async function getAdminCtx() {
  const session = await getServerSession(authOptions)
  return session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null
}

// include order + slipUrl (ใช้กับทุก endpoint)
const orderInclude = {
  order: {
    include: {
      user:  { select: { id: true, name: true, email: true, phone: true } },
      items: { include: { product: { select: { name: true, emoji: true, imageUrl: true } } } },
    },
  },
}

// alias — GET endpoint ใช้อันเดียวกัน (order.slipUrl ถูก include โดย default)
const orderIncludeFull = orderInclude

// GET /api/admin/invoices/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: orderIncludeFull,
  })
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: invoice })
}

// PATCH /api/admin/invoices/[id] — update invoice fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const ctx = await getAdminCtx()

  const body = await req.json()
  const allowedStatuses = ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED']
  if (body.status && !allowedStatuses.includes(body.status))
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  // Snapshot status before update so the audit shows from→to for status changes
  const before = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: { status: true, invoiceNumber: true },
  })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const invoice = await prisma.invoice.update({
    where: { id: params.id },
    data: {
      ...(body.status           !== undefined && { status: body.status }),
      ...(body.note             !== undefined && { note: body.note }),
      ...(body.customerName     !== undefined && { customerName:    body.customerName    || null }),
      ...(body.customerEmail    !== undefined && { customerEmail:   body.customerEmail   || null }),
      ...(body.customerPhone    !== undefined && { customerPhone:   body.customerPhone   || null }),
      ...(body.customerAddress  !== undefined && { customerAddress: body.customerAddress || null }),
      ...(body.issuedAt         !== undefined && { issuedAt: new Date(body.issuedAt) }),
      ...(body.dueDate          !== undefined && { dueDate:  body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.lineItems        !== undefined && { lineItems: body.lineItems }),
      ...(body.discount         !== undefined && { discount: body.discount ?? 0 }),
      ...(body.slipUrl          !== undefined && { slipUrl: body.slipUrl || null }),
    },
    include: orderInclude,
  })

  if (ctx) {
    const details: Record<string, unknown> = { invoiceNumber: invoice.invoiceNumber }
    if (body.status !== undefined && body.status !== before.status) {
      details.status = { from: before.status, to: body.status }
    }
    await logAudit(ctx, {
      action: 'invoice.update',
      resource: 'invoice',
      resourceId: invoice.id,
      details,
      req,
    })
  }

  return NextResponse.json({ data: invoice })
}

// DELETE /api/admin/invoices/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const ctx = await getAdminCtx()

  // Snapshot invoiceNumber for the audit log before the row is gone
  const target = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: { invoiceNumber: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.invoice.delete({ where: { id: params.id } })

  if (ctx) {
    await logAudit(ctx, {
      action: 'invoice.delete',
      resource: 'invoice',
      resourceId: params.id,
      details: { invoiceNumber: target.invoiceNumber },
      req,
    })
  }

  return NextResponse.json({ success: true })
}
