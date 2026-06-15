'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  onPointsLoaded?: (points: number) => void
}

export function MemberModal({ open, onClose, onPointsLoaded }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [points, setPoints] = useState<number | null>(null)

  // โหลดแต้มเมื่อเปิด modal และ login อยู่
  useEffect(() => {
    if (open && session) {
      fetch('/api/user/points')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) {
            const p = d.points ?? 0
            setPoints(p)
            onPointsLoaded?.(p)
          }
        })
        .catch(() => {})
    }
    if (!open) setPoints(null)
  }, [open, session, onPointsLoaded])

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  function goLogin() {
    onClose()
    router.push('/login')
  }
  function goRegister() {
    onClose()
    router.push('/register')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
          zIndex: 1100, opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
          transition: 'opacity .2s',
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: open ? 'translate(-50%,-50%)' : 'translate(-50%,-48%)',
        width: 'min(420px, 94vw)', background: 'var(--paper)',
        borderRadius: 'var(--r-lg)', boxShadow: '0 20px 60px rgba(0,0,0,.18)',
        zIndex: 1101, padding: '28px 28px 24px',
        opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
        transition: 'all .22s',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 16, fontSize: '1.1rem', color: 'var(--ink-3)', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--r)', background: 'none', border: 'none' }}>
          ✕
        </button>

        {session ? (
          /* Logged in view */
          <div style={{ padding: '8px 0' }}>
            {/* Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--sienna)', color: '#fff', fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '.92rem', fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user?.name}</div>
                <div style={{ fontSize: '.74rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user?.email}</div>
              </div>
            </div>

            {/* Points card */}
            <div style={{
              background: 'linear-gradient(135deg, var(--sienna-bg) 0%, #fdf6ee 100%)',
              border: '1.5px solid var(--sienna)',
              borderRadius: 'var(--r)',
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '.68rem', fontWeight: 600, color: 'var(--sienna)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  ⭐ แต้มสะสม
                </div>
                <div style={{ fontFamily: "'Lora', serif", fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                  {points === null
                    ? <span style={{ fontSize: '.9rem', color: 'var(--ink-3)' }}>กำลังโหลด…</span>
                    : points.toLocaleString()
                  }
                  {points !== null && (
                    <span style={{ fontSize: '.72rem', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>แต้ม</span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '.65rem', color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  1 แต้ม = ฿1 ส่วนลด<br/>
                  ทุก ฿100 ได้ 1 แต้ม
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { onClose(); router.push('/account/orders') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  borderRadius: 'var(--r)', background: 'var(--paper-2)',
                  color: 'var(--ink)', border: '1.5px solid var(--divider)',
                  fontSize: '.84rem', fontWeight: 600, cursor: 'pointer', transition: 'all .18s',
                  textAlign: 'left',
                }}
              >
                <span>📋</span>
                <span style={{ flex: 1 }}>คำสั่งซื้อของฉัน</span>
                <span style={{ color: 'var(--ink-3)', fontSize: '.8rem' }}>→</span>
              </button>

              <button
                onClick={() => { onClose(); router.push('/account') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 14px',
                  borderRadius: 'var(--r)', background: 'var(--paper-2)',
                  color: 'var(--ink)', border: '1.5px solid var(--divider)',
                  fontSize: '.84rem', fontWeight: 600, cursor: 'pointer', transition: 'all .18s',
                  textAlign: 'left',
                }}
              >
                <span>👤</span>
                <span style={{ flex: 1 }}>บัญชีของฉัน</span>
                <span style={{ color: 'var(--ink-3)', fontSize: '.8rem' }}>→</span>
              </button>

              {session.user?.role === 'ADMIN' && (
                <button
                  onClick={() => { onClose(); router.push('/admin') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '10px 14px',
                    borderRadius: 'var(--r)', background: 'var(--sienna-bg)',
                    color: 'var(--sienna)', border: '1.5px solid var(--sienna)',
                    fontSize: '.84rem', fontWeight: 600, cursor: 'pointer', transition: 'all .18s',
                    textAlign: 'left',
                  }}
                >
                  <span>⚙️</span>
                  <span style={{ flex: 1 }}>Admin Panel</span>
                  <span style={{ fontSize: '.8rem' }}>→</span>
                </button>
              )}

              <button
                onClick={() => { signOut({ callbackUrl: '/' }); onClose() }}
                style={{
                  width: '100%', padding: '9px 14px',
                  borderRadius: 'var(--r)', background: 'none',
                  color: 'var(--ink-3)', border: '1px solid var(--divider)',
                  fontSize: '.8rem', fontWeight: 600, cursor: 'pointer',
                  transition: 'all .18s', marginTop: 4,
                }}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        ) : (
          /* Guest view */
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', marginBottom: 22, borderBottom: '2px solid var(--divider)' }}>
              {(['login', 'register'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '7px 18px', fontSize: '.82rem', fontWeight: 600,
                  color: tab === t ? 'var(--sienna)' : 'var(--ink-3)',
                  cursor: 'pointer', border: 'none', background: 'none',
                  borderBottom: tab === t ? '2px solid var(--sienna)' : '2px solid transparent',
                  marginBottom: -2, transition: 'all .15s',
                }}>
                  {t === 'login' ? 'Login' : 'Register'}
                </button>
              ))}
            </div>

            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Sign in to your Modcava account to track orders and access exclusive features.
                </p>
                <button onClick={goLogin} style={{
                  width: '100%', padding: 11, borderRadius: 'var(--r)',
                  background: 'var(--sienna)', color: '#fff',
                  fontSize: '.84rem', fontWeight: 700, letterSpacing: '.05em',
                  cursor: 'pointer', border: 'none', transition: 'background .18s',
                }}>
                  Go to Login
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: '.84rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  Create a free account to start collecting and track your orders.
                </p>
                <button onClick={goRegister} style={{
                  width: '100%', padding: 11, borderRadius: 'var(--r)',
                  background: 'var(--sienna)', color: '#fff',
                  fontSize: '.84rem', fontWeight: 700, letterSpacing: '.05em',
                  cursor: 'pointer', border: 'none', transition: 'background .18s',
                }}>
                  Create Account
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
