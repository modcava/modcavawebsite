'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'

const S = {
  label: { display: 'block', fontSize: '.72rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '.04em' } as React.CSSProperties,
  input: { width: '100%', padding: '9px 13px', background: '#fff', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', color: 'var(--ink)', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .18s' } as React.CSSProperties,
  error: { fontSize: '.7rem', color: '#c0392b', marginTop: 4 } as React.CSSProperties,
}

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get('token') ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState(false)

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-2)', marginBottom: 16 }}>ลิงก์ไม่ถูกต้อง</p>
          <Link href="/forgot-password" style={{ color: 'var(--sienna)', fontWeight: 600 }}>ขอลิงก์ใหม่</Link>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (password !== confirm) { toast.error('รหัสผ่านไม่ตรงกัน'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'เกิดข้อผิดพลาด'); return }
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--paper) 60%, var(--paper-3) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 54, height: 54, borderRadius: 'var(--r-lg)', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(42,34,24,.18)' }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                <path d="M18 4L30 11L30 25L18 32L6 25L6 11Z" stroke="#faf7f2" strokeWidth="1.5"/>
                <circle cx="18" cy="18" r="3" fill="#faf7f2"/>
              </svg>
            </div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: '1.5rem', fontWeight: 600, letterSpacing: '.05em', color: 'var(--ink)', lineHeight: 1 }}>Modcava</div>
          </Link>
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', marginTop: 22, marginBottom: 4 }}>ตั้งรหัสผ่านใหม่</h1>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>กรอกรหัสผ่านใหม่ที่ต้องการ</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', boxShadow: '0 2px 24px rgba(42,34,24,.07)' }}>

          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>เปลี่ยนรหัสผ่านสำเร็จ!</h2>
              <p style={{ fontSize: '.84rem', color: 'var(--ink-2)' }}>กำลังพาไปหน้า Login…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  style={S.input}
                  autoComplete="new-password"
                  autoFocus
                />
                {password.length > 0 && password.length < 8 && (
                  <p style={S.error}>รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร</p>
                )}
              </div>
              <div>
                <label style={S.label}>ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  style={S.input}
                  autoComplete="new-password"
                />
                {confirm.length > 0 && password !== confirm && (
                  <p style={S.error}>รหัสผ่านไม่ตรงกัน</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '11px', background: 'var(--sienna)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '.88rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .18s', opacity: loading ? .7 : 1 }}
              >
                {loading ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
