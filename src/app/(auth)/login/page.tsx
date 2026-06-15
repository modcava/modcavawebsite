'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  email:         z.string().email('อีเมลไม่ถูกต้อง'),
  password:      z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  twoFactorCode: z.string().optional(),
})
type Form = z.infer<typeof schema>

// ── Shared styles ─────────────────────────────────────────────
const S = {
  label: {
    display: 'block',
    fontSize: '.72rem',
    fontWeight: 600,
    color: 'var(--ink-2)',
    marginBottom: 5,
    letterSpacing: '.04em',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '9px 13px',
    background: '#fff',
    border: '1.5px solid var(--divider)',
    borderRadius: 'var(--r)',
    color: 'var(--ink)',
    fontSize: '.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    transition: 'border-color .18s',
  } as React.CSSProperties,
  error: {
    fontSize: '.7rem',
    color: '#c0392b',
    marginTop: 4,
  } as React.CSSProperties,
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const errorParam  = searchParams.get('error')

  const [loading,        setLoading]        = useState(false)
  const [needs2FA,       setNeeds2FA]       = useState(false)   // step-up: password ผ่านแล้ว ขอรหัส 2FA
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null) // แสดงปุ่ม resend
  const [resending,       setResending]       = useState(false)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: Form) {
    setLoading(true)
    const res = await signIn('credentials', { ...data, redirect: false })
    if (res?.error) {
      setLoading(false)
      // NextAuth surfaces our thrown error messages via res.error
      // Some errors carry payload after colon — e.g. "AccountLocked:14"
      const [code, payload] = res.error.split(':')
      if (code === 'TwoFactorRequired') {
        setNeeds2FA(true)
        toast.info('บัญชีนี้ใช้ 2FA — กรุณากรอกรหัส 6 หลักจาก authenticator app')
      } else if (code === 'InvalidTwoFactorCode') {
        setNeeds2FA(true)
        toast.error('รหัส 2FA ไม่ถูกต้อง กรุณาลองใหม่')
      } else if (code === 'EmailNotVerified') {
        setUnverifiedEmail(data.email)
        toast.error('กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ')
      } else if (code === 'AccountLocked') {
        const minutes = payload || '15'
        toast.error(`บัญชีถูกล็อกชั่วคราว เนื่องจากกรอกรหัสผิดบ่อยเกินไป กรุณารอ ${minutes} นาที`)
      } else {
        toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      }
    } else {
      // ใช้ full page reload แทน router.push เพื่อให้ session cookie + cart hydrate พร้อมกัน
      window.location.href = callbackUrl
    }
  }

  async function handleResendVerification() {
    const email = unverifiedEmail ?? getValues('email')
    if (!email) return toast.error('กรุณากรอกอีเมล')
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      // ตอบ ok เสมอเพื่อกัน email enumeration — แสดงข้อความเดียวกันให้ user
      if (res.ok) {
        toast.success('ส่งลิงก์ยืนยันอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย')
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || 'ส่งอีเมลไม่สำเร็จ')
      }
    } finally {
      setResending(false)
    }
  }

  const busy = loading

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--paper) 60%, var(--paper-3) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* ── Logo ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 54, height: 54,
              borderRadius: 'var(--r-lg)',
              background: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(42,34,24,.18)',
            }}>
              <svg width="26" height="26" viewBox="0 0 36 36" fill="none">
                <path d="M18 4L30 11L30 25L18 32L6 25L6 11Z" stroke="#faf7f2" strokeWidth="1.5"/>
                <circle cx="18" cy="18" r="3" fill="#faf7f2"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: '1.5rem', fontWeight: 600, letterSpacing: '.05em', color: 'var(--ink)', lineHeight: 1 }}>
                Modcava
              </div>
              <div style={{ fontSize: '.58rem', letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--sienna)', marginTop: 3 }}>
                TCG · Hobby
              </div>
            </div>
          </Link>

          <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', marginTop: 22, marginBottom: 4 }}>
            ยินดีต้อนรับกลับ
          </h1>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>
            เข้าสู่ระบบเพื่อดูออเดอร์และสั่งซื้อสินค้า
          </p>
        </div>

        {/* ── Card ── */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--divider)',
          borderRadius: 'var(--r-lg)',
          padding: '28px 28px 24px',
          boxShadow: '0 2px 24px rgba(42,34,24,.07)',
        }}>

          {/* Error banner */}
          {errorParam === 'forbidden' && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fca5a5',
              borderRadius: 'var(--r)', padding: '10px 14px',
              fontSize: '.8rem', color: '#b91c1c',
              textAlign: 'center', marginBottom: 20,
            }}>
              คุณไม่มีสิทธิ์เข้าถึงหน้านั้น
            </div>
          )}
          {errorParam === 'OAuthAccountNotLinked' && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fcd34d',
              borderRadius: 'var(--r)', padding: '10px 14px',
              fontSize: '.8rem', color: '#92400e',
              textAlign: 'center', marginBottom: 20,
            }}>
              อีเมลนี้ถูกใช้ด้วยวิธีอื่นอยู่แล้ว กรุณา login ด้วยรหัสผ่านแทน
            </div>
          )}

          {/* Unverified email — show resend button */}
          {unverifiedEmail && (
            <div style={{
              background: '#fff7ed', border: '1px solid #fdba74',
              borderRadius: 'var(--r)', padding: '12px 14px',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: '.82rem', color: '#9a3412', fontWeight: 600, marginBottom: 4 }}>
                📬 ต้องยืนยันอีเมลก่อน
              </div>
              <div style={{ fontSize: '.74rem', color: '#9a3412', marginBottom: 10, lineHeight: 1.55 }}>
                บัญชี <strong>{unverifiedEmail}</strong> ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องจดหมาย (และโฟลเดอร์สแปม)
              </div>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                style={{
                  width: '100%', padding: '8px',
                  background: '#ea580c', color: '#fff',
                  border: 'none', borderRadius: 'var(--r)',
                  fontSize: '.78rem', fontWeight: 700,
                  cursor: resending ? 'not-allowed' : 'pointer',
                  opacity: resending ? .7 : 1,
                }}
              >
                {resending ? 'กำลังส่ง…' : 'ส่งลิงก์ยืนยันใหม่'}
              </button>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={S.label}>อีเมล</label>
              <input
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                style={S.input}
                autoComplete="email"
              />
              {errors.email && <p style={S.error}>{errors.email.message}</p>}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ ...S.label, marginBottom: 0 }}>รหัสผ่าน</label>
                <Link href="/forgot-password" style={{ fontSize: '.72rem', color: 'var(--sienna)', textDecoration: 'none', fontWeight: 600 }}>
                  ลืมรหัสผ่าน?
                </Link>
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="••••••••"
                style={S.input}
                autoComplete="current-password"
              />
              {errors.password && <p style={S.error}>{errors.password.message}</p>}
            </div>

            {/* 2FA step — shown after password verifies but server demands a code */}
            {needs2FA && (
              <div>
                <label style={S.label}>รหัสยืนยัน 6 หลัก (2FA)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  {...register('twoFactorCode')}
                  placeholder="123456"
                  style={{ ...S.input, letterSpacing: '.4em', textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
                />
                <p style={{ fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 5 }}>
                  จากแอป authenticator (Google Authenticator / Authy / 1Password)
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%', padding: '11px',
                background: 'var(--sienna)', color: '#fff',
                border: 'none', borderRadius: 'var(--r)',
                fontSize: '.88rem', fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                transition: 'background .18s', marginTop: 2,
                opacity: busy ? .7 : 1,
              }}
            >
              {loading ? 'กำลังเข้าสู่ระบบ…' : needs2FA ? 'ยืนยันรหัส' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        {/* ── Register link ── */}
        <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--ink-3)', marginTop: 20 }}>
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" style={{ color: 'var(--sienna)', fontWeight: 600, textDecoration: 'none' }}>
            สมัครสมาชิกฟรี
          </Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 12 }}>
          <Link href="/" style={{ fontSize: '.78rem', color: 'var(--ink-3)', textDecoration: 'none' }}>
            ← กลับหน้าร้าน
          </Link>
        </p>

      </div>
    </div>
  )
}
