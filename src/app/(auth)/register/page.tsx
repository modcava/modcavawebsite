'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  name:     z.string().min(2, 'ชื่ออย่างน้อย 2 ตัวอักษร'),
  email:    z.string().email('อีเมลไม่ถูกต้อง'),
  password: z.string().min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร'),
})
type Form = z.infer<typeof schema>

// ── Password strength (client-side UX only; server still enforces min 8) ──
interface Strength { score: number; label: string; color: string; checks: { ok: boolean; text: string }[] }
function passwordStrength(pw: string): Strength {
  const checks = [
    { ok: pw.length >= 8,          text: 'อย่างน้อย 8 ตัวอักษร' },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), text: 'พิมพ์เล็ก + พิมพ์ใหญ่' },
    { ok: /\d/.test(pw),           text: 'มีตัวเลข' },
    { ok: /[^A-Za-z0-9]/.test(pw), text: 'มีอักขระพิเศษ (!@#…)' },
  ]
  const passed = checks.filter((c) => c.ok).length
  // Bonus point for long passwords so a 16-char passphrase still rates well
  const score = Math.min(4, passed + (pw.length >= 14 ? 1 : 0))
  const meta = [
    { label: '',          color: 'var(--divider)' },
    { label: 'อ่อนมาก',   color: '#c0392b' },
    { label: 'อ่อน',      color: '#e67e22' },
    { label: 'พอใช้',     color: '#d4a017' },
    { label: 'แข็งแรง',   color: '#2d7a42' },
  ][pw ? score : 0]
  return { score: pw ? score : 0, label: meta.label, color: meta.color, checks }
}

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

export default function RegisterPage() {
  const router = useRouter()
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
  })

  const pwValue = watch('password') || ''
  const strength = passwordStrength(pwValue)

  async function onSubmit(data: Form) {
    setLoading(true)
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setLoading(false)

    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error || 'สมัครสมาชิกไม่สำเร็จ')
    } else {
      // แสดงหน้า "ตรวจสอบอีเมล" แทนพาไปหน้า login เลย
      setRegisteredEmail(data.email)
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    await signIn('google', { callbackUrl: '/' })
  }

  const busy = loading || googleLoading

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
            <img src="/logo.png" alt="Modcava" style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 'var(--r-lg)' }} />
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
            สร้างบัญชีใหม่
          </h1>
          <p style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>
            สมัครสมาชิกฟรี เพื่อสั่งซื้อและติดตามออเดอร์
          </p>
        </div>

        {/* ── Success state — show after registration ── */}
        {registeredEmail ? (
          <div style={{
            background: '#fff', border: '1px solid var(--divider)',
            borderRadius: 'var(--r-lg)', padding: '36px 32px',
            boxShadow: '0 2px 24px rgba(42,34,24,.07)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>📬</div>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
              สมัครสมาชิกสำเร็จ!
            </h2>
            <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 18 }}>
              เราได้ส่งลิงก์ยืนยันไปที่<br/>
              <strong style={{ color: 'var(--ink)' }}>{registeredEmail}</strong><br/>
              <span style={{ fontSize: '.76rem', color: 'var(--ink-3)' }}>กรุณาคลิกลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี</span>
            </p>
            <p style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginBottom: 18 }}>
              ⚠️ ตรวจสอบโฟลเดอร์ <strong>สแปม</strong> ด้วย — บางครั้งอีเมลยืนยันอาจถูกกรองเข้าไป
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '10px', background: 'var(--sienna)', color: '#fff',
                border: 'none', borderRadius: 'var(--r)',
                fontSize: '.85rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        ) : (
        /* ── Card ── */
        <div style={{
          background: '#fff',
          border: '1px solid var(--divider)',
          borderRadius: 'var(--r-lg)',
          padding: '28px 28px 24px',
          boxShadow: '0 2px 24px rgba(42,34,24,.07)',
        }}>

          {/* ── Google button ── */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, width: '100%', padding: '11px 16px',
              background: googleLoading ? 'var(--paper-2)' : '#fff',
              border: '1.5px solid var(--divider)',
              borderRadius: 'var(--r)',
              fontSize: '.88rem', fontWeight: 600,
              color: 'var(--ink)', cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'all .18s',
              opacity: busy ? .75 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? 'กำลังเชื่อมต่อ…' : 'สมัครด้วย Google'}
          </button>

          {/* ── Divider ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
            <span style={{ fontSize: '.72rem', color: 'var(--ink-3)', letterSpacing: '.08em' }}>หรือสมัครด้วยอีเมล</span>
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={S.label}>ชื่อ-นามสกุล</label>
              <input
                {...register('name')}
                placeholder="ชื่อของคุณ"
                style={S.input}
                autoComplete="name"
              />
              {errors.name && <p style={S.error}>{errors.name.message}</p>}
            </div>

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
              <label style={S.label}>รหัสผ่าน</label>
              <input
                type="password"
                {...register('password')}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                style={S.input}
                autoComplete="new-password"
              />
              {errors.password && <p style={S.error}>{errors.password.message}</p>}

              {/* Strength meter — appears as the user types */}
              {pwValue && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} style={{
                        flex: 1, height: 4, borderRadius: 2,
                        background: i <= strength.score ? strength.color : 'var(--divider)',
                        transition: 'background .2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '.68rem', color: 'var(--ink-3)' }}>ความปลอดภัยของรหัสผ่าน</span>
                    <span style={{ fontSize: '.68rem', fontWeight: 700, color: strength.color }}>{strength.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                    {strength.checks.map((c) => (
                      <span key={c.text} style={{ fontSize: '.66rem', color: c.ok ? '#2d7a42' : 'var(--ink-4)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {c.ok ? '✓' : '○'} {c.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

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
              {loading ? 'กำลังสร้างบัญชี…' : 'สมัครสมาชิก'}
            </button>
          </form>

          {/* Terms note */}
          <p style={{ fontSize: '.68rem', color: 'var(--ink-3)', textAlign: 'center', marginTop: 14, lineHeight: 1.6 }}>
            การสมัครสมาชิกถือว่าคุณยอมรับ{' '}
            <span style={{ color: 'var(--sienna)' }}>เงื่อนไขการใช้งาน</span>
            {' '}และ{' '}
            <span style={{ color: 'var(--sienna)' }}>นโยบายความเป็นส่วนตัว</span>
          </p>
        </div>
        )}

        {/* ── Login link ── */}
        <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--ink-3)', marginTop: 20 }}>
          มีบัญชีอยู่แล้ว?{' '}
          <Link href="/login" style={{ color: 'var(--sienna)', fontWeight: 600, textDecoration: 'none' }}>
            เข้าสู่ระบบ
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
