'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Eye, Trash2, Search, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InvoicePrintModal } from '@/components/admin/InvoicePrintModal'

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'

interface Invoice {
  id:            string
  invoiceNumber: string
  status:        InvoiceStatus
  issuedAt:      string
  note?:         string | null
  slipUrl?:      string | null
  order: {
    id:            string
    orderNumber:   string
    total:         number
    discount:      number
    shippingFee:   number
    createdAt:     string
    paymentMethod?: string | null
    shippingMethod?: string | null
    trackingNumber?: string | null
    recipientName?: string | null
    address?:      string | null
    district?:     string | null
    province?:     string | null
    postalCode?:   string | null
    phone?:        string | null
    note?:         string | null
    user: { id: string; name?: string | null; email: string; phone?: string | null }
    items: {
      id: string
      productName: string
      quantity: number
      price: number
      product?: { emoji?: string | null; imageUrl?: string | null } | null
    }[]
  }
}

const STATUS_TABS = [
  { key: '',           label: 'ทั้งหมด' },
  { key: 'DRAFT',      label: 'ร่าง' },
  { key: 'ISSUED',     label: 'ออกใบแจ้งหนี้' },
  { key: 'PAID',       label: 'ชำระแล้ว' },
  { key: 'CANCELLED',  label: 'ยกเลิก' },
]

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT:     { bg: '#f8fafc', text: '#64748b', label: 'ร่าง' },
  ISSUED:    { bg: '#eff6ff', text: '#2563eb', label: 'ออกใบแจ้งหนี้' },
  PAID:      { bg: '#f0fdf4', text: '#16a34a', label: 'ชำระแล้ว' },
  CANCELLED: { bg: '#fef2f2', text: '#dc2626', label: 'ยกเลิก' },
}

function fmt(n: number | null | undefined) {
  if (n == null) return '฿0'
  return `฿${Number(n).toLocaleString('th-TH')}`
}

export default function AdminInvoicesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search,  setSearch]  = useState('')
  const [draft,   setDraft]   = useState('')
  const [viewing, setViewing] = useState<Invoice | null>(null)

  const { data, isLoading } = useQuery<{ data: Invoice[]; total: number }>({
    queryKey: ['admin-invoices', statusFilter, search],
    queryFn: () => {
      const p = new URLSearchParams()
      if (statusFilter) p.set('status', statusFilter)
      if (search) p.set('search', search)
      p.set('pageSize', '100')
      return fetch(`/api/admin/invoices?${p}`).then((r) => r.json())
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-invoices'] }); toast.success('อัปเดตสถานะแล้ว') },
    onError: () => toast.error('อัปเดตไม่สำเร็จ'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/invoices/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-invoices'] }); toast.success('ลบแล้ว') },
    onError: () => toast.error('ลบไม่สำเร็จ'),
  })

  const invoices = data?.data ?? []
  const total    = data?.total ?? 0

  return (
    <div className="p-6 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="font-display font-bold text-2xl text-warm-50 flex items-center gap-2">
            <FileText size={22} className="text-blue-600" /> Invoices
          </h1>
        </div>
        <button
          onClick={() => router.push('/admin/invoices/new')}
          className="btn-amber gap-2"
        >
          <Plus size={15} /> สร้าง Invoice
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_TABS.map((t) => {
          const active = statusFilter === t.key
          return (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-semibold border transition-all',
                active
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600',
              )}>
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-5 max-w-sm">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(draft.trim()) }}
            placeholder="ค้นหา Invoice / ออเดอร์ / ลูกค้า…"
            className="input pl-8 text-sm w-full"
          />
        </div>
        <button onClick={() => setSearch(draft.trim())} className="btn-amber text-xs px-3 py-2">ค้นหา</button>
        {search && <button onClick={() => { setDraft(''); setSearch('') }} className="text-slate-500 text-xs self-center">ล้าง</button>}
      </div>

      {/* Summary stat */}
      <div className="text-xs text-slate-500 font-mono mb-3">
        ทั้งหมด <span className="text-slate-700 font-semibold">{total}</span> รายการ
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50/70">
              {['Invoice #','Order #','ลูกค้า','ยอดรวม','สถานะ','วันที่ออก','จัดการ'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3">
                  <div className="h-4 bg-slate-100 rounded animate-pulse" />
                </td></tr>
              ))
            ) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-14 text-center text-slate-400 text-sm">
                ยังไม่มี Invoice — กด <strong>สร้าง Invoice</strong> เพื่อเริ่มต้น
              </td></tr>
            ) : invoices.map((inv) => {
              const st = STATUS_STYLE[inv.status]
              const date = new Date(inv.issuedAt).toLocaleDateString('th-TH', {
                day: 'numeric', month: 'short', year: '2-digit',
              })
              return (
                <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                  {/* Invoice # */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewing(inv)}
                      className="font-mono text-xs font-bold text-blue-700 hover:text-blue-500 hover:underline transition-colors"
                    >
                      {inv.invoiceNumber}
                    </button>
                  </td>
                  {/* Order # */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-600">{inv.order.orderNumber}</span>
                  </td>
                  {/* Customer */}
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-700">{inv.order.user.name || '—'}</div>
                    <div className="text-[10px] text-slate-400">{inv.order.user.email}</div>
                  </td>
                  {/* Total */}
                  <td className="px-4 py-3 font-mono text-sm text-blue-600 font-semibold">
                    {fmt(inv.order.total)}
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <select
                      value={inv.status}
                      onChange={(e) => statusMutation.mutate({ id: inv.id, status: e.target.value })}
                      className="text-[11px] font-semibold px-2 py-1 rounded border-0 outline-none cursor-pointer"
                      style={{ background: st.bg, color: st.text }}
                    >
                                      <option value="DRAFT">ร่าง</option>
                      <option value="ISSUED">ออกใบแจ้งหนี้</option>
                      <option value="PAID">ชำระแล้ว</option>
                      <option value="CANCELLED">ยกเลิก</option>
                    </select>
                  </td>
                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-slate-500">{date}</td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setViewing(inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Eye size={12} /> ดู/พิมพ์
                      </button>
                      <button
                        onClick={() => router.push(`/admin/invoices/${inv.id}/edit`)}
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="แก้ไข"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => { if (confirm(`ลบ ${inv.invoiceNumber}?`)) deleteMutation.mutate(inv.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Print modal */}
      {viewing && (
        <InvoicePrintModal invoice={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  )
}
