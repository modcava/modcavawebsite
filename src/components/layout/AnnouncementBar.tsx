'use client'
import { useEffect, useState } from 'react'

// Thin promo strip above the header. Rotates a few storefront-wide messages so
// the free-shipping incentive is visible while browsing (not only at checkout).
const MESSAGES: { th: string; en: string }[] = [
  { th: '🚚 ส่งฟรีเมื่อซื้อครบ ฿1,000', en: '🚚 Free shipping on orders over ฿1,000' },
  { th: '⭐ สมัครสมาชิกฟรี — รับแต้มสะสมทุกการสั่งซื้อ', en: '⭐ Join free — earn points on every order' },
  { th: '🎴 การ์ดใบเดี่ยว & กล่องซีลใหม่เข้าทุกสัปดาห์', en: '🎴 New singles & sealed restocked weekly' },
]

export function AnnouncementBar() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (MESSAGES.length < 2) return
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 4500)
    return () => clearInterval(t)
  }, [])

  const m = MESSAGES[i]
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--ink)', color: 'var(--paper)',
        textAlign: 'center', fontSize: '.76rem', fontWeight: 500,
        padding: '6px 16px', letterSpacing: '.01em', lineHeight: 1.4,
      }}
    >
      <span key={i} style={{ animation: 'annbar-fade .5s ease' }}>
        <span className="en-text">{m.en}</span>
        <span className="th-text">{m.th}</span>
      </span>
    </div>
  )
}
