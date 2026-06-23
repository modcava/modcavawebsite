'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CARD_MAX_TOTAL } from '@/lib/payment'

// Facebook page for the manual credit-card payment-link flow.
const MESSENGER_URL = 'https://m.me/Modcavashop'

interface OrderInfo {
  paymentMethod: string | null
  total: number
  surcharge: number
  status: string
}

// ── ข้อมูลรับโอน — แก้ตรงนี้ ──────────────────────────────
// รูปบัญชี + QR อยู่ใน public/icon/ (เสิร์ฟที่ /icon/account.png, /icon/QR.jpg)
const ACCOUNT_IMAGE = '/icon/account.png'
const QR_IMAGE      = '/icon/QR.jpg'
const ACCOUNT_NO    = '9352236288' // เลขบัญชีสำหรับปุ่มคัดลอก (935-223628-8)
// ──────────────────────────────────────────────────────────────

export default function PaymentPage() {
  const params     = useParams()
  const router     = useRouter()
  const orderNumber = params.orderNumber as string

  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [done, setDone]       = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fetch the order so we can branch the UI by payment method.
  const [order, setOrder] = useState<OrderInfo | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(true)
  useEffect(() => {
    let alive = true
    fetch(`/api/orders/${orderNumber}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.data) setOrder(d.data) })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingOrder(false) })
    return () => { alive = false }
  }, [orderNumber])

  // Switch payment method (only while PENDING). Server recomputes total + surcharge.
  const [switching, setSwitching] = useState(false)
  async function changeMethod(method: 'PromptPay' | 'Credit Card') {
    if (switching || order?.paymentMethod === method) return
    setSwitching(true)
    try {
      const res = await fetch(`/api/orders/${orderNumber}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || 'เปลี่ยนวิธีชำระเงินไม่สำเร็จ'); return }
      setOrder((o) => (o ? { ...o, paymentMethod: d.data.paymentMethod, total: d.data.total, surcharge: d.data.surcharge } : o))
      toast.success(method === 'Credit Card' ? 'เปลี่ยนเป็นบัตรเครดิตแล้ว (+5%)' : 'เปลี่ยนเป็นโอนเงิน/PromptPay แล้ว')
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSwitching(false)
    }
  }

  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) { toast.error('รองรับเฉพาะไฟล์รูปภาพ'); return }
    if (f.size > 5 * 1024 * 1024) { toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  async function uploadSlip() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('slip', file)
      fd.append('orderNumber', orderNumber)
      const res = await fetch('/api/orders/slip', { method: 'POST', body: fd })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'อัปโหลดไม่สำเร็จ')
        return
      }
      setDone(true)
      toast.success('ส่งสลิปเรียบร้อยแล้ว!')
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setUploading(false)
    }
  }

  // ── Success state ─────────────────────────────────────────
  if (done) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 20px' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>✅</div>
          <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.5rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
            ส่งสลิปเรียบร้อยแล้ว!
          </h2>
          <p style={{ fontSize: '.85rem', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 24 }}>
            เราได้รับสลิปการโอนเงินสำหรับคำสั่งซื้อ <strong style={{ color: 'var(--sienna)', fontFamily: 'monospace' }}>{orderNumber}</strong> แล้ว<br/>
            ทีมงานจะตรวจสอบและยืนยันออเดอร์ของคุณโดยเร็ว
          </p>
          <Link href="/account/orders" style={{
            display: 'inline-block', padding: '11px 28px',
            background: 'var(--sienna)', color: '#fff',
            borderRadius: 'var(--r)', fontWeight: 700, fontSize: '.88rem',
            textDecoration: 'none',
          }}>
            ดูคำสั่งซื้อของฉัน →
          </Link>
        </div>
      </div>
    )
  }

  // Loading the order → decide which payment UI to show
  if (loadingOrder) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: '.9rem' }}>
        กำลังโหลด…
      </div>
    )
  }

  // ── Credit-card flow: DM the page for a payment link (no bank transfer) ──
  if (order?.paymentMethod === 'Credit Card') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px 80px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>ชำระเงิน</div>
        <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
          ชำระผ่านบัตรเครดิต
        </h1>
        <p style={{ fontSize: '.84rem', color: 'var(--ink-3)', marginBottom: 24 }}>
          คำสั่งซื้อ <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--sienna)' }}>{orderNumber}</span>
        </p>

        {/* Amount */}
        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '20px 22px', marginBottom: 18, textAlign: 'center' }}>
          <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginBottom: 6 }}>ยอดที่ต้องชำระ</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--sienna)' }}>
            ฿{order.total.toLocaleString()}
          </div>
          {order.surcharge > 0 && (
            <div style={{ fontSize: '.74rem', color: 'var(--ink-3)', marginTop: 4 }}>
              (รวมค่าบริการบัตรเครดิต 5% ฿{order.surcharge.toLocaleString()})
            </div>
          )}
        </div>

        {/* Steps + CTA */}
        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '20px 22px' }}>
          <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>
            💳 วิธีชำระผ่านบัตรเครดิต
          </div>
          <div style={{ fontSize: '.76rem', color: '#92610a', background: '#fff3cd', border: '1px solid #ffe08a', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 14, lineHeight: 1.5 }}>
            ⚠️ รับชำระด้วยบัตรเครดิตได้<strong>ไม่เกิน ฿{CARD_MAX_TOTAL.toLocaleString()}</strong>
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.9 }}>
            <li>กดปุ่ม <strong>&ldquo;ทักเพจรับลิงก์&rdquo;</strong> ด้านล่าง</li>
            <li>แจ้ง<strong>เลขคำสั่งซื้อ {orderNumber}</strong> กับแอดมิน</li>
            <li>แอดมินจะส่ง<strong>ลิงก์ชำระผ่านบัตรเครดิต</strong>ให้</li>
            <li>ชำระผ่านลิงก์ → ออเดอร์จะได้รับการยืนยัน</li>
          </ol>

          <a href={`${MESSENGER_URL}?ref=${encodeURIComponent(orderNumber)}`} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18, padding: '13px', background: '#0084ff', color: '#fff', borderRadius: 'var(--r)', fontSize: '.9rem', fontWeight: 700, textDecoration: 'none' }}>
            💬 ทักเพจรับลิงก์ชำระบัตร
          </a>
          <p style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.6 }}>
            * ออเดอร์จะอยู่ในสถานะ &ldquo;รอชำระเงิน&rdquo; จนกว่าจะชำระเสร็จ · เก็บเลขคำสั่งซื้อไว้แจ้งแอดมิน
          </p>
        </div>

        {/* Switch to bank transfer */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => changeMethod('PromptPay')}
            disabled={switching}
            style={{
              padding: '9px 16px', fontSize: '.8rem', fontWeight: 600,
              background: 'transparent', color: 'var(--ink-2)',
              border: '1px solid var(--divider)', borderRadius: 'var(--r)',
              cursor: switching ? 'wait' : 'pointer', opacity: switching ? .6 : 1,
            }}
          >
            🏦 เปลี่ยนเป็นโอนเงิน / PromptPay (ไม่มีค่าบริการ)
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link href="/account/orders" style={{ fontSize: '.82rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
            ← ดูคำสั่งซื้อของฉัน
          </Link>
        </div>
      </div>
    )
  }

  // Gate "switch to credit card" by the amount that would be charged (base + 5%).
  // base = current payable minus any existing surcharge (PromptPay → surcharge 0).
  const ccBase = order ? order.total - order.surcharge : 0
  const ccProjectedTotal = ccBase + Math.round(ccBase * 0.05 * 100) / 100
  const cardAllowed = ccProjectedTotal <= CARD_MAX_TOTAL

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* Header */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>ชำระเงิน</div>
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
        โอนชำระเงิน
      </h1>
      <p style={{ fontSize: '.84rem', color: 'var(--ink-3)', marginBottom: 28 }}>
        คำสั่งซื้อ{' '}
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--sienna)' }}>
          {orderNumber}
        </span>
      </p>

      {/* QR + bank account images */}
      <div style={{
        background: '#fff', border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)', padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--divider)' }}>
          🏦 ช่องทางชำระเงิน
        </div>

        {/* Account (left) + QR (right) on the same row — wraps to stacked on mobile */}
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>

          {/* Bank account card image (left) */}
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ACCOUNT_IMAGE}
              alt="บัญชีธนาคารไทยพาณิชย์ 935-223628-8 อิทธิ มงคลวัฒน์"
              style={{ width: '100%', maxWidth: 320, height: 'auto', borderRadius: 'var(--r)' }}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(ACCOUNT_NO); toast.success('คัดลอกเลขบัญชีแล้ว') }}
              style={{
                padding: '7px 16px', fontSize: '.78rem', fontWeight: 600,
                background: 'var(--sienna-bg)', color: 'var(--sienna)',
                border: '1px solid var(--sienna)', borderRadius: 'var(--r)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              📋 คัดลอกเลขบัญชี
            </button>
          </div>

          {/* PromptPay / Thai QR (right) */}
          <div style={{ flex: '0 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={QR_IMAGE}
              alt="Thai QR Payment / PromptPay — Modcava"
              style={{ width: '100%', maxWidth: 220, height: 'auto', borderRadius: 'var(--r)' }}
            />
            <div style={{ fontSize: '.78rem', color: 'var(--ink-2)', fontWeight: 600, textAlign: 'center' }}>
              📱 สแกน QR เพื่อโอน
            </div>
          </div>

        </div>

        <p style={{ fontSize: '.74rem', color: 'var(--ink-3)', marginTop: 16, lineHeight: 1.6 }}>
          * โปรดโอนเงินให้ตรงกับยอดที่แสดงในคำสั่งซื้อ และส่งสลิปด้านล่างหลังโอนเสร็จ
        </p>
      </div>

      {/* Switch to credit card */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <button
          onClick={() => changeMethod('Credit Card')}
          disabled={switching || !cardAllowed}
          style={{
            padding: '9px 16px', fontSize: '.8rem', fontWeight: 600,
            background: 'transparent', color: 'var(--ink-2)',
            border: '1px solid var(--divider)', borderRadius: 'var(--r)',
            cursor: switching ? 'wait' : (!cardAllowed ? 'not-allowed' : 'pointer'),
            opacity: (switching || !cardAllowed) ? .6 : 1,
          }}
        >
          💳 ต้องการชำระด้วยบัตรเครดิต? (+5%)
        </button>
        {!cardAllowed && (
          <p style={{ fontSize: '.72rem', color: '#92610a', marginTop: 8, lineHeight: 1.5 }}>
            ⚠️ รับชำระด้วยบัตรเครดิตได้ไม่เกิน ฿{CARD_MAX_TOTAL.toLocaleString()} (ยอดนี้เกินกำหนด)
          </p>
        )}
      </div>

      {/* Upload slip */}
      <div style={{
        background: '#fff', border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)', padding: '20px 22px',
      }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--divider)' }}>
          🧾 แนบสลิปการโอนเงิน
        </div>

        <div style={{ fontSize: '.76rem', color: '#92610a', background: '#fff3cd', border: '1px solid #ffe08a', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 14, lineHeight: 1.5 }}>
          ⏰ กรุณาแนบสลิป<strong> ภายใน 48 ชั่วโมง</strong> หลังสั่งซื้อ มิฉะนั้นออเดอร์จะถูกยกเลิกอัตโนมัติ (แต้ม/คูปองที่ใช้จะถูกคืนให้)
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--sienna)' : preview ? 'var(--sienna)' : 'var(--divider)'}`,
            borderRadius: 'var(--r)',
            background: dragging ? 'var(--sienna-bg)' : preview ? 'var(--paper-2)' : 'var(--paper-2)',
            minHeight: 180,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .18s', overflow: 'hidden',
            position: 'relative',
          }}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="slip preview"
                style={{ maxHeight: 320, maxWidth: '100%', objectFit: 'contain', borderRadius: 'var(--r)' }}
              />
              <div style={{
                position: 'absolute', bottom: 8, right: 8,
                background: 'rgba(0,0,0,.55)', color: '#fff',
                fontSize: '.7rem', padding: '4px 10px', borderRadius: 99, fontWeight: 600,
              }}>
                คลิกเพื่อเปลี่ยนรูป
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 10, opacity: .5 }}>📎</div>
              <p style={{ fontSize: '.84rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
                คลิกหรือลากไฟล์มาวางที่นี่
              </p>
              <p style={{ fontSize: '.72rem', color: 'var(--ink-3)' }}>JPG, PNG, WEBP · ไม่เกิน 5MB</p>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            onClick={uploadSlip}
            disabled={!file || uploading}
            style={{
              flex: 1, padding: '12px',
              background: file ? 'var(--sienna)' : 'var(--paper-3)',
              color: file ? '#fff' : 'var(--ink-3)',
              border: 'none', borderRadius: 'var(--r)',
              fontSize: '.88rem', fontWeight: 700,
              cursor: file ? 'pointer' : 'not-allowed',
              transition: 'all .18s', opacity: uploading ? .7 : 1,
            }}
          >
            {uploading ? 'กำลังส่ง…' : '📤 ส่งสลิป'}
          </button>
          <Link
            href="/account/orders"
            style={{
              padding: '12px 18px',
              background: 'none', color: 'var(--ink-3)',
              border: '1px solid var(--divider)', borderRadius: 'var(--r)',
              fontSize: '.84rem', fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center',
            }}
          >
            ข้ามตอนนี้
          </Link>
        </div>
        <p style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 10 }}>
          * สามารถส่งสลิปภายหลังได้ที่หน้าคำสั่งซื้อ
        </p>
      </div>
    </div>
  )
}
