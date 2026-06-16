'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect, useCallback } from 'react'
import { MemberModal } from '@/components/shop/MemberModal'

type Lang = 'en' | 'th'

interface Props {
  lang?: Lang
  setLang?: (l: Lang) => void
  searchQ?: string
  setSearchQ?: (q: string) => void
  cartCount?: number
  wishCount?: number
  onCartOpen?: () => void
  onWishOpen?: () => void
}

export function Header({
  lang: langProp,
  setLang: setLangProp,
  searchQ: searchQProp,
  setSearchQ: setSearchQProp,
  cartCount: cartCountProp,
  wishCount: wishCountProp,
  onCartOpen,
  onWishOpen,
}: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [memberOpen, setMemberOpen] = useState(false)
  const [points, setPoints] = useState<number | null>(null)
  // Internal state for standalone use (when props not provided)
  const [langInternal, setLangInternal] = useState<Lang>('en')
  const [searchInternal, setSearchInternal] = useState('')

  const lang = langProp ?? langInternal
  const setLang = setLangProp ?? setLangInternal
  const searchQ = searchQProp ?? searchInternal
  const setSearchQ = setSearchQProp ?? setSearchInternal
  const cartCount = cartCountProp ?? 0
  const wishCount = wishCountProp ?? 0

  // draft = ค่าที่แสดงใน input (พิมพ์ได้เรื่อยๆ)
  // searchQ = ค่าที่ใช้ค้นหาจริง (อัปเดตเมื่อกด Enter หรือคลิกแว่น)
  const [draft, setDraft] = useState(searchQ)

  function commitSearch() {
    setSearchQ(draft)
  }
  function clearSearch() {
    setDraft('')
    setSearchQ('')
  }

  const handlePointsLoaded = useCallback((p: number) => setPoints(p), [])

  // sync draft เมื่อ parent reset searchQ (เช่น กด Clear All Filters)
  useEffect(() => { setDraft(searchQ) }, [searchQ])

  function handleLangToggle(l: Lang) {
    setLang(l)
    if (!setLangProp) {
      document.documentElement.setAttribute('data-lang', l)
    }
  }

  // โหลดแต้มเมื่อ login — ใช้ user.id เป็น dependency (primitive = stable)
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) { setPoints(null); return }
    fetch('/api/user/points')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setPoints(d.points ?? 0) })
      .catch(() => {})
  }, [session?.user?.id])

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : null

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,247,242,.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--divider)',
      }}>
        <div className="header-inner">

          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, textDecoration: 'none' }}>
            <div style={{ width: 38, height: 38, borderRadius: 'var(--r)', background: 'var(--ink)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Modcava"
                style={{ height: 42, width: 'auto', mixBlendMode: 'screen', filter: 'brightness(1.05)' }}
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                  const fb = img.nextElementSibling as HTMLElement
                  if (fb) fb.style.display = 'flex'
                }}
              />
              <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
                  <path d="M18 4L30 11L30 25L18 32L6 25L6 11Z" stroke="#faf7f2" strokeWidth="1.5"/>
                  <circle cx="18" cy="18" r="3" fill="#faf7f2"/>
                </svg>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: '1.2rem', fontWeight: 600, letterSpacing: '.05em', color: 'var(--ink)', lineHeight: 1 }}>Modcava</div>
              <div className="header-brand-sub" style={{ fontSize: '.6rem', letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--sienna)', marginTop: 2 }}>TCG · Hobby</div>
            </div>
          </Link>

          {/* Search */}
          <div className="header-search">
            {/* แว่นขยาย — คลิกได้เพื่อค้นหา */}
            <button
              onClick={commitSearch}
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', cursor: 'pointer', padding: 2, background: 'none', border: 'none', display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <input
              className="field"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
              placeholder="Search cards, sets, products… / ค้นหา…"
              autoComplete="off"
              style={{ paddingLeft: 36, paddingRight: 32, fontSize: '.85rem' }}
            />
            {draft && (
              <button
                onClick={clearSearch}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '.85rem', padding: 3, background: 'none', border: 'none' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {/* Lang toggle */}
            <div style={{ display: 'flex', background: 'var(--paper-3)', borderRadius: 99, padding: 2, gap: 2 }}>
              {(['en', 'th'] as const).map((l) => (
                <button key={l} onClick={() => handleLangToggle(l)} style={{
                  fontSize: '.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: 99,
                  color: lang === l ? 'var(--paper)' : 'var(--ink-3)',
                  background: lang === l ? 'var(--ink)' : 'transparent',
                  transition: 'all .18s', border: 'none', cursor: 'pointer',
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Wishlist */}
            <button
              onClick={onWishOpen}
              title="Wishlist"
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 'var(--r)',
                border: '1.5px solid var(--divider)', color: 'var(--ink-2)',
                transition: 'all .18s', background: 'none', cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
              {wishCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 16, height: 16, background: 'var(--sienna)', color: '#fff',
                  fontSize: '.58rem', fontWeight: 700, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {wishCount}
                </span>
              )}
            </button>

            {/* Cart */}
            <button
              onClick={onCartOpen}
              style={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 36, height: 36, borderRadius: 'var(--r)',
                border: '1.5px solid var(--divider)', color: 'var(--ink-2)',
                transition: 'all .18s', background: 'none', cursor: 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  width: 16, height: 16, background: 'var(--sienna)', color: '#fff',
                  fontSize: '.58rem', fontWeight: 700, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>

            {/* Points pill — แสดงทันทีที่ login แม้ยังโหลดไม่เสร็จ */}
            {session && (
              <button
                onClick={() => setMemberOpen(true)}
                title={points !== null ? `แต้มสะสม ${points.toLocaleString()} แต้ม` : 'กำลังโหลดแต้ม…'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px 4px 8px',
                  border: '1.5px solid var(--sienna)',
                  borderRadius: 99,
                  background: 'var(--sienna-bg)',
                  color: 'var(--sienna)',
                  fontSize: '.72rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all .18s',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  minWidth: 64,
                }}
              >
                <span style={{ fontSize: '.78rem' }}>⭐</span>
                {points !== null
                  ? <>{points.toLocaleString()}<span style={{ fontWeight: 400, opacity: .7 }}>แต้ม</span></>
                  : <span style={{ opacity: .5 }}>…</span>
                }
              </button>
            )}

            {/* Member button */}
            <button onClick={() => session ? setMemberOpen(true) : router.push('/login')} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 11px 5px 7px',
              border: `1.5px solid ${session ? 'var(--sienna)' : 'var(--divider)'}`,
              borderRadius: 99,
              background: session ? 'var(--sienna-bg)' : '#fff',
              color: session ? 'var(--sienna)' : 'var(--ink-2)',
              fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all .18s',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: session ? 'var(--sienna)' : 'var(--paper-3)',
                color: session ? '#fff' : 'var(--ink-3)',
                fontSize: '.65rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {session && initials ? initials : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </div>
              <span>{session ? (session.user?.name?.split(' ')[0] || 'Account') : 'Login'}</span>
            </button>
          </div>
        </div>
      </header>

      <MemberModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        onPointsLoaded={handlePointsLoaded}
      />
    </>
  )
}
