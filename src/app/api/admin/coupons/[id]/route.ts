import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return null
  return session
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { isActive } = body as { isActive: boolean }

  try {
    const coupon = await prisma.coupon.update({
      where: { id: params.id },
      data: { isActive },
    })
    await logAudit(
      { userId: session.user.id, userEmail: session.user.email ?? '' },
      {
        action: isActive ? 'coupon.enable' : 'coupon.disable',
        resource: 'coupon',
        resourceId: coupon.id,
        details: { code: coupon.code, isActive },
        req,
      },
    )
    return NextResponse.json({ data: coupon })
  } catch {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Snapshot for audit
    const target = await prisma.coupon.findUnique({
      where: { id: params.id },
      select: { code: true, type: true, value: true },
    })
    await prisma.coupon.delete({ where: { id: params.id } })
    await logAudit(
      { userId: session.user.id, userEmail: session.user.email ?? '' },
      {
        action: 'coupon.delete',
        resource: 'coupon',
        resourceId: params.id,
        details: target ?? undefined,
        req,
      },
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  }
}
