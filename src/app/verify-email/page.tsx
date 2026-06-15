import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'ยืนยันอีเมล' }
export const dynamic = 'force-dynamic'

// Server-rendered: process the token, then show the result.
// No client JS needed — clicking the link is one-shot.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token

  let state: 'ok' | 'expired' | 'invalid' | 'already' | 'missing' = 'missing'
  let userEmail: string | null = null

  if (token) {
    const user = await prisma.user.findFirst({
      where:  { verificationToken: token },
      select: { id: true, email: true, emailVerified: true, verificationTokenExpiry: true },
    })

    if (!user) {
      state = 'invalid'
    } else if (user.emailVerified) {
      state = 'already'
      userEmail = user.email
    } else if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
      state = 'expired'
      userEmail = user.email
    } else {
      // Mark verified + clear token
      await prisma.user.update({
        where: { id: user.id },
        data:  { emailVerified: new Date(), verificationToken: null, verificationTokenExpiry: null },
      })
      state = 'ok'
      userEmail = user.email
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--paper) 60%, var(--paper-3) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 460, width: '100%',
        background: '#fff', border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)', padding: '36px 32px',
        boxShadow: '0 2px 24px rgba(42,34,24,.07)',
        textAlign: 'center',
      }}>
        {state === 'ok' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>✅</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              ยืนยันอีเมลสำเร็จ!
            </h1>
            <p style={{ fontSize: '.88rem', color: 'var(--ink-2)', lineHeight: 1.65 }}>
              บัญชี <strong>{userEmail}</strong> พร้อมใช้งานแล้ว
            </p>
            <Link href="/login" style={{
              display: 'inline-block', marginTop: 22, padding: '11px 28px',
              background: 'var(--sienna)', color: '#fff', borderRadius: 'var(--r)',
              fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
            }}>
              เข้าสู่ระบบ
            </Link>
          </>
        )}

        {state === 'already' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>👍</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              อีเมลนี้ยืนยันแล้ว
            </h1>
            <p style={{ fontSize: '.88rem', color: 'var(--ink-2)' }}>
              คุณสามารถเข้าสู่ระบบได้เลย
            </p>
            <Link href="/login" style={{
              display: 'inline-block', marginTop: 22, padding: '11px 28px',
              background: 'var(--sienna)', color: '#fff', borderRadius: 'var(--r)',
              fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
            }}>
              เข้าสู่ระบบ
            </Link>
          </>
        )}

        {state === 'expired' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>⏰</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              ลิงก์หมดอายุแล้ว
            </h1>
            <p style={{ fontSize: '.88rem', color: 'var(--ink-2)' }}>
              กรุณาขอลิงก์ยืนยันใหม่
            </p>
            <Link href="/login" style={{
              display: 'inline-block', marginTop: 22, padding: '11px 28px',
              background: 'var(--sienna)', color: '#fff', borderRadius: 'var(--r)',
              fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
            }}>
              ไปหน้า Login
            </Link>
          </>
        )}

        {(state === 'invalid' || state === 'missing') && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: 14 }}>❌</div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.35rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              ลิงก์ไม่ถูกต้อง
            </h1>
            <p style={{ fontSize: '.88rem', color: 'var(--ink-2)' }}>
              {state === 'missing'
                ? 'ไม่พบ token ใน URL'
                : 'ลิงก์ยืนยันใช้งานไม่ได้ — กรุณาขอลิงก์ใหม่จากหน้า login'}
            </p>
            <Link href="/login" style={{
              display: 'inline-block', marginTop: 22, padding: '11px 28px',
              background: 'var(--sienna)', color: '#fff', borderRadius: 'var(--r)',
              fontWeight: 700, fontSize: '.88rem', textDecoration: 'none',
            }}>
              กลับหน้า Login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
