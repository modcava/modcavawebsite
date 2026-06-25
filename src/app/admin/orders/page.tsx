'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn, formatPrice, statusColor } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────
interface OrderDetail {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  paymentMethod?: string | null
  shippingMethod?: string | null
  trackingNumber?: string | null
  slipUrl?: string | null
  note?: string | null
  total: number | string
  discount: number | string
  shippingFee: number | string
  remainingBalance?: number | string | null
  recipientName?: string | null
  address?: string | null
  district?: string | null
  province?: string | null
  postalCode?: string | null
  phone?: string | null
  user: { id: string; name?: string | null; email: string; phone?: string | null }
  items: {
    id: string
    productName: string
    quantity: number
    price: number | string
    depositPercent?: number | null
    product?: { emoji?: string | null } | null
  }[]
}

function toN(v: number | string | null | undefined) {
  if (v == null) return 0
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0
}

// ── Order Detail Modal ────────────────────────────────────────
function OrderDetailModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [previewSlip, setPreviewSlip] = useState<string | null>(null)
  const { data, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`)
      const j = await res.json()
      return j.data as OrderDetail
    },
  })

  const o = data

  const STATUS_LABEL: Record<string, string> = {
    PENDING: 'รอดำเนินการ', CONFIRMED: 'ยืนยันแล้ว',
    SHIPPED: 'จัดส่งแล้ว', DELIVERED: 'ส่งถึงแล้ว', CANCELLED: 'ยกเลิก',
  }
  const STATUS_COLOR: Record<string, string> = {
    PENDING: '#d97706', CONFIRMED: '#2563eb', SHIPPED: '#7c3aed',
    DELIVERED: '#16a34a', CANCELLED: '#9ca3af',
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#1e2433] border border-[#2d3548] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d3548]">
          <div>
            <div className="text-[10px] text-[#8a9ab0] uppercase tracking-wider mb-0.5">คำสั่งซื้อ</div>
            <div className="font-mono text-base font-bold text-amber-400">
              {isLoading ? '...' : o?.orderNumber}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {o && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{
                background: `${STATUS_COLOR[o.status]}22`,
                color: STATUS_COLOR[o.status],
                border: `1px solid ${STATUS_COLOR[o.status]}44`,
              }}>
                {STATUS_LABEL[o.status] || o.status}
              </span>
            )}
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8a9ab0] hover:text-white hover:bg-[#2d3548] transition-colors text-lg">✕</button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[#8a9ab0] text-sm">กำลังโหลด…</div>
        ) : o ? (
          <div className="p-6 space-y-5">

            {/* Customer + Shipping */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#161b27] rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-semibold text-[#8a9ab0] uppercase tracking-wider mb-2">ข้อมูลลูกค้า</div>
                <InfoRow label="ชื่อ" value={o.user.name || '—'} />
                <InfoRow label="อีเมล" value={o.user.email} />
                <InfoRow label="เบอร์" value={o.user.phone || '—'} />
                <InfoRow label="วันที่" value={new Date(o.createdAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })} />
              </div>
              <div className="bg-[#161b27] rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-semibold text-[#8a9ab0] uppercase tracking-wider mb-2">ที่อยู่จัดส่ง</div>
                <InfoRow label="ผู้รับ" value={o.recipientName || o.user.name || '—'} />
                <InfoRow label="เบอร์" value={o.phone || '—'} />
                <InfoRow label="ที่อยู่" value={[o.address, o.district, o.province, o.postalCode].filter(Boolean).join(', ') || '—'} />
                <InfoRow label="ขนส่ง" value={o.shippingMethod || '—'} />
                {o.trackingNumber && <InfoRow label="Tracking" value={`#${o.trackingNumber}`} highlight />}
              </div>
            </div>

            {/* Payment */}
            <div className="bg-[#161b27] rounded-lg p-4">
              <div className="text-[10px] font-semibold text-[#8a9ab0] uppercase tracking-wider mb-2">การชำระเงิน</div>
              <div className="flex items-center justify-between">
                <InfoRow label="วิธีชำระ" value={o.paymentMethod || '—'} />
                {o.slipUrl && (
                  <button
                    onClick={() => setPreviewSlip(o.slipUrl!)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors font-medium"
                  >
                    🧾 ดูสลิป
                  </button>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="text-[10px] font-semibold text-[#8a9ab0] uppercase tracking-wider mb-2">รายการสินค้า</div>
              <div className="rounded-lg border border-[#2d3548] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#161b27]">
                      <th className="text-left px-4 py-2.5 text-[10px] text-[#8a9ab0] font-medium tracking-wide">สินค้า</th>
                      <th className="text-center px-3 py-2.5 text-[10px] text-[#8a9ab0] font-medium tracking-wide w-16">จำนวน</th>
                      <th className="text-right px-4 py-2.5 text-[10px] text-[#8a9ab0] font-medium tracking-wide w-24">ราคา/ชิ้น</th>
                      <th className="text-right px-4 py-2.5 text-[10px] text-[#8a9ab0] font-medium tracking-wide w-24">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3548]">
                    {o.items.map((item) => (
                      <tr key={item.id} className="hover:bg-[#1e2433]/60">
                        <td className="px-4 py-2.5 text-[#c8d4e8]">
                          {item.product?.emoji && <span className="mr-1.5">{item.product.emoji}</span>}
                          {item.productName}
                          {item.depositPercent != null && (
                            <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#3b2e6e', color: '#b09fff' }}>
                              มัดจำ {item.depositPercent}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[#8a9ab0]">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[#8a9ab0]">{formatPrice(toN(item.price))}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-300 font-semibold">{formatPrice(toN(item.price) * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5">
                <TotalRow label="ราคารวมสินค้า" value={formatPrice(o.items.reduce((s, i) => s + toN(i.price) * i.quantity, 0))} />
                {toN(o.discount) > 0 && <TotalRow label="ส่วนลด" value={`−${formatPrice(toN(o.discount))}`} dim />}
                {toN(o.shippingFee) > 0 && <TotalRow label="ค่าจัดส่ง" value={formatPrice(toN(o.shippingFee))} />}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-[#2d3548]">
                  <span className="text-sm font-semibold text-white">
                    {toN(o.remainingBalance) > 0 ? 'ยอดชำระ (มัดจำ)' : 'ยอดรวมทั้งสิ้น'}
                  </span>
                  <span className="font-mono font-bold text-amber-400 text-base">{formatPrice(toN(o.total))}</span>
                </div>
                {toN(o.remainingBalance) > 0 && (
                  <div className="flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: '#2a1e5e', border: '1px solid #4a3a9a' }}>
                    <span className="text-xs font-semibold" style={{ color: '#b09fff' }}>💜 ยอดค้างชำระ</span>
                    <span className="font-mono font-semibold text-sm" style={{ color: '#b09fff' }}>{formatPrice(toN(o.remainingBalance))}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            {o.note && (
              <div className="bg-[#161b27] rounded-lg px-4 py-3">
                <div className="text-[10px] font-semibold text-[#8a9ab0] uppercase tracking-wider mb-1">หมายเหตุ</div>
                <p className="text-xs text-[#c8d4e8]">{o.note}</p>
              </div>
            )}

          </div>
        ) : (
          <div className="p-8 text-center text-[#8a9ab0] text-sm">ไม่พบข้อมูลคำสั่งซื้อ</div>
        )}
      </div>
      {previewSlip && <SlipModal url={previewSlip} onClose={() => setPreviewSlip(null)} />}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[#8a9ab0] shrink-0 w-16">{label}</span>
      <span className={highlight ? 'text-amber-400 font-mono font-semibold' : 'text-[#c8d4e8]'}>{value}</span>
    </div>
  )
}

function TotalRow({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[#8a9ab0]">{label}</span>
      <span className={cn('font-mono', dim ? 'text-[#8a9ab0]' : 'text-[#c8d4e8]')}>{value}</span>
    </div>
  )
}

// ── Slip modal ───────────────────────────────────────────────
function SlipModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 480, width: '100%' }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -14, right: -14,
            width: 32, height: 32, borderRadius: '50%',
            background: '#fff', color: '#333',
            border: 'none', fontSize: '1rem', fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}
        >✕</button>
        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="payment slip"
          style={{ width: '100%', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
        />
        {/* Open full */}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', marginTop: 10, textAlign: 'center',
            fontSize: '.75rem', color: 'rgba(255,255,255,.6)',
            textDecoration: 'none',
          }}
        >
          เปิดในแท็บใหม่ ↗
        </a>
      </div>
    </div>
  )
}

const STATUSES = ['','PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'] as const

export default function AdminOrdersPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [tracking, setTracking]         = useState('')
  const [newStatus, setNewStatus]       = useState('')
  const [slipUrl, setSlipUrl]           = useState<string | null>(null)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('pageSize', '200')
      const res = await fetch(`/api/admin/orders?${params}`)
      return res.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (body: { id: string; status?: string; trackingNumber?: string }) => {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Update failed')
      return res.json()
    },
    onSuccess: () => { toast.success('Order updated'); qc.invalidateQueries({ queryKey: ['admin-orders'] }); setEditingId(null) },
    onError: () => toast.error('Update failed'),
  })

  const orders = data?.data ?? []

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="eyebrow mb-1">Admin</div>
      <h1 className="font-display font-bold text-2xl text-warm-50 mb-6">Orders</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={cn('px-3 py-1.5 rounded text-xs font-semibold border transition-all',
              statusFilter === s ? 'bg-amber/15 border-amber/30 text-amber-light' : 'border-warm-600 text-warm-400 hover:border-warm-500')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-warm-700/50">
              <tr>
                {['Order #','Customer','Items','Total','Payment','Shipping','Status','Actions'].map((h) => (
                  <th key={h} className="text-left font-mono text-[10px] uppercase tracking-wider text-warm-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-700">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-warm-700 rounded animate-pulse" /></td></tr>
                ))
              ) : orders.map((o: {
                id: string; orderNumber: string;
                user: { name?: string; email: string };
                items: unknown[];
                total: number;
                paymentMethod?: string;
                shippingMethod?: string;
                trackingNumber?: string;
                status: string;
                createdAt: string;
                slipUrl?: string | null;
              }) => (
                <tr key={o.id} className="hover:bg-warm-700/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">
                    <button
                      onClick={() => setDetailOrderId(o.id)}
                      className="text-amber hover:text-amber-300 hover:underline text-left transition-colors"
                    >
                      {o.orderNumber}
                    </button>
                    <div className="text-warm-600 text-[10px] mt-0.5">{new Date(o.createdAt).toLocaleDateString('th-TH')}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-warm-300">{o.user.name || o.user.email}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-400">{(o.items as unknown[]).length}</td>
                  <td className="px-4 py-3 font-mono text-sm text-amber-light font-semibold">{formatPrice(Number(o.total))}</td>
                  <td className="px-4 py-3 text-xs text-warm-400">{o.paymentMethod}</td>
                  <td className="px-4 py-3 text-xs text-warm-400">
                    <div>{o.shippingMethod}</div>
                    {o.trackingNumber && <div className="text-amber text-[10px]">#{o.trackingNumber}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${statusColor(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {/* ปุ่มดูสลิป */}
                      {o.slipUrl ? (
                        <button
                          onClick={() => setSlipUrl(o.slipUrl!)}
                          className="btn-amber text-xs py-1 px-2 flex items-center gap-1"
                        >
                          🧾 ดูสลิป
                        </button>
                      ) : (
                        <span className="text-[10px] text-warm-600 italic">ยังไม่มีสลิป</span>
                      )}

                      {/* Edit / Save */}
                      {editingId === o.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[160px]">
                          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
                            className="input py-1 text-xs">
                            {['PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED'].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <input value={tracking} onChange={(e) => setTracking(e.target.value)}
                            placeholder="Tracking #" className="input py-1 text-xs" />
                          <div className="flex gap-1">
                            <button onClick={() => updateMutation.mutate({ id: o.id, status: newStatus, trackingNumber: tracking })}
                              className="btn-amber text-xs py-1 px-2 flex-1 justify-center">Save</button>
                            <button onClick={() => setEditingId(null)} className="btn-outline text-xs py-1 px-2">✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(o.id); setNewStatus(o.status); setTracking(o.trackingNumber || '') }}
                          className="btn-outline text-xs py-1 px-2">Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {slipUrl && <SlipModal url={slipUrl} onClose={() => setSlipUrl(null)} />}
      {detailOrderId && <OrderDetailModal orderId={detailOrderId} onClose={() => setDetailOrderId(null)} />}
    </div>
  )
}
