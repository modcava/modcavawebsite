'use client'
import { useState } from 'react'
import { toast } from 'sonner'

interface AddressData {
  savedName:     string | null
  savedPhone:    string | null
  savedAddress:  string | null
  savedDistrict: string | null
  savedProvince: string | null
  savedPostal:   string | null
}

interface Props {
  initial: AddressData
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid var(--divider)',
  borderRadius: 'var(--r)',
  background: '#fff', color: 'var(--ink)',
  fontSize: '.85rem', outline: 'none',
  transition: 'border-color .18s',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '.72rem', fontWeight: 600,
  color: 'var(--ink-3)', letterSpacing: '.06em',
  textTransform: 'uppercase', marginBottom: 5,
  display: 'block',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

export function AddressForm({ initial }: Props) {
  const [name,     setName]     = useState(initial.savedName     ?? '')
  const [phone,    setPhone]    = useState(initial.savedPhone    ?? '')
  const [address,  setAddress]  = useState(initial.savedAddress  ?? '')
  const [district, setDistrict] = useState(initial.savedDistrict ?? '')
  const [province, setProvince] = useState(initial.savedProvince ?? '')
  const [postal,   setPostal]   = useState(initial.savedPostal   ?? '')
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasAddress = !!(initial.savedName || initial.savedAddress)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/user/address', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedName:     name     || null,
          savedPhone:    phone    || null,
          savedAddress:  address  || null,
          savedDistrict: district || null,
          savedProvince: province || null,
          savedPostal:   postal   || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('บันทึกที่อยู่แล้ว')
      setExpanded(false)
    } catch {
      toast.error('บันทึกไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--divider)',
      borderRadius: 'var(--r-lg)',
      boxShadow: '0 1px 8px rgba(42,34,24,.04)',
      overflow: 'hidden',
    }}>
      {/* ── Header row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: expanded ? '1px solid var(--divider)' : 'none',
        background: 'var(--paper-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.88rem' }}>
              ที่อยู่การจัดส่ง
            </div>
            {!expanded && (
              <div style={{ fontSize: '.75rem', color: 'var(--ink-3)', marginTop: 2 }}>
                {hasAddress
                  ? `${initial.savedName ?? ''} · ${initial.savedDistrict ?? ''}, ${initial.savedProvince ?? ''} ${initial.savedPostal ?? ''}`.trim().replace(/^·\s*/, '')
                  : 'ยังไม่ได้ตั้งค่าที่อยู่'
                }
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            padding: '6px 14px', borderRadius: 'var(--r)',
            border: '1.5px solid var(--divider)',
            background: expanded ? 'var(--sienna)' : '#fff',
            color: expanded ? '#fff' : 'var(--ink-2)',
            fontSize: '.75rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all .18s',
            whiteSpace: 'nowrap',
          }}
        >
          {expanded ? 'ยกเลิก' : hasAddress ? '✏️ แก้ไข' : '+ เพิ่มที่อยู่'}
        </button>
      </div>

      {/* ── Form ── */}
      {expanded && (
        <form onSubmit={handleSave} style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            <Field label="ชื่อผู้รับ">
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

            <Field label="เบอร์โทรศัพท์">
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx" style={inputStyle}
                type="tel"
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

            <Field label="ที่อยู่ / บ้านเลขที่ / หมู่บ้าน">
              <textarea
                value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="บ้านเลขที่ ถนน หมู่บ้าน"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', gridColumn: '1/-1', lineHeight: 1.5 }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

            <Field label="เขต / อำเภอ">
              <input
                value={district} onChange={(e) => setDistrict(e.target.value)}
                placeholder="เขตหรืออำเภอ" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

            <Field label="จังหวัด">
              <input
                value={province} onChange={(e) => setProvince(e.target.value)}
                placeholder="จังหวัด" style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

            <Field label="รหัสไปรษณีย์">
              <input
                value={postal} onChange={(e) => setPostal(e.target.value)}
                placeholder="10xxx" style={inputStyle}
                maxLength={5}
                onFocus={(e) => (e.target.style.borderColor = 'var(--sienna)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--divider)')}
              />
            </Field>

          </div>

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button" onClick={() => setExpanded(false)}
              style={{
                padding: '9px 20px', borderRadius: 'var(--r)',
                border: '1.5px solid var(--divider)',
                background: '#fff', color: 'var(--ink-2)',
                fontSize: '.82rem', fontWeight: 600,
                cursor: 'pointer', transition: 'all .18s',
              }}
            >
              ยกเลิก
            </button>
            <button
              type="submit" disabled={saving}
              style={{
                padding: '9px 24px', borderRadius: 'var(--r)',
                border: 'none',
                background: saving ? 'var(--divider)' : 'var(--sienna)',
                color: '#fff',
                fontSize: '.82rem', fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background .18s',
              }}
            >
              {saving ? 'กำลังบันทึก…' : '💾 บันทึกที่อยู่'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
