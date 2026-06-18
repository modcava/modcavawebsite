import { getServerSession } from 'next-auth'
import { redirect }         from 'next/navigation'
import Link                 from 'next/link'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { statusStyle, statusLabel } from '@/lib/utils'
import { AddressBook } from '@/components/account/AddressBook'
import { ProfileEditButton } from '@/components/account/ProfileEditButton'
import { getExpiringSoon } from '@/lib/points'

export const metadata = { title: 'บัญชีของฉัน | Modcava' }

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/account')

  // ดึงข้อมูล user + ออเดอร์
  const [user, orderCount, recentOrders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { points: true, phone: true },
    }),
    prisma.order.count({ where: { userId: session.user.id } }),
    prisma.order.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true, orderNumber: true, status: true,
        total: true, createdAt: true,
        items: { select: { productName: true, quantity: true }, take: 1 },
      },
    }),
  ])

  const points  = user?.points ?? 0
  const expiring = await getExpiringSoon(session.user.id)
  const expiringDateStr = expiring
    ? new Date(expiring.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const initials = session.user.name
    ? session.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const isAdmin = session.user.role === 'ADMIN'

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* ── Back button ── */}
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.85rem', color: 'var(--sienna)', textDecoration: 'none', marginBottom: 20, fontWeight: 500 }}>
        ← <span className="en-text">Back to Home</span><span className="th-text">กลับสู่หน้าหลัก</span>
      </Link>

      {/* ── Header ── */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>My Account</div>
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 28 }}>
        สวัสดี, {session.user.name?.split(' ')[0] || 'คุณ'} 👋
      </h1>

      {/* ── Profile card ── */}
      <div style={{
        background: '#fff', border: '1px solid var(--divider)',
        borderRadius: 'var(--r-lg)', padding: '20px 22px',
        display: 'flex', alignItems: 'center', gap: 18,
        marginBottom: 20,
        boxShadow: '0 1px 8px rgba(42,34,24,.04)',
      }}>
        {/* Avatar */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--sienna)', color: '#fff',
          fontSize: '1.1rem', fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.95rem' }}>
            {session.user.name}
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 2 }}>
            {session.user.email}
          </div>
          {user?.phone && (
            <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 2 }}>
              📞 {user.phone}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <ProfileEditButton
            name={session.user.name ?? ''}
            phone={user?.phone ?? undefined}
          />
          {isAdmin && (
            <Link href="/admin" style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 'var(--r)',
              background: 'var(--sienna)', color: '#fff',
              fontSize: '.75rem', fontWeight: 700, textDecoration: 'none',
            }}>
              Admin Panel →
            </Link>
          )}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 32 }}>

        {/* Points card */}
        <div style={{
          gridColumn: '1 / -1',
          background: 'linear-gradient(135deg, var(--sienna-bg) 0%, #fdf6ee 100%)',
          border: '1.5px solid var(--sienna)',
          borderRadius: 'var(--r-lg)', padding: '18px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--sienna)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              ⭐ แต้มสะสมของฉัน
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Lora', serif", fontSize: '2.4rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                {points.toLocaleString()}
              </span>
              <span style={{ fontSize: '.82rem', color: 'var(--ink-3)', fontWeight: 500 }}>แต้ม</span>
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--ink-2)', marginTop: 4 }}>
              มูลค่า <strong style={{ color: 'var(--sienna)' }}>฿{points.toLocaleString()}</strong> สำหรับใช้เป็นส่วนลด
            </div>
            {expiring && expiringDateStr && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8,
                padding: '4px 10px', borderRadius: 'var(--r)',
                background: '#fff3cd', border: '1px solid #ffc107',
                fontSize: '.74rem', fontWeight: 600, color: '#92610a',
              }}>
                ⏳ อีก <strong>{expiring.amount.toLocaleString()}</strong> แต้ม จะหมดอายุภายใน <strong>{expiringDateStr}</strong>
              </div>
            )}
          </div>
          <div style={{
            background: 'rgba(255,255,255,.6)', borderRadius: 'var(--r)',
            padding: '10px 14px', fontSize: '.72rem', color: 'var(--ink-2)',
            lineHeight: 1.7, textAlign: 'right',
          }}>
            <div>ทุก <strong>฿100</strong> ที่ซื้อ → <strong>1 แต้ม</strong></div>
            <div><strong>1 แต้ม</strong> = ส่วนลด <strong>฿1</strong></div>
          </div>
        </div>

        <Link href="/account/orders" style={{
          display: 'block', textDecoration: 'none',
          background: '#fff', border: '1px solid var(--divider)',
          borderRadius: 'var(--r-lg)', padding: '18px 20px',
          transition: 'border-color .18s, box-shadow .18s',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>คำสั่งซื้อของฉัน</div>
          <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 3 }}>
            {orderCount > 0 ? `${orderCount} รายการ — ดูสถานะได้ที่นี่` : 'ยังไม่มีคำสั่งซื้อ'}
          </div>
        </Link>

        <Link href="/" style={{
          display: 'block', textDecoration: 'none',
          background: '#fff', border: '1px solid var(--divider)',
          borderRadius: 'var(--r-lg)', padding: '18px 20px',
          transition: 'border-color .18s',
        }}>
          <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>🛍️</div>
          <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '.9rem' }}>เลือกซื้อสินค้า</div>
          <div style={{ fontSize: '.78rem', color: 'var(--ink-3)', marginTop: 3 }}>การ์ด MTG · Riftbound · สี</div>
        </Link>
      </div>

      {/* ── Shipping addresses ── */}
      <div style={{ marginBottom: 32 }}>
        <AddressBook />
      </div>

      {/* ── Recent orders ── */}
      {recentOrders.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)' }}>
              คำสั่งซื้อล่าสุด
            </h2>
            <Link href="/account/orders" style={{ fontSize: '.78rem', color: 'var(--sienna)', textDecoration: 'none', fontWeight: 600 }}>
              ดูทั้งหมด →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentOrders.map((order) => {
              const total   = typeof order.total === 'object' ? order.total.toNumber() : Number(order.total)
              const badge   = statusStyle(order.status)
              const label   = statusLabel(order.status)
              const firstItem = order.items[0]
              const dateStr = new Date(order.createdAt).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <Link key={order.id} href="/account/orders" style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff', border: '1px solid var(--divider)',
                    borderRadius: 'var(--r-lg)', padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'border-color .18s',
                  }}>
                    {/* Status dot */}
                    <span style={{
                      ...badge,
                      width: 8, height: 8, borderRadius: '50%',
                      display: 'inline-block', flexShrink: 0,
                      background: badge.color,
                      border: 'none',
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '.78rem', fontWeight: 700, color: 'var(--sienna)' }}>
                          {order.orderNumber}
                        </span>
                        <span style={{
                          ...badge,
                          padding: '2px 7px', borderRadius: 99,
                          fontSize: '.65rem', fontWeight: 700,
                        }}>
                          {label}
                        </span>
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--ink-3)', marginTop: 2 }}>
                        {firstItem
                          ? `${firstItem.productName}${order.items.length > 1 ? ` และอีก ${order.items.length - 1} รายการ` : ''}`
                          : '—'}
                        {' · '}{dateStr}
                      </div>
                    </div>

                    <div style={{ fontFamily: "'Lora', serif", fontSize: '.95rem', fontWeight: 600, color: 'var(--sienna)', flexShrink: 0 }}>
                      ฿{total.toLocaleString()}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
