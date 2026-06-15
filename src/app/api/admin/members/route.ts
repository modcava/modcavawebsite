import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') || ''
  const pageSize = Math.min(20, Number(searchParams.get('pageSize') || 10))

  const where = search ? {
    OR: [
      { name:  { contains: search } },
      { email: { contains: search } },
    ],
  } : {}

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, phone: true,
      savedAddress: true, savedDistrict: true, savedProvince: true, savedPostal: true,
    },
    orderBy: { name: 'asc' },
    take: pageSize,
  })

  return NextResponse.json({ data: users })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const body = await req.json()
  const parsed = z.object({
    userId: z.string(),
    points: z.number().int().min(0),
  }).safeParse(body)

  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { userId, points } = parsed.data

  // Snapshot before-value so the audit log shows from→to (points = money-equivalent)
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true, email: true },
  })

  const user = await prisma.user.update({
    where: { id: userId },
    data: { points },
    select: { id: true, points: true },
  })

  if (ctx && before && before.points !== points) {
    await logAudit(ctx, {
      action: 'member.points.update',
      resource: 'user',
      resourceId: userId,
      details: { email: before.email, points: { from: before.points, to: points } },
      req,
    })
  }

  return NextResponse.json({ data: user })
}
