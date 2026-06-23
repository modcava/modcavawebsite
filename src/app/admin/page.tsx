import { prisma } from '@/lib/prisma'
import { formatPrice, statusColor } from '@/lib/utils'
import { DashboardCharts } from './dashboard-charts'

export const metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default async function AdminDashboard() {
  const [totalOrders, revenue, totalProducts, totalUsers, recentOrders, byStatus, orderRows, itemRows, categories] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.order.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } }, items: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { status: true } }),
    // Time-series basis: orders + revenue per month (net of cancellations,
    // matching the "Total Revenue – Excl. cancelled" card above).
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      select: { total: true, createdAt: true },
    }),
    // Category basis: line value (price × qty) of every item in a non-cancelled
    // order, tagged with its product's category and the order month.
    prisma.orderItem.findMany({
      where: { order: { status: { not: 'CANCELLED' } } },
      select: {
        quantity: true,
        price: true,
        product: { select: { categoryId: true } },
        order: { select: { createdAt: true } },
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true, nameTh: true, emoji: true, slug: true } }),
  ])

  const totalRevenue = revenue._sum.total?.toNumber() ?? 0
  const statusMap = Object.fromEntries(byStatus.map((o) => [o.status, o._count.status]))

  // ── Aggregate orders → per-month { orders, revenue } ────────
  const monthlyMap = new Map<string, { orders: number; revenue: number }>()
  for (const o of orderRows) {
    const key = ym(o.createdAt)
    const cur = monthlyMap.get(key) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += Number(o.total)
    monthlyMap.set(key, cur)
  }
  const monthly = Array.from(monthlyMap.entries())
    .map(([key, v]) => ({ ym: key, year: +key.slice(0, 4), month: +key.slice(5, 7), orders: v.orders, revenue: v.revenue }))
    .sort((a, b) => a.ym.localeCompare(b.ym))

  // ── Aggregate items → compact (month × category) matrix ─────
  const catMap = new Map<string, { revenue: number; qty: number }>()
  for (const it of itemRows) {
    const key = `${ym(it.order.createdAt)}|${it.product.categoryId}`
    const cur = catMap.get(key) ?? { revenue: 0, qty: 0 }
    cur.revenue += Number(it.price) * it.quantity
    cur.qty += it.quantity
    catMap.set(key, cur)
  }
  const categoryMatrix = Array.from(catMap.entries()).map(([key, v]) => {
    const [m, categoryId] = key.split('|')
    return { ym: m, categoryId, revenue: v.revenue, qty: v.qty }
  })

  const STATS = [
    { label: 'Total Revenue',  value: formatPrice(totalRevenue), sub: 'Excl. cancelled' },
    { label: 'Total Orders',   value: totalOrders.toLocaleString(), sub: 'All time' },
    { label: 'Active Products',value: totalProducts.toLocaleString(), sub: 'In catalogue' },
    { label: 'Customers',      value: totalUsers.toLocaleString(), sub: 'Registered' },
  ]

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="eyebrow mb-2">Admin</div>
      <h1 className="font-display font-bold text-2xl text-warm-50 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider mb-1">{s.label}</div>
            <div className="font-mono text-2xl font-bold text-amber-light">{s.value}</div>
            <div className="font-mono text-xs text-warm-600 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Order status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-warm-100 mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-600">
                  {['Order','Customer','Items','Total','Status','Date'].map((h) => (
                    <th key={h} className="text-left font-mono text-[10px] uppercase tracking-wider text-warm-500 pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-700">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-warm-700/30 transition-colors">
                    <td className="py-2 pr-4 font-mono text-xs text-amber">{o.orderNumber}</td>
                    <td className="py-2 pr-4 text-warm-300 text-xs">{o.user.name || o.user.email}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-warm-400">{o.items.length}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-amber-light font-semibold">{formatPrice(Number(o.total))}</td>
                    <td className="py-2 pr-4">
                      <span className={`badge text-[10px] ${statusColor(o.status)}`}>{o.status}</span>
                    </td>
                    <td className="py-2 font-mono text-[10px] text-warm-500">
                      {new Date(o.createdAt).toLocaleDateString('th-TH')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-warm-100 mb-4">Orders by Status</h2>
          <div className="space-y-3">
            {['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'].map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className={`badge text-[10px] ${statusColor(s)}`}>{s}</span>
                <span className="font-mono text-sm font-semibold text-warm-200">{statusMap[s] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales analytics — monthly/yearly breakdown + category pie */}
      <DashboardCharts monthly={monthly} categoryMatrix={categoryMatrix} categories={categories} />
    </div>
  )
}
