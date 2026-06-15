'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

// ── ข้อมูลบัญชีธนาคาร — แก้ตรงนี้ ──────────────────────────
const BANK_ACCOUNTS = [
  {
    bank:    'กสิกรไทย (KBank)',
    logo:    '🟩',
    account: '123-4-56789-0',
    name:    'บริษัท โมคาวา จำกัด',
  },
  {
    bank:    'ไทยพาณิชย์ (SCB)',
    logo:    '🟪',
    account: '123-456789-0',
    name:    'บริษัท โมคาวา จำกัด',
  },
]
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

      {/* Bank accounts */}
      <div style={{
        background: '#fff', border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)', padding: '20px 22px', marginBottom: 20,
      }}>
        <div style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--divider)' }}>
          🏦 บัญชีรับโอนเงิน
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {BANK_ACCOUNTS.map((acc, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              background: 'var(--paper-2)', borderRadius: 'var(--r)',
              padding: '14px 16px',
            }}>
              <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{acc.logo}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--ink-3)', marginBottom: 2 }}>{acc.bank}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: '.06em' }}>
                  {acc.account}
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--ink-2)', marginTop: 2 }}>{acc.name}</div>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(acc.account.replace(/-/g, '')); toast.success('คัดลอกเลขบัญชีแล้ว') }}
                style={{
                  padding: '6px 12px', fontSize: '.72rem', fontWeight: 600,
                  background: 'var(--sienna-bg)', color: 'var(--sienna)',
                  border: '1px solid var(--sienna)', borderRadius: 'var(--r)',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                คัดลอก
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize: '.74rem', color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.6 }}>
          * โปรดโอนเงินให้ตรงกับยอดที่แสดงในคำสั่งซื้อ และส่งสลิปด้านล่างหลังโอนเสร็จ
        </p>
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
