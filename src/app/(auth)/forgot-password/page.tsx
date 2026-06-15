'use client'
import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'

const S = {
  label: { display: 'block', fontSize: '.72rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5, letterSpacing: '.04em' } as React.CSSProperties,
  input: { width: '100%', padding: '9px 13px', background: '#fff', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', color: 'var(--ink)', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit', transition: 'border-color .18s' } as React.CSSProperties,
}

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { toast.error('กรุณากรอกอีเมล'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'เกิดข้อผิดพลาด'); return }
      setSent(true)
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
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', marginTop: 22, marginBottom: 4 }}>ลืมรหัสผ่าน</h1>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>กรอกอีเมลที่ใช้สมัครสมาชิก เราจะส่งลิงก์รีเซ็ตให้</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', padding: '28px 28px 24px', boxShadow: '0 2px 24px rgba(42,34,24,.07)' }}>

          {sent ? (
            /* Success state */
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                ส่งอีเมลแล้ว!
              </h2>
              <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.7 }}>
                หากอีเมล <strong>{email}</strong> มีในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านภายในไม่กี่นาที<br/>
                <span style={{ fontSize: '.76rem', color: 'var(--ink-3)' }}>กรุณาตรวจสอบกล่องสแปมด้วย</span>
              </p>
              <Link href="/login" style={{ display: 'inline-block', marginTop: 20, padding: '10px 24px', background: 'var(--sienna)', color: '#fff', borderRadius: 'var(--r)', fontWeight: 700, fontSize: '.85rem', textDecoration: 'none' }}>
                กลับหน้า Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>อีเมล</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={S.input}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '11px', background: 'var(--sienna)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '.88rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .18s', opacity: loading ? .7 : 1 }}
              >
                {loading ? 'กำลังส่ง…' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--ink-3)', marginTop: 20 }}>
          <Link href="/login" style={{ color: 'var(--sienna)', fontWeight: 600, textDecoration: 'none' }}>
            ← กลับหน้า Login
          </Link>
        </p>
      </div>
    </div>
  )
}
