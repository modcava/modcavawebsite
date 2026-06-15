import { getServerSession } from 'next-auth'
import { redirect }         from 'next/navigation'
import Link                 from 'next/link'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { formatPrice, statusStyle, statusLabel } from '@/lib/utils'

export const metadata = { title: 'คำสั่งซื้อของฉัน | Modcava' }

// ── Status icon ───────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, string> = {
    PENDING:   '🕐',
    CONFIRMED: '✅',
    SHIPPED:   '🚚',
    DELIVERED: '📦',
    CANCELLED: '❌',
  }
  return <>{icons[status] ?? '•'}</>
}

export default async function OrdersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login?callbackUrl=/account/orders')

  const orders = await prisma.order.findMany({
    where:   { userId: session.user.id },
    include: { items: { include: { product: { select: { name: true, emoji: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 80px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        {/* Breadcrumb links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link href="/account" style={{ fontSize: '.78rem', color: 'var(--ink-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← บัญชีของฉัน
          </Link>
          <span style={{ color: 'var(--divider)' }}>|</span>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '.78rem', fontWeight: 600, color: 'var(--sienna)',
            textDecoration: 'none', padding: '4px 10px',
            border: '1px solid var(--sienna)', borderRadius: 99,
            transition: 'all .18s',
          }}>
            🏠 กลับสู่หน้าหลัก
          </Link>
        </div>

        <div className="eyebrow" style={{ marginBottom: 6 }}>My Account</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)' }}>
            คำสั่งซื้อของฉัน
          </h1>
          {orders.length > 0 && (
            <span style={{ fontSize: '.82rem', color: 'var(--ink-3)' }}>
              {orders.length} รายการ
            </span>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {orders.length === 0 ? (
        <div style={{
          background: '#fff', border: '1px solid var(--divider)',
          borderRadius: 'var(--r-lg)', padding: '60px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12, opacity: .4 }}>📋</div>
          <p style={{ color: 'var(--ink-2)', marginBottom: 4, fontWeight: 600 }}>ยังไม่มีคำสั่งซื้อ</p>
          <p style={{ color: 'var(--ink-3)', fontSize: '.85rem', marginBottom: 24 }}>
            เริ่มช้อปปิ้งและคำสั่งซื้อจะปรากฏที่นี่
          </p>
          <Link href="/" style={{
            display: 'inline-block', padding: '10px 28px',
            background: 'var(--sienna)', color: '#fff',
            borderRadius: 'var(--r)', fontWeight: 600, fontSize: '.85rem',
            textDecoration: 'none',
          }}>
            เลือกสินค้า →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orders.map((order) => {
            const total    = typeof order.total === 'object' ? order.total.toNumber() : Number(order.total)
            const badgeSt  = statusStyle(order.status)
            const label    = statusLabel(order.status)
            const dateStr  = new Date(order.createdAt).toLocaleDateString('th-TH', {
              year: 'numeric', month: 'long', day: 'numeric',
            })

            return (
              <div key={order.id} style={{
                background: '#fff',
                border: '1px solid var(--divider)',
                borderRadius: 'var(--r-lg)',
                overflow: 'hidden',
                boxShadow: '0 1px 8px rgba(42,34,24,.04)',
              }}>

                {/* ── Card header ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10,
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--divider)',
                  background: 'var(--paper-2)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Order number */}
                    <div>
                      <span style={{ fontFamily: 'monospace', fontSize: '.82rem', fontWeight: 700, color: 'var(--sienna)', letterSpacing: '.04em' }}>
                        {order.orderNumber}
                      </span>
                      <div style={{ fontSize: '.7rem', color: 'var(--ink-3)', marginTop: 1 }}>
                        {dateStr}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    ...badgeSt,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 99,
                    fontSize: '.72rem', fontWeight: 700,
                  }}>
                    <StatusIcon status={order.status} />
                    {label}
                  </span>
                </div>

                {/* ── Items ── */}
                <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {order.items.map((item) => {
                    const itemPrice = typeof item.price === 'object' ? item.price.toNumber() : Number(item.price)
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '1.3rem', width: 30, textAlign: 'center', flexShrink: 0 }}>
                          {item.product?.emoji || '🃏'}
                        </span>
                        <span style={{ flex: 1, fontSize: '.85rem', color: 'var(--ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </span>
                        <span style={{ fontSize: '.78rem', color: 'var(--ink-3)', flexShrink: 0 }}>
                          ×{item.quantity}
                        </span>
                        <span style={{ fontFamily: "'Lora', serif", fontSize: '.88rem', fontWeight: 600, color: 'var(--sienna)', flexShrink: 0, minWidth: 70, textAlign: 'right' }}>
                          {formatPrice(itemPrice * item.quantity)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* ── Footer ── */}
                <div style={{
                  borderTop: '1px solid var(--divider)',
                  padding: '12px 20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 8,
                  background: 'var(--paper-2)',
                }}>
                  <div style={{ fontSize: '.75rem', color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span>
                      🚚 {order.shippingMethod ?? 'Kerry'}
                      {' · '}
                      💳 {order.paymentMethod ?? 'PromptPay'}
                    </span>
                    {order.trackingNumber && (
                      <span style={{ color: 'var(--sienna)', fontWeight: 600 }}>
                        Tracking: {order.trackingNumber}
                      </span>
                    )}
                    {order.address && (
                      <span style={{ color: 'var(--ink-3)' }}>
                        📍 {order.recipientName} · {order.district}, {order.province}
                      </span>
                    )}
                    {/* สลิปที่ส่งแล้ว */}
                    {order.slipUrl && (
                      <span style={{ color: '#28a745', fontWeight: 600 }}>
                        ✅ ส่งสลิปแล้ว
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* ปุ่มชำระสินค้า / ส่งสลิปใหม่ — ซ่อนเมื่อยกเลิกหรือยืนยันแล้ว */}
                    {order.status !== 'CANCELLED' && order.status !== 'CONFIRMED' && (
                      <Link href={`/orders/${order.orderNumber}/payment`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 16px',
                        background: order.slipUrl ? 'transparent' : 'var(--sienna)',
                        color: order.slipUrl ? 'var(--sienna)' : '#fff',
                        border: order.slipUrl ? '1.5px solid var(--sienna)' : 'none',
                        borderRadius: 'var(--r)', fontWeight: 700,
                        fontSize: '.78rem', textDecoration: 'none',
                        whiteSpace: 'nowrap', transition: 'opacity .18s',
                      }}>
                        {order.slipUrl ? '🔄 ส่งสลิปใหม่' : '💳 ชำระสินค้า'}
                      </Link>
                    )}

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.7rem', color: 'var(--ink-3)', marginBottom: 1 }}>ยอดรวม</div>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: '1.2rem', fontWeight: 600, color: 'var(--sienna)' }}>
                        {formatPrice(total)}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
