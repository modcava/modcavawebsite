'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  initialName: string
  initialPhone?: string
  onSaved: (name: string) => void
}

type Tab = 'profile' | 'password'

export function ProfileEditModal({ open, onClose, initialName, initialPhone, onSaved }: Props) {
  const { update } = useSession()
  const [tab, setTab] = useState<Tab>('profile')

  // Profile form
  const [name, setName]   = useState(initialName)
  const [phone, setPhone] = useState(initialPhone ?? '')
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)

  if (!open) return null

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setProfileLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'บันทึกไม่สำเร็จ')
        return
      }
      await update({ name: name.trim() })
      onSaved(name.trim())
      toast.success('บันทึกข้อมูลสำเร็จ')
      onClose()
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setProfileLoading(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return }
    if (newPw.length < 8) { toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    setPwLoading(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
        return
      }
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ')
      onClose()
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setPwLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    border: '1.5px solid var(--divider)', borderRadius: 'var(--r)',
    fontSize: '.875rem', color: 'var(--ink)', background: '#fff',
    outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '.72rem', fontWeight: 600,
    color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '.04em',
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(42,34,24,.45)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff', borderRadius: 'var(--r-lg)',
            width: '100%', maxWidth: 440,
            boxShadow: '0 20px 60px rgba(0,0,0,.18)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px 0',
          }}>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)' }}>
              ✏️ แก้ไขบัญชี
            </h2>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                border: '1.5px solid var(--divider)', background: 'none',
                cursor: 'pointer', fontSize: '.9rem', color: 'var(--ink-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, padding: '14px 22px 0', borderBottom: '1px solid var(--divider)' }}>
            {(['profile', 'password'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '7px 16px', fontSize: '.8rem', fontWeight: 600,
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: tab === t ? 'var(--sienna)' : 'var(--ink-3)',
                  borderBottom: tab === t ? '2px solid var(--sienna)' : '2px solid transparent',
                  marginBottom: -1, transition: 'all .15s',
                }}
              >
                {t === 'profile' ? '👤 ข้อมูลส่วนตัว' : '🔒 รหัสผ่าน'}
              </button>
            ))}
          </div>

          {/* Tab: Profile */}
          {tab === 'profile' && (
            <form onSubmit={saveProfile} style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>ชื่อ-นามสกุล</label>
                <input
                  style={inputStyle} value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อเต็ม" required minLength={2}
                />
              </div>
              <div>
                <label style={labelStyle}>เบอร์โทรศัพท์ (ไม่บังคับ)</label>
                <input
                  style={inputStyle} value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812345678" maxLength={20}
                />
              </div>
              <button
                type="submit" disabled={profileLoading}
                style={{
                  width: '100%', padding: '11px', marginTop: 4,
                  background: 'var(--sienna)', color: '#fff',
                  border: 'none', borderRadius: 'var(--r)',
                  fontSize: '.875rem', fontWeight: 700, cursor: 'pointer',
                  opacity: profileLoading ? .7 : 1, transition: 'opacity .18s',
                }}
              >
                {profileLoading ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </form>
          )}

          {/* Tab: Password */}
          {tab === 'password' && (
            <form onSubmit={savePassword} style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>รหัสผ่านปัจจุบัน</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 40 }}
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="••••••••" required
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8rem', color: 'var(--ink-3)' }}>
                    {showCurrent ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    style={{ ...inputStyle, paddingRight: 40 }}
                    type={showNew ? 'text' : 'password'}
                    value={newPw} onChange={(e) => setNewPw(e.target.value)}
                    placeholder="••••••••" required minLength={8}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8rem', color: 'var(--ink-3)' }}>
                    {showNew ? '🙈' : '👁'}
                  </button>
                </div>
                {/* Password strength indicator */}
                {newPw.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                    {[1,2,3,4].map((i) => (
                      <div key={i} style={{
                        height: 3, flex: 1, borderRadius: 2,
                        background: newPw.length >= i * 3
                          ? i <= 1 ? '#e05252' : i <= 2 ? '#f0a030' : i <= 3 ? '#5ba85a' : '#2d7a42'
                          : 'var(--divider)',
                        transition: 'background .2s',
                      }} />
                    ))}
                    <span style={{ fontSize: '.65rem', color: 'var(--ink-3)', alignSelf: 'center', marginLeft: 4, whiteSpace: 'nowrap' }}>
                      {newPw.length < 4 ? 'อ่อน' : newPw.length < 8 ? 'ปานกลาง' : newPw.length < 12 ? 'ดี' : 'แข็งแกร่ง'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>ยืนยันรหัสผ่านใหม่</label>
                <input
                  style={{
                    ...inputStyle,
                    borderColor: confirmPw && confirmPw !== newPw ? '#e05252' : confirmPw && confirmPw === newPw ? '#5ba85a' : 'var(--divider)',
                  }}
                  type="password" value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••" required
                />
                {confirmPw && confirmPw !== newPw && (
                  <p style={{ fontSize: '.7rem', color: '#e05252', marginTop: 4 }}>รหัสผ่านไม่ตรงกัน</p>
                )}
              </div>
              <button
                type="submit" disabled={pwLoading || (!!confirmPw && confirmPw !== newPw)}
                style={{
                  width: '100%', padding: '11px', marginTop: 4,
                  background: 'var(--sienna)', color: '#fff',
                  border: 'none', borderRadius: 'var(--r)',
                  fontSize: '.875rem', fontWeight: 700, cursor: 'pointer',
                  opacity: pwLoading || (!!confirmPw && confirmPw !== newPw) ? .5 : 1,
                  transition: 'opacity .18s',
                }}
              >
                {pwLoading ? 'กำลังบันทึก…' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
