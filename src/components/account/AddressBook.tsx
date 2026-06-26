'use client'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ThaiAddressSelect } from '@/components/shop/ThaiAddressSelect'

// ── Types ─────────────────────────────────────────────────────
interface Address {
  id:          string
  label:       string
  name:        string
  phone:       string
  address:     string
  subdistrict: string
  district:    string
  province:    string
  postal:      string
  isDefault:   boolean
}

type FormData = Omit<Address, 'id' | 'isDefault'>

const EMPTY_FORM: FormData = {
  label: 'บ้าน', name: '', phone: '',
  address: '', subdistrict: '', district: '', province: '', postal: '',
}

const LABELS = ['บ้าน', 'ที่ทำงาน', 'อื่นๆ']

// ── Styles ────────────────────────────────────────────────────
const inputCls: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1.5px solid var(--divider)',
  borderRadius: 'var(--r)', background: '#fff',
  color: 'var(--ink)', fontSize: '.84rem',
  outline: 'none', transition: 'border-color .18s',
  boxSizing: 'border-box',
}

// ── Address Form Modal ─────────────────────────────────────────
function AddressModal({
  initial, onSave, onClose,
}: {
  initial?: Address
  onSave: (data: FormData, isDefault: boolean) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm]         = useState<FormData>(initial ?? EMPTY_FORM)
  const [isDefault, setDefault] = useState(initial?.isDefault ?? false)
  const [saving, setSaving]     = useState(false)

  function set(field: keyof FormData, val: string) {
    setForm((prev) => ({ ...prev, [field]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.address.trim() || !form.province.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setSaving(true)
    try {
      await onSave(form, isDefault)
    } finally {
      setSaving(false)
    }
  }

  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'var(--sienna)')
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    (e.target.style.borderColor = 'var(--divider)')

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(42,34,24,.45)',
          zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 'min(520px, 96vw)', maxHeight: '90vh', overflowY: 'auto',
        background: '#fff', borderRadius: 'var(--r-lg)',
        boxShadow: '0 20px 60px rgba(42,34,24,.18)',
        zIndex: 1201, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <h3 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)' }}>
            {initial ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: 'var(--ink-3)', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Label */}
            <div>
              <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7 }}>
                ป้ายชื่อที่อยู่
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {LABELS.map((l) => (
                  <button
                    key={l} type="button"
                    onClick={() => set('label', l)}
                    style={{
                      padding: '6px 14px', borderRadius: 99, fontSize: '.78rem', fontWeight: 600,
                      border: '1.5px solid',
                      borderColor: form.label === l ? 'var(--sienna)' : 'var(--divider)',
                      background: form.label === l ? 'var(--sienna-bg)' : '#fff',
                      color: form.label === l ? 'var(--sienna)' : 'var(--ink-3)',
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                  >{l}</button>
                ))}
                {!LABELS.includes(form.label) && (
                  <input value={form.label} onChange={(e) => set('label', e.target.value)}
                    style={{ ...inputCls, width: 120 }} onFocus={focus} onBlur={blur} />
                )}
              </div>
            </div>

            {/* Name + Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>ชื่อผู้รับ *</div>
                <input value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="ชื่อ-นามสกุล" required style={inputCls} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>เบอร์โทร *</div>
                <input value={form.phone} onChange={(e) => set('phone', e.target.value)}
                  placeholder="08x-xxx-xxxx" required type="tel" style={inputCls} onFocus={focus} onBlur={blur} />
              </div>
            </div>

            {/* Address */}
            <div>
              <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>ที่อยู่ *</div>
              <textarea value={form.address} onChange={(e) => set('address', e.target.value)}
                placeholder="บ้านเลขที่ ถนน ซอย หมู่บ้าน"
                required rows={2}
                style={{ ...inputCls, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={focus} onBlur={blur} />
            </div>

            {/* จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ (เติมอัตโนมัติ) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ThaiAddressSelect
                value={{ province: form.province, district: form.district, subdistrict: form.subdistrict ?? '', postalCode: form.postal }}
                onChange={(v) => setForm((prev) => ({ ...prev, province: v.province, district: v.district, subdistrict: v.subdistrict, postal: v.postalCode }))}
                inputStyle={inputCls}
                labelStyle={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}
              />
            </div>

            {/* isDefault toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '10px 12px', background: 'var(--paper-2)', borderRadius: 'var(--r)', border: '1px solid var(--divider)' }}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setDefault(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--sienna)', cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: '.83rem', fontWeight: 600, color: 'var(--ink)' }}>ตั้งเป็นที่อยู่หลัก</div>
                <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 1 }}>จะถูกเลือกอัตโนมัติตอนชำระเงิน</div>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
            <button type="button" onClick={onClose} style={{
              padding: '9px 20px', borderRadius: 'var(--r)',
              border: '1.5px solid var(--divider)', background: '#fff',
              color: 'var(--ink-2)', fontSize: '.82rem', fontWeight: 600, cursor: 'pointer',
            }}>ยกเลิก</button>
            <button type="submit" disabled={saving} style={{
              padding: '9px 26px', borderRadius: 'var(--r)', border: 'none',
              background: saving ? 'var(--divider)' : 'var(--sienna)',
              color: '#fff', fontSize: '.82rem', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', transition: 'background .18s',
            }}>
              {saving ? 'กำลังบันทึก…' : initial ? '💾 บันทึกการแก้ไข' : '+ เพิ่มที่อยู่'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

// ── Address Card ──────────────────────────────────────────────
function AddressCard({
  addr, onEdit, onDelete, onSetDefault,
}: {
  addr: Address
  onEdit: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${addr.isDefault ? 'var(--sienna)' : 'var(--divider)'}`,
      borderRadius: 'var(--r-lg)', padding: '16px 18px',
      position: 'relative',
      transition: 'border-color .18s',
    }}>
      {/* Label + Default badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          padding: '2px 10px', borderRadius: 99, fontSize: '.7rem', fontWeight: 700,
          background: 'var(--paper-2)', color: 'var(--ink-2)',
          border: '1px solid var(--divider)',
        }}>
          {addr.label}
        </span>
        {addr.isDefault && (
          <span style={{
            padding: '2px 8px', borderRadius: 99, fontSize: '.65rem', fontWeight: 700,
            background: 'var(--sienna-bg)', color: 'var(--sienna)',
            border: '1px solid var(--sienna)',
          }}>
            ⭐ ค่าเริ่มต้น
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>
        {addr.name}
      </div>
      <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', lineHeight: 1.6 }}>
        📞 {addr.phone}<br />
        📍 {addr.address}<br />
        {addr.subdistrict && `${addr.subdistrict}, `}{addr.district && `${addr.district}, `}{addr.province} {addr.postal}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {!addr.isDefault && (
          <button onClick={onSetDefault} style={{
            padding: '5px 12px', borderRadius: 'var(--r)',
            border: '1.5px solid var(--sienna)', background: 'var(--sienna-bg)',
            color: 'var(--sienna)', fontSize: '.72rem', fontWeight: 600,
            cursor: 'pointer', transition: 'all .15s',
          }}>
            ⭐ ตั้งเป็นหลัก
          </button>
        )}
        <button onClick={onEdit} style={{
          padding: '5px 12px', borderRadius: 'var(--r)',
          border: '1.5px solid var(--divider)', background: '#fff',
          color: 'var(--ink-2)', fontSize: '.72rem', fontWeight: 600,
          cursor: 'pointer', transition: 'all .15s',
        }}>
          ✏️ แก้ไข
        </button>
        <button onClick={onDelete} style={{
          padding: '5px 12px', borderRadius: 'var(--r)',
          border: '1.5px solid var(--divider)', background: '#fff',
          color: '#e53e3e', fontSize: '.72rem', fontWeight: 600,
          cursor: 'pointer', transition: 'all .15s', marginLeft: 'auto',
        }}>
          🗑 ลบ
        </button>
      </div>
    </div>
  )
}

// ── Main AddressBook Component ────────────────────────────────
export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<'add' | Address | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/addresses')
      const json = await res.json()
      setAddresses(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Create ──
  async function handleCreate(form: FormData, isDefault: boolean) {
    const res = await fetch('/api/user/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, isDefault }),
    })
    if (!res.ok) { toast.error('เพิ่มที่อยู่ไม่สำเร็จ'); return }
    toast.success('เพิ่มที่อยู่แล้ว')
    setModal(null)
    load()
  }

  // ── Update ──
  async function handleUpdate(id: string, form: FormData, isDefault: boolean) {
    const res = await fetch(`/api/user/addresses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, isDefault }),
    })
    if (!res.ok) { toast.error('แก้ไขไม่สำเร็จ'); return }
    toast.success('บันทึกการแก้ไขแล้ว')
    setModal(null)
    load()
  }

  // ── Delete ──
  async function handleDelete(addr: Address) {
    if (!confirm(`ลบที่อยู่ "${addr.label}" ของ ${addr.name}?`)) return
    const res = await fetch(`/api/user/addresses/${addr.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('ลบไม่สำเร็จ'); return }
    toast.success('ลบที่อยู่แล้ว')
    load()
  }

  // ── Set Default ──
  async function handleSetDefault(id: string) {
    const res = await fetch(`/api/user/addresses/${id}`, { method: 'PATCH' })
    if (!res.ok) { toast.error('เกิดข้อผิดพลาด'); return }
    toast.success('ตั้งเป็นที่อยู่หลักแล้ว')
    load()
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--divider)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden',
      boxShadow: '0 1px 8px rgba(42,34,24,.04)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: addresses.length > 0 ? '1px solid var(--divider)' : 'none',
        background: 'var(--paper-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>📍</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.88rem' }}>
              ที่อยู่การจัดส่ง
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginTop: 1 }}>
              {loading ? 'กำลังโหลด…' : `${addresses.length} ที่อยู่`}
            </div>
          </div>
        </div>
        <button
          onClick={() => setModal('add')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 'var(--r)',
            border: '1.5px solid var(--sienna)',
            background: 'var(--sienna)', color: '#fff',
            fontSize: '.75rem', fontWeight: 700,
            cursor: 'pointer', transition: 'opacity .18s',
            whiteSpace: 'nowrap',
          }}
        >
          + เพิ่มที่อยู่
        </button>
      </div>

      {/* Address list */}
      {!loading && addresses.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--ink-3)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8, opacity: .35 }}>📭</div>
          <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
            ยังไม่มีที่อยู่บันทึกไว้
          </div>
          <div style={{ fontSize: '.78rem' }}>กดปุ่ม "+ เพิ่มที่อยู่" เพื่อเพิ่มที่อยู่การจัดส่ง</div>
        </div>
      ) : (
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ height: 160, background: 'var(--paper-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--divider)', animation: 'pulse 1.5s infinite' }} />
              ))
            : addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  addr={addr}
                  onEdit={() => setModal(addr)}
                  onDelete={() => handleDelete(addr)}
                  onSetDefault={() => handleSetDefault(addr.id)}
                />
              ))
          }
        </div>
      )}

      {/* Modal */}
      {modal === 'add' && (
        <AddressModal
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'add' && (
        <AddressModal
          initial={modal as Address}
          onSave={(form, isDefault) => handleUpdate((modal as Address).id, form, isDefault)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
