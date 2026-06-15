import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [
    totalOrdersResult,
    totalRevenueResult,
    totalProducts,
    totalUsers,
    ordersByStatus,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: 'CANCELLED' } },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, emoji: true } } } },
      },
    }),
  ])

  const statusMap = Object.fromEntries(
    ordersByStatus.map((o) => [o.status, o._count.status])
  )

  return NextResponse.json({
    data: {
      totalRevenue:  totalRevenueResult._sum.total?.toNumber() ?? 0,
      totalOrders:   totalOrdersResult,
      totalProducts,
      totalUsers,
      ordersByStatus: statusMap,
      recentOrders,
    },
  })
}
