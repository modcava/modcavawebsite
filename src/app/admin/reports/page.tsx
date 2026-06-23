'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { REPORT_COLUMNS, type ReportType } from '@/lib/report-columns'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const GRAN: { v: 'week' | 'month' | 'year'; label: string }[] = [
  { v: 'week', label: 'รายสัปดาห์' },
  { v: 'month', label: 'รายเดือน' },
  { v: 'year', label: 'รายปี' },
]
const STATUS: { v: 'active' | 'paid' | 'all'; label: string }[] = [
  { v: 'active', label: 'ไม่นับยกเลิก' },
  { v: 'paid', label: 'จ่ายแล้ว' },
  { v: 'all', label: 'ทั้งหมด' },
]
const REPORTS: { v: ReportType; label: string; desc: string }[] = [
  { v: 'summary', label: 'สรุปรวม', desc: 'ภาพรวมต่อช่วงเวลา (1 แถว/ช่วง)' },
  { v: 'category', label: 'แยกตามหมวด', desc: 'แต่ละช่วงเวลา หมวดไหนขายดีที่สุด (1 แถว/หมวด/ช่วง)' },
  { v: 'product', label: 'แยกตามสินค้า', desc: 'แต่ละช่วงเวลา สินค้ารายตัว เรียงขายดีก่อน (1 แถว/สินค้า/ช่วง)' },
]

export default function ReportsPage() {
  const [report, setReport] = useState<ReportType>('summary')
  const [granularity, setGranularity] = useState<'week' | 'month' | 'year'>('month')
  const [status, setStatus] = useState<'active' | 'paid' | 'all'>('active')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const presets: { label: string; run: () => void }[] = [
    { label: 'เดือนนี้', run: () => { const n = new Date(); setFrom(ymd(new Date(n.getFullYear(), n.getMonth(), 1))); setTo(ymd(n)) } },
    { label: 'เดือนที่แล้ว', run: () => { const n = new Date(); setFrom(ymd(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setTo(ymd(new Date(n.getFullYear(), n.getMonth(), 0))) } },
    { label: 'ปีนี้', run: () => { const n = new Date(); setFrom(ymd(new Date(n.getFullYear(), 0, 1))); setTo(ymd(n)) } },
    { label: 'ปีที่แล้ว', run: () => { const n = new Date(); setFrom(ymd(new Date(n.getFullYear() - 1, 0, 1))); setTo(ymd(new Date(n.getFullYear() - 1, 11, 31))) } },
    { label: 'ทั้งหมด', run: () => { setFrom(''); setTo('') } },
  ]

  const download = () => {
    const p = new URLSearchParams({ report, granularity, status })
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    const a = document.createElement('a')
    a.href = `/api/admin/reports?${p.toString()}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const seg = (active: boolean) =>
    cn('font-mono text-xs px-3 py-1.5 transition-colors', active ? 'bg-amber text-white' : 'bg-white text-warm-500 hover:text-warm-200')

  return (
    <div className="p-6 max-w-screen-lg">
      <div className="eyebrow mb-2">Admin</div>
      <h1 className="font-display font-bold text-2xl text-warm-50 mb-1">Export ยอดขาย</h1>
      <p className="font-mono text-[11px] text-warm-500 mb-6">ดาวน์โหลดสรุปยอดขายรายสัปดาห์ / เดือน / ปี เป็นไฟล์ CSV (เปิดด้วย Excel ได้เลย)</p>

      <div className="card p-5 mb-6 space-y-5">
        {/* Report type */}
        <div>
          <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider mb-2">ชนิดรายงาน</div>
          <div className="inline-flex rounded-md border border-warm-600 overflow-hidden">
            {REPORTS.map((r) => (
              <button key={r.v} onClick={() => setReport(r.v)} className={seg(report === r.v)}>{r.label}</button>
            ))}
          </div>
          <p className="font-mono text-[10px] text-warm-500 mt-2">{REPORTS.find((r) => r.v === report)?.desc}</p>
        </div>

        {/* Granularity */}
        <div>
          <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider mb-2">สรุปแบบ</div>
          <div className="inline-flex rounded-md border border-warm-600 overflow-hidden">
            {GRAN.map((g) => (
              <button key={g.v} onClick={() => setGranularity(g.v)} className={seg(granularity === g.v)}>{g.label}</button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider mb-2">นับออเดอร์</div>
          <div className="inline-flex rounded-md border border-warm-600 overflow-hidden">
            {STATUS.map((s) => (
              <button key={s.v} onClick={() => setStatus(s.v)} className={seg(status === s.v)}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <div className="font-mono text-[10px] text-warm-500 uppercase tracking-wider mb-2">ช่วงวันที่</div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={p.run}
                className="font-mono text-[11px] px-2.5 py-1 rounded-md border border-warm-600 bg-white text-warm-300 hover:border-amber hover:text-amber transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="font-mono text-xs rounded-md border border-warm-600 bg-white text-warm-100 px-2 py-1.5" aria-label="จากวันที่" />
            <span className="text-warm-500 text-sm">—</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="font-mono text-xs rounded-md border border-warm-600 bg-white text-warm-100 px-2 py-1.5" aria-label="ถึงวันที่" />
            <span className="font-mono text-[10px] text-warm-500">{from || to ? `${from || 'เริ่มต้น'} → ${to || 'วันนี้'}` : 'ทั้งหมดที่มี'}</span>
          </div>
        </div>

        {/* Download */}
        <div className="pt-1">
          <button onClick={download} className="btn-amber inline-flex items-center gap-2">
            <Download size={15} /> ดาวน์โหลด CSV
          </button>
        </div>
      </div>

      {/* Column dictionary */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={16} className="text-amber" />
          <h2 className="font-semibold text-warm-100">คอลัมน์ในไฟล์</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {REPORT_COLUMNS[report].map((c) => (
            <div key={c.header} className="flex items-baseline gap-2 text-sm">
              <span className="text-warm-100 text-xs font-medium whitespace-nowrap">{c.header}</span>
              <span className="text-warm-400 text-xs">{c.desc}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-[10px] text-warm-500 mt-4 leading-relaxed">
          * แบ่งช่วงเวลาตามเขตเวลาไทย (Asia/Bangkok) · ค่าเงินเป็นเลขล้วนไม่มีสัญลักษณ์ ฿ · สัปดาห์เริ่มวันจันทร์ (มาตรฐาน ISO)
        </p>
      </div>
    </div>
  )
}
