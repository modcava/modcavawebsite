'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Calendar, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Row {
  couponId: string
  code: string
  influencerName: string | null
  influencerContact: string | null
  commissionType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null
  commissionValue: number | null
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'
  discountValue: number
  isActive: boolean
  orders: number
  sales: number
  discount: number
  commission: number
}
interface Report {
  mode: 'payable' | 'all'
  rows: Row[]
  totals: { orders: number; sales: number; discount: number; commission: number }
}

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`

function commissionLabel(r: Row): string {
  if (!r.commissionType || r.commissionValue == null) return '—'
  return r.commissionType === 'PERCENTAGE' ? `${r.commissionValue}%` : baht(r.commissionValue)
}
function discountLabel(r: Row): string {
  if (r.discountType === 'PERCENTAGE') return `${r.discountValue}%`
  if (r.discountType === 'FIXED_AMOUNT') return baht(r.discountValue)
  return 'ส่งฟรี'
}

export default function InfluencersPage() {
  const [mode, setMode] = useState<'payable' | 'all'>('payable')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const qs = useMemo(() => {
    const p = new URLSearchParams({ mode })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    return p.toString()
  }, [mode, from, to])

  const { data, isLoading, refetch, isFetching } = useQuery<Report>({
    queryKey: ['influencer-report', qs],
    queryFn: () => fetch(`/api/admin/influencers/report?${qs}`).then((r) => r.json()),
  })

  function thisMonth() {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    setFrom(fmt(first)); setTo(fmt(last))
  }

  const rows = data?.rows ?? []
  const totals = data?.totals

  return (
    <div className="p-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="font-display font-bold text-2xl text-warm-50 flex items-center gap-2">
            <Users size={22} className="text-violet-500" /> Influencers — ค่าคอมมิชชั่น
          </h1>
          <p className="text-xs text-slate-500 mt-1">สรุปยอดขายและค่าคอมที่ต้องจ่ายให้อินฟลูแต่ละโค้ด</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-600 text-xs font-medium hover:border-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">ออเดอร์ที่นับ</div>
          <div className="flex gap-1.5">
            {([['payable', 'ยืนยันแล้ว+ (ที่ต้องจ่ายจริง)'], ['all', 'ทั้งหมด (ไม่รวมยกเลิก)']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn('px-3 py-1.5 rounded text-xs font-semibold border transition-all',
                  mode === m ? 'bg-violet-500 border-violet-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-400')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">ช่วงวันที่ (ตามวันสั่งซื้อ)</div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm w-auto" />
            <span className="text-slate-400 text-xs">ถึง</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm w-auto" />
            <button onClick={thisMonth} className="inline-flex items-center gap-1 px-2.5 py-2 rounded border border-slate-200 text-slate-600 text-xs hover:border-violet-400 hover:text-violet-600 transition-colors">
              <Calendar size={12} /> เดือนนี้
            </button>
            {(from || to) && (
              <button onClick={() => { setFrom(''); setTo('') }} className="px-2.5 py-2 rounded border border-slate-200 text-slate-500 text-xs hover:border-red-300 hover:text-red-500 transition-colors">
                ล้าง
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-violet-50/70">
              {['โค้ด', 'อินฟลู', 'ติดต่อ', 'ส่วนลด', 'อัตราคอม', 'ออเดอร์', 'ยอดขาย', 'ส่วนลดรวม', 'ค่าคอมที่ต้องจ่าย'].map((h) => (
                <th key={h} className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400 text-sm">กำลังโหลด…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-400 text-sm">ยังไม่มีโค้ดอินฟลู — สร้างได้ที่หน้า Coupons (ใส่ชื่ออินฟลู + อัตราคอม)</td></tr>
            ) : rows.map((r) => (
              <tr key={r.couponId} className={cn('hover:bg-slate-50', !r.isActive && 'opacity-60')}>
                <td className="px-3 py-2"><span className="font-mono font-bold text-xs text-slate-800">{r.code}</span>{!r.isActive && <span className="ml-1.5 text-[9px] text-slate-400">(ปิด)</span>}</td>
                <td className="px-3 py-2 text-xs text-slate-700">{r.influencerName || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{r.influencerContact || '—'}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{discountLabel(r)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-violet-700">{commissionLabel(r)}</td>
                <td className="px-3 py-2 text-xs font-mono text-slate-600">{r.orders}</td>
                <td className="px-3 py-2 text-xs font-mono text-slate-600">{baht(r.sales)}</td>
                <td className="px-3 py-2 text-xs font-mono text-slate-500">{baht(r.discount)}</td>
                <td className="px-3 py-2 text-sm font-mono font-bold text-amber-700">{baht(r.commission)}</td>
              </tr>
            ))}
          </tbody>
          {totals && rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                <td className="px-3 py-3 text-xs text-slate-700" colSpan={5}>รวม ({rows.length} โค้ด)</td>
                <td className="px-3 py-3 text-xs font-mono text-slate-700">{totals.orders}</td>
                <td className="px-3 py-3 text-xs font-mono text-slate-700">{baht(totals.sales)}</td>
                <td className="px-3 py-3 text-xs font-mono text-slate-600">{baht(totals.discount)}</td>
                <td className="px-3 py-3 text-sm font-mono font-bold text-amber-800">{baht(totals.commission)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        * &ldquo;ยืนยันแล้ว+&rdquo; นับเฉพาะออเดอร์สถานะ CONFIRMED / SHIPPED / DELIVERED (ที่จ่ายเงินแล้ว) — ออเดอร์ที่ยกเลิกไม่ถูกนับ ·
        ค่าคอมคำนวณจากยอดสินค้า (subtotal) ตอนสั่งซื้อ
      </p>
    </div>
  )
}
