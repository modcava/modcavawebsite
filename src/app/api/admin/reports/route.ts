import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bucketOf, thaiPeriod, type Granularity } from '@/lib/report-period'
import { REPORT_COLUMNS, type ReportType } from '@/lib/report-columns'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return null
  return session
}

// Sales export. Three shapes, all bucketed by period in Asia/Bangkok
// (@/lib/report-period). Definitions match the admin dashboard: status excludes
// CANCELLED by default, gross_sales = Σ price × qty.
//   summary  — one row per period
//   category — one row per (period × หมวด), best-selling first
//   product  — one row per (period × สินค้ารายตัว), best-selling first

const TZ = 'Asia/Bangkok'
const m2 = (n: number) => n.toFixed(2)

/** Escape a CSV cell only when it contains a comma, quote, or newline. */
function csv(v: string | number) {
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const gParam = sp.get('granularity')
  const granularity: Granularity = gParam === 'week' || gParam === 'year' ? gParam : 'month'
  const rParam = sp.get('report')
  const report: ReportType = rParam === 'category' || rParam === 'product' ? rParam : 'summary'
  const status = sp.get('status') || 'active'
  const from = sp.get('from')   // YYYY-MM-DD (inclusive, Bangkok)
  const to = sp.get('to')       // YYYY-MM-DD (inclusive, Bangkok)

  const where: Prisma.OrderWhereInput = {}
  if (status === 'paid') where.status = { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] }
  else if (status !== 'all') where.status = { not: 'CANCELLED' }

  if (from || to) {
    const f: Prisma.DateTimeFilter = {}
    if (from) f.gte = new Date(`${from}T00:00:00+07:00`)
    if (to) { const t = new Date(`${to}T00:00:00+07:00`); t.setUTCDate(t.getUTCDate() + 1); f.lt = t }
    where.createdAt = f
  }

  const [orders, categories] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true, createdAt: true, total: true, discount: true, shippingFee: true,
        surcharge: true, commissionAmount: true,
        items: {
          select: {
            quantity: true, price: true,
            product: { select: { id: true, sku: true, name: true, nameTh: true, cost: true, categoryId: true } },
          },
        },
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true, nameTh: true } }),
  ])
  const catName = new Map(categories.map((c) => [c.id, c.nameTh || c.name]))

  const cols = REPORT_COLUMNS[report]
  const lines = [cols.map((c) => csv(c.header)).join(',')]

  if (report === 'summary') {
    type Bucket = {
      key: string; start: string; end: string
      orders: number; units: number; unitsWithCost: number
      grossSales: number; discounts: number; shippingFees: number
      surcharge: number; netRevenue: number; cogs: number; commission: number
    }
    const buckets = new Map<string, Bucket>()
    for (const o of orders) {
      const b = bucketOf(o.createdAt, granularity)
      let cur = buckets.get(b.key)
      if (!cur) {
        cur = { key: b.key, start: b.start, end: b.end, orders: 0, units: 0, unitsWithCost: 0, grossSales: 0, discounts: 0, shippingFees: 0, surcharge: 0, netRevenue: 0, cogs: 0, commission: 0 }
        buckets.set(b.key, cur)
      }
      cur.orders += 1
      cur.netRevenue += Number(o.total)
      cur.discounts += Number(o.discount)
      cur.shippingFees += Number(o.shippingFee)
      cur.surcharge += Number(o.surcharge)
      cur.commission += Number(o.commissionAmount)
      for (const it of o.items) {
        cur.units += it.quantity
        cur.grossSales += Number(it.price) * it.quantity
        if (it.product.cost != null) {
          cur.unitsWithCost += it.quantity
          cur.cogs += Number(it.product.cost) * it.quantity
        }
      }
    }
    for (const r of Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key))) {
      const grossProfit = r.grossSales - r.cogs
      const margin = r.grossSales ? (grossProfit / r.grossSales) * 100 : 0
      const aov = r.orders ? r.netRevenue / r.orders : 0
      const coverage = r.units ? (r.unitsWithCost / r.units) * 100 : 0
      lines.push([
        thaiPeriod(granularity, r.key), r.start, r.end, r.orders, r.units,
        m2(r.grossSales), m2(r.discounts), m2(r.shippingFees), m2(r.surcharge), m2(r.netRevenue),
        m2(r.cogs), m2(grossProfit), margin.toFixed(1), m2(r.commission), m2(aov), coverage.toFixed(1),
      ].map(csv).join(','))
    }
  } else {
    // category / product breakdown — group by (period × item) and track each
    // period's gross total for the share-of-period column.
    type Group = {
      periodKey: string; start: string; end: string
      name: string; sku: string; categoryName: string
      orderIds: Set<string>; units: number; grossSales: number
      cogs: number; costUnits: number; unitCost: number | null
    }
    const periodGross = new Map<string, number>()
    const groups = new Map<string, Group>()
    for (const o of orders) {
      const b = bucketOf(o.createdAt, granularity)
      for (const it of o.items) {
        const line = Number(it.price) * it.quantity
        periodGross.set(b.key, (periodGross.get(b.key) ?? 0) + line)
        const groupId = report === 'category' ? it.product.categoryId : it.product.id
        const gkey = `${b.key}|${groupId}`
        let g = groups.get(gkey)
        if (!g) {
          g = {
            periodKey: b.key, start: b.start, end: b.end,
            name: report === 'category' ? (catName.get(it.product.categoryId) ?? '—') : (it.product.nameTh || it.product.name),
            sku: it.product.sku ?? '',
            categoryName: catName.get(it.product.categoryId) ?? '—',
            orderIds: new Set(), units: 0, grossSales: 0, cogs: 0, costUnits: 0,
            unitCost: it.product.cost != null ? Number(it.product.cost) : null,
          }
          groups.set(gkey, g)
        }
        g.orderIds.add(o.id)
        g.units += it.quantity
        g.grossSales += line
        if (it.product.cost != null) { g.cogs += Number(it.product.cost) * it.quantity; g.costUnits += it.quantity }
      }
    }

    // period ascending, then best-selling first within each period
    const sorted = Array.from(groups.values()).sort((a, b) =>
      a.periodKey.localeCompare(b.periodKey) || b.grossSales - a.grossSales)

    for (const g of sorted) {
      const periodTotal = periodGross.get(g.periodKey) || 0
      const share = periodTotal ? (g.grossSales / periodTotal) * 100 : 0
      const label = thaiPeriod(granularity, g.periodKey)
      if (report === 'category') {
        const grossProfit = g.grossSales - g.cogs
        const margin = g.grossSales ? (grossProfit / g.grossSales) * 100 : 0
        const coverage = g.units ? (g.costUnits / g.units) * 100 : 0
        lines.push([
          label, g.start, g.end, g.name, g.orderIds.size, g.units,
          m2(g.grossSales), m2(g.cogs), m2(grossProfit), margin.toFixed(1), share.toFixed(1), coverage.toFixed(1),
        ].map(csv).join(','))
      } else {
        const hasCost = g.unitCost != null
        const grossProfit = hasCost ? g.grossSales - g.cogs : null
        const margin = hasCost && g.grossSales ? ((grossProfit as number) / g.grossSales) * 100 : null
        lines.push([
          label, g.start, g.end, g.sku, g.name, g.categoryName, g.orderIds.size, g.units,
          m2(g.grossSales),
          hasCost ? m2(g.unitCost as number) : '',
          grossProfit != null ? m2(grossProfit) : '',
          margin != null ? margin.toFixed(1) : '',
          share.toFixed(1),
        ].map(csv).join(','))
      }
    }
  }

  // BOM so Excel renders Thai (and the UTF-8 headers) correctly.
  const body = String.fromCharCode(0xFEFF) + lines.join('\r\n') + '\r\n'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const range = from || to ? `_${from || 'start'}_${to || today}` : ''
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="mocava-${report}-${granularity}${range}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
