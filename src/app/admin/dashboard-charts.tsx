'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'

type Monthly = { ym: string; year: number; month: number; orders: number; revenue: number }
type CatCell = { ym: string; categoryId: string; revenue: number; qty: number }
type Cat = { id: string; name: string; nameTh: string | null; emoji: string | null; slug: string }

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// Stable colour per category slug; unknown slugs cycle through the fallbacks.
const SLUG_COLORS: Record<string, string> = {
  'mtg-single':  '#3b82f6',
  'mtg-sealed':  '#8b5cf6',
  'rb-single':   '#f59e0b',
  'rb-sealed':   '#ec4899',
  'paint':       '#10b981',
  'model-tools': '#06b6d4',
}
const FALLBACK_COLORS = ['#ef4444', '#0ea5e9', '#a855f7', '#14b8a6', '#eab308', '#64748b']

export function DashboardCharts({ monthly, categoryMatrix, categories }: {
  monthly: Monthly[]
  categoryMatrix: CatCell[]
  categories: Cat[]
}) {
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Years that actually have data, newest first.
  const years = useMemo(() => {
    const s = new Set<number>()
    monthly.forEach((m) => s.add(m.year))
    categoryMatrix.forEach((c) => s.add(+c.ym.slice(0, 4)))
    const arr = Array.from(s).sort((a, b) => b - a)
    return arr.length ? arr : [new Date().getFullYear()]
  }, [monthly, categoryMatrix])

  // Months with data inside a given year, oldest → newest.
  const monthsForYear = (y: number) => {
    const s = new Set<number>()
    monthly.forEach((m) => { if (m.year === y) s.add(m.month) })
    categoryMatrix.forEach((c) => { if (+c.ym.slice(0, 4) === y) s.add(+c.ym.slice(5, 7)) })
    return Array.from(s).sort((a, b) => a - b)
  }

  const [year, setYear] = useState(years[0])
  const [mode, setMode] = useState<'year' | 'month'>('month')
  const [month, setMonth] = useState(() => {
    const ms = monthsForYear(years[0])
    return ms.length ? ms[ms.length - 1] : new Date().getMonth() + 1
  })

  // Switching year keeps the month valid by jumping to that year's latest.
  const changeYear = (y: number) => {
    setYear(y)
    const ms = monthsForYear(y)
    setMonth(ms.length ? ms[ms.length - 1] : 1)
  }

  // ── Category pie for the selected scope (a whole year or one month) ──
  const pie = useMemo(() => {
    const target = mode === 'year' ? String(year) : `${year}-${String(month).padStart(2, '0')}`
    const inScope = (m: string) => (mode === 'year' ? m.slice(0, 4) === target : m === target)

    const agg = new Map<string, { revenue: number; qty: number }>()
    for (const c of categoryMatrix) {
      if (!inScope(c.ym)) continue
      const cur = agg.get(c.categoryId) ?? { revenue: 0, qty: 0 }
      cur.revenue += c.revenue
      cur.qty += c.qty
      agg.set(c.categoryId, cur)
    }

    const rows = Array.from(agg.entries())
      .map(([categoryId, v]) => {
        const cat = catById.get(categoryId)
        return {
          categoryId,
          name: cat?.nameTh || cat?.name || 'ไม่ระบุหมวด',
          emoji: cat?.emoji || '📦',
          slug: cat?.slug || '',
          revenue: v.revenue,
          qty: v.qty,
        }
      })
      .filter((r) => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)

    const total = rows.reduce((s, r) => s + r.revenue, 0)
    let fb = 0
    let cum = 0
    const slices = rows.map((r) => {
      const pct = total ? (r.revenue / total) * 100 : 0
      const color = SLUG_COLORS[r.slug] ?? FALLBACK_COLORS[fb++ % FALLBACK_COLORS.length]
      const seg = { ...r, pct, color, offset: -cum }
      cum += pct
      return seg
    })
    return { slices, total, totalQty: rows.reduce((s, r) => s + r.qty, 0) }
  }, [categoryMatrix, mode, year, month, catById])

  // ── 12-month bars for the selected year ──
  const yearMonthly = useMemo(() => {
    const byMonth = new Map(monthly.filter((m) => m.year === year).map((m) => [m.month, m]))
    const rows = Array.from({ length: 12 }, (_, i) => {
      const r = byMonth.get(i + 1)
      return { month: i + 1, orders: r?.orders ?? 0, revenue: r?.revenue ?? 0 }
    })
    return {
      rows,
      maxRev: Math.max(1, ...rows.map((r) => r.revenue)),
      totalOrders: rows.reduce((s, r) => s + r.orders, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
    }
  }, [monthly, year])

  const scopeLabel = mode === 'year' ? `ทั้งปี ${year}` : `${TH_MONTHS[month - 1]} ${year}`
  const top = pie.slices[0]
  const selectCls = 'font-mono text-xs rounded-md border border-warm-600 bg-white text-warm-100 px-2 py-1.5 focus:outline-none focus:border-amber'

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-xl text-warm-50">Sales Analytics</h2>
          <p className="font-mono text-[11px] text-warm-500 mt-0.5">ยอดขายรายเดือน / รายปี · หมวดขายดี · ไม่รวมออเดอร์ที่ยกเลิก</p>
        </div>

        {/* Period controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => changeYear(+e.target.value)} className={selectCls} aria-label="เลือกปี">
            {years.map((y) => <option key={y} value={y}>ปี {y}</option>)}
          </select>

          <div className="inline-flex rounded-md border border-warm-600 overflow-hidden">
            {(['year', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'font-mono text-xs px-3 py-1.5 transition-colors',
                  mode === m ? 'bg-amber text-white' : 'bg-white text-warm-500 hover:text-warm-200',
                )}
              >
                {m === 'year' ? 'ทั้งปี' : 'รายเดือน'}
              </button>
            ))}
          </div>

          {mode === 'month' && (
            <select value={month} onChange={(e) => setMonth(+e.target.value)} className={selectCls} aria-label="เลือกเดือน">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{TH_MONTHS[m - 1]}</option>
              ))}
            </select>
          )}

          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1.5 font-mono text-xs px-3 py-1.5 rounded-md border border-warm-600 bg-white text-warm-500 hover:border-amber hover:text-amber transition-colors"
          >
            <Download size={14} /> Export CSV
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Category pie ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-100">Sales by Category <span className="font-normal text-warm-500">· ยอดขายตามหมวด</span></h3>
            <span className="font-mono text-[10px] text-warm-500">{scopeLabel}</span>
          </div>

          {pie.total === 0 ? (
            <div className="flex items-center justify-center h-44 font-mono text-xs text-warm-500">
              ยังไม่มียอดขายในช่วงนี้
            </div>
          ) : (
            <>
              {top && (
                <div className="flex items-center gap-2 mb-4 rounded-md bg-amber/10 border border-amber/20 px-3 py-2">
                  <span className="text-lg leading-none">{top.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider">🏆 ขายดีที่สุด</div>
                    <div className="text-sm text-warm-50 truncate">
                      <span className="font-semibold">{top.name}</span>
                      <span className="font-mono text-amber-dark ml-2">{formatPrice(top.revenue)}</span>
                      <span className="font-mono text-warm-500 ml-1">({top.pct.toFixed(0)}% · {top.qty.toLocaleString('th-TH')} ชิ้น)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative shrink-0">
                  <svg viewBox="0 0 42 42" className="w-44 h-44" role="img" aria-label="สัดส่วนยอดขายตามหมวดหมู่">
                    <circle cx="21" cy="21" r="15.915" fill="none" stroke="#eef2f7" strokeWidth="6" />
                    <g transform="rotate(-90 21 21)">
                      {pie.slices.map((s) => {
                        const gap = pie.slices.length > 1 ? 0.6 : 0
                        const dash = Math.max(s.pct - gap, 0.0001)
                        return (
                          <circle
                            key={s.categoryId}
                            cx="21" cy="21" r="15.915" fill="none"
                            stroke={s.color} strokeWidth="6"
                            strokeDasharray={`${dash} ${100 - dash}`}
                            strokeDashoffset={s.offset}
                          >
                            <title>{`${s.name}: ${formatPrice(s.revenue)} (${s.pct.toFixed(1)}%)`}</title>
                          </circle>
                        )
                      })}
                    </g>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="font-mono text-[9px] text-warm-500 uppercase tracking-wider">รวม</div>
                    <div className="font-mono text-sm font-bold text-warm-50">{formatPrice(pie.total)}</div>
                    <div className="font-mono text-[9px] text-warm-500">{pie.totalQty.toLocaleString('th-TH')} ชิ้น</div>
                  </div>
                </div>

                {/* Legend, sorted best-selling first */}
                <div className="flex-1 w-full space-y-2">
                  {pie.slices.map((s) => (
                    <div key={s.categoryId} className="flex items-center gap-2" title={`${s.qty.toLocaleString('th-TH')} ชิ้น`}>
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                      <span className="text-sm leading-none">{s.emoji}</span>
                      <span className="text-xs text-warm-200 flex-1 truncate">{s.name}</span>
                      <span className="font-mono text-xs font-semibold text-warm-100">{formatPrice(s.revenue)}</span>
                      <span className="font-mono text-[10px] text-warm-500 w-9 text-right">{s.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Monthly breakdown bars ── */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-warm-100">Monthly Breakdown <span className="font-normal text-warm-500">· รายเดือน {year}</span></h3>
            <div className="text-right">
              <div className="font-mono text-[10px] text-warm-500">{yearMonthly.totalOrders.toLocaleString('th-TH')} ออเดอร์</div>
              <div className="font-mono text-sm font-bold text-amber-dark">{formatPrice(yearMonthly.totalRevenue)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1.5 px-1">
            <span className="font-mono text-[9px] text-warm-500 w-8">เดือน</span>
            <span className="flex-1 font-mono text-[9px] text-warm-500">รายได้</span>
            <span className="font-mono text-[9px] text-warm-500 w-10 text-right">ออเดอร์</span>
            <span className="font-mono text-[9px] text-warm-500 w-20 text-right">บาท</span>
          </div>

          <div className="space-y-1">
            {yearMonthly.rows.map((r) => {
              const active = mode === 'month' && r.month === month
              const w = (r.revenue / yearMonthly.maxRev) * 100
              return (
                <button
                  key={r.month}
                  onClick={() => { setMode('month'); setMonth(r.month) }}
                  className={cn(
                    'flex items-center gap-2 w-full rounded px-1 py-1 text-left transition-colors hover:bg-warm-700/60',
                    active && 'bg-amber/10',
                  )}
                >
                  <span className={cn('font-mono text-[10px] w-8', active ? 'text-amber-dark font-semibold' : 'text-warm-500')}>{TH_MONTHS[r.month - 1]}</span>
                  <span className="flex-1 h-4 bg-warm-700 rounded-sm overflow-hidden">
                    <span className="block h-full rounded-sm" style={{ width: `${w}%`, background: active ? '#1d4ed8' : '#60a5fa' }} />
                  </span>
                  <span className="font-mono text-[10px] text-warm-500 w-10 text-right">{r.orders.toLocaleString('th-TH')}</span>
                  <span className="font-mono text-[11px] text-warm-100 w-20 text-right">{formatPrice(r.revenue)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
