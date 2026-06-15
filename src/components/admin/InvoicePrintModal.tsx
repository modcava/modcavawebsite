'use client'
import React, { useRef } from 'react'
import { X, Printer } from 'lucide-react'

type Numeric = number | string | { toNumber(): number }

interface InvoiceOrder {
  orderNumber: string
  createdAt:   string
  total:       Numeric
  discount:    Numeric
  shippingFee: Numeric
  paymentMethod?: string | null
  shippingMethod?: string | null
  trackingNumber?: string | null
  recipientName?: string | null
  address?:    string | null
  district?:   string | null
  province?:   string | null
  postalCode?: string | null
  phone?:      string | null
  note?:       string | null
  user: { name?: string | null; email: string; phone?: string | null }
  items: {
    id: string
    productName: string
    quantity: number
    price: Numeric
    product?: { emoji?: string | null; imageUrl?: string | null } | null
  }[]
}

interface Invoice {
  id:            string
  invoiceNumber: string
  status:        string
  issuedAt:      string
  note?:         string | null
  slipUrl?:      string | null
  order:         InvoiceOrder
}

interface Props {
  invoice: Invoice
  onClose: () => void
}

function toN(v: Numeric | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v) || 0
  return v.toNumber()
}

function fmt(n: number) {
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function InvoicePrintModal({ invoice, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const { order } = invoice

  const subtotal  = order.items.reduce((s, i) => s + toN(i.price) * i.quantity, 0)
  const discount  = toN(order.discount)
  const shipping  = toN(order.shippingFee)
  const total     = toN(order.total)

  const statusMap: Record<string, { label: string; color: string }> = {
    ISSUED:    { label: 'ออกใบแจ้งหนี้',  color: '#2563eb' },
    PAID:      { label: 'ชำระแล้ว',        color: '#16a34a' },
    CANCELLED: { label: 'ยกเลิก',           color: '#dc2626' },
  }
  const statusInfo = statusMap[invoice.status] ?? { label: invoice.status, color: '#6b7280' }

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=794,height=1123')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
        @page { size: A4; margin: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const issuedDate = new Date(invoice.issuedAt).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const orderDate = new Date(order.createdAt).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-auto flex flex-col">

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-800">{invoice.invoiceNumber}</span>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{ background: `${statusInfo.color}18`, color: statusInfo.color }}
            >
              {statusInfo.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Printer size={13} /> พิมพ์ / บันทึก PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Invoice body (printed) ── */}
        <div ref={printRef} style={{ padding: '48px 56px', background: '#fff', minHeight: 900 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            {/* Store branding */}
            <div>
              <div style={{ fontFamily: "'Georgia', serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', color: '#1e293b' }}>
                MODCAVA
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.7 }}>
                TCG &amp; Hobby Store<br />
                LINE: @modcava · Facebook: Modcava Store
              </div>
            </div>
            {/* Invoice meta */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                ใบแจ้งหนี้
              </div>
              <table style={{ fontSize: 12, color: '#475569', marginLeft: 'auto', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 16, paddingBottom: 4, color: '#94a3b8' }}>เลขที่</td>
                    <td style={{ fontWeight: 700, color: '#1e293b', paddingBottom: 4 }}>{invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 16, paddingBottom: 4, color: '#94a3b8' }}>ออกวันที่</td>
                    <td style={{ paddingBottom: 4 }}>{issuedDate}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 16, paddingBottom: 4, color: '#94a3b8' }}>เลขออเดอร์</td>
                    <td style={{ fontFamily: 'monospace', paddingBottom: 4 }}>{order.orderNumber}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 16, color: '#94a3b8' }}>วันที่สั่งซื้อ</td>
                    <td>{orderDate}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '2px solid #1e40af', marginBottom: 28 }} />

          {/* Bill To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>
                เรียกเก็บเงินจาก / Bill To
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                {order.recipientName || order.user.name || order.user.email}
              </div>
              {order.phone && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>📞 {order.phone}</div>
              )}
              {order.user.email && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>✉️ {order.user.email}</div>
              )}
              {order.address && (
                <div style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
                  {order.address}
                  {order.district && `, ${order.district}`}
                  {order.province && `, ${order.province}`}
                  {order.postalCode && ` ${order.postalCode}`}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 10 }}>
                ข้อมูลการจัดส่ง
              </div>
              {order.shippingMethod && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>ขนส่ง: </span>{order.shippingMethod}
                </div>
              )}
              {order.trackingNumber && (
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Tracking: </span>
                  <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{order.trackingNumber}</span>
                </div>
              )}
              {order.paymentMethod && (
                <div style={{ fontSize: 12, color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>ชำระผ่าน: </span>{order.paymentMethod}
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
            <thead>
              <tr style={{ background: '#1e40af' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', borderRadius: '4px 0 0 4px' }}>#</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>รายการสินค้า</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>จำนวน</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em' }}>ราคา/หน่วย</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', borderRadius: '0 4px 4px 0' }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#f8fafc' : '#fff', borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#94a3b8' }}>{idx + 1}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.product?.emoji && (
                        <span style={{ fontSize: 16 }}>{item.product.emoji}</span>
                      )}
                      <span style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{item.productName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: '#475569' }}>{item.quantity}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#475569' }}>
                    {fmt(toN(item.price))}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                    {fmt(toN(item.price) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ fontSize: 13, borderCollapse: 'collapse', minWidth: 260 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '5px 20px 5px 0', color: '#64748b' }}>ราคารวมสินค้า</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontFamily: 'monospace', color: '#1e293b' }}>{fmt(subtotal)}</td>
                </tr>
                {discount > 0 && (
                  <tr>
                    <td style={{ padding: '5px 20px 5px 0', color: '#64748b' }}>ส่วนลด</td>
                    <td style={{ padding: '5px 0', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>−{fmt(discount)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '5px 20px 5px 0', color: '#64748b' }}>ค่าจัดส่ง</td>
                  <td style={{ padding: '5px 0', textAlign: 'right', fontFamily: 'monospace', color: '#1e293b' }}>
                    {shipping === 0 ? <span style={{ color: '#16a34a' }}>ฟรี</span> : fmt(shipping)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ borderTop: '2px solid #1e40af', paddingTop: 10, paddingBottom: 0 }} />
                </tr>
                <tr>
                  <td style={{ paddingRight: 20, fontWeight: 700, fontSize: 15, color: '#1e293b' }}>ยอดรวมทั้งหมด</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: '#1e40af' }}>{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Status badge */}
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'inline-block',
              padding: '6px 20px',
              borderRadius: 6,
              border: `2px solid ${statusInfo.color}`,
              color: statusInfo.color,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.08em',
            }}>
              {statusInfo.label.toUpperCase()}
            </div>
            {invoice.note && (
              <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                หมายเหตุ: {invoice.note}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 48, borderTop: '1px solid #e2e8f0', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              ขอบคุณที่ใช้บริการ MODCAVA 🎮
            </div>
            <div style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace' }}>
              {invoice.invoiceNumber} · พิมพ์โดยระบบ MODCAVA Admin
            </div>
          </div>
        </div>
        {/* end printRef */}

        {/* ── สลิปโอนเงิน (screen only — ไม่พิมพ์) ── */}
        {invoice.slipUrl && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              สลิปโอนเงิน <span style={{ fontWeight: 400, color: '#94a3b8' }}>(ไม่แสดงในเอกสารพิมพ์)</span>
            </div>
            <SlipPreview url={invoice.slipUrl} />
          </div>
        )}

      </div>
    </div>
  )
}

function SlipPreview({ url }: { url: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#475569', fontWeight: 500 }}>
        🧾 ดูสลิป
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 480, width: '100%' }}>
            <button onClick={() => setOpen(false)}
              style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%', background: '#fff', color: '#333', border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="payment slip" style={{ width: '100%', borderRadius: 12, display: 'block', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} />
          </div>
        </div>
      )}
    </>
  )
}
