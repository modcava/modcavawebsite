import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return null
  return session
}

const createSchema = z.object({
  code:        z.string().min(1).max(50),
  type:        z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value:       z.number().min(0),
  minOrder:    z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit:  z.number().int().min(1).optional(),
  expiresAt:   z.string().optional(),
})

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ data: coupons })
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { code, type, value, minOrder, maxDiscount, usageLimit, expiresAt } = parsed.data

  try {
    const coupon = await prisma.coupon.create({
      data: {
        code:        code.trim().toUpperCase(),
        type,
        value,
        minOrder:    minOrder ?? null,
        maxDiscount: maxDiscount ?? null,
        usageLimit:  usageLimit ?? null,
        expiresAt:   expiresAt ? new Date(expiresAt) : null,
      },
    })
    await logAudit(
      { userId: session.user.id, userEmail: session.user.email ?? '' },
      {
        action: 'coupon.create',
        resource: 'coupon',
        resourceId: coupon.id,
        details: { code: coupon.code, type, value },
        req,
      },
    )
    return NextResponse.json({ data: coupon }, { status: 201 })
  } catch (e: unknown) {
    const err = e as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}
