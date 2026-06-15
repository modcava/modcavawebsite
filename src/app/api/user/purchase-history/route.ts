import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const productIds = searchParams.get('productIds')?.split(',').filter(Boolean) ?? []
  if (productIds.length === 0) {
    return NextResponse.json({ data: {} })
  }

  const pastOrderIds = await prisma.order.findMany({
    where: { userId: session.user.id, status: { not: 'CANCELLED' } },
    select: { id: true },
  }).then((rows) => rows.map((r) => r.id))

  const bought: Record<string, number> = Object.fromEntries(productIds.map((id) => [id, 0]))

  if (pastOrderIds.length > 0) {
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: { in: productIds }, orderId: { in: pastOrderIds } },
      select: { productId: true, quantity: true },
    })
    for (const oi of orderItems) {
      bought[oi.productId] = (bought[oi.productId] ?? 0) + oi.quantity
    }
  }

  return NextResponse.json({ data: bought })
}
