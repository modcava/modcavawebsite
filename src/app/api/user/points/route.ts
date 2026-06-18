import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getExpiringSoon } from '@/lib/points'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [user, expiring] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { points: true } }),
    getExpiringSoon(session.user.id),
  ])

  return NextResponse.json({
    points: user?.points ?? 0,
    expiringSoon: expiring ? { amount: expiring.amount, date: expiring.date.toISOString() } : null,
  })
}
