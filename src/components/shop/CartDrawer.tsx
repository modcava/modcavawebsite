'use client'
import { useRouter } from 'next/navigation'
import { useCart } from '@/store/cart'

interface Props {
  open: boolean
  onClose: () => void
}

export function CartDrawer({ open, onClose }: Props) {
  const { items, removeItem, updateQty, clearCart, total, remainingTotal, setPayFullPrice } = useCart()
  const totalVal = total()
  const remainingVal = remainingTotal()
  const router = useRouter()

  function goCheckout() {
    onClose()
    router.push('/checkout')
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(42,34,24,.4)',
          zIndex: 200, opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
          transition: 'opacity .25s',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: open ? 0 : -440, width: '100%', maxWidth: 420,
        height: '100vh', background: 'var(--paper)', borderLeft: '1px solid var(--divider)',
        zIndex: 201, transition: 'right .3s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--divider)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: "'Lora', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)' }}>
            <span className="en-text">Cart</span>
            <span className="th-text">ตะกร้า</span>
            {items.length > 0 && (
              <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: '.8rem', marginLeft: 6 }}>
                ({items.length})
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {items.length > 0 && (
              <button
                onClick={() => { if (confirm('ล้างตะกร้าทั้งหมด?')) clearCart() }}
                style={{
                  fontSize: '.72rem', color: 'var(--ink-3)', cursor: 'pointer',
                  padding: '4px 8px', borderRadius: 'var(--r)',
                  border: '1px solid var(--divider)', background: 'none',
                  transition: 'all .18s', whiteSpace: 'nowrap',
                }}
              >
                ล้างทั้งหมด
              </button>
            )}
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 'var(--r)',
              border: '1.5px solid var(--divider)', color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', transition: 'all .18s', background: 'none', cursor: 'pointer',
            }}>
              ✕
            </button>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {items.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--ink-3)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.8rem', opacity: .3 }}>🛒</div>
              <p><span className="en-text">Your cart is empty</span><span className="th-text">ตะกร้าว่างอยู่</span></p>
            </div>
          ) : (
            items.map((item) => {
              const customerRemaining = item.maxPerCustomer
                ? Math.max(0, item.maxPerCustomer - item.alreadyBought)
                : Infinity
              const cap = Math.min(item.stock, item.maxPerOrder || Infinity, customerRemaining)
              const atCap = item.quantity >= cap
              const capTitle = item.maxPerCustomer && item.quantity >= customerRemaining
                ? `จำกัดการซื้อ ${item.maxPerCustomer} ชิ้น/ลูกค้า`
                : item.maxPerOrder && item.quantity >= item.maxPerOrder
                ? `จำกัดการซื้อ ${item.maxPerOrder} ชิ้น/ออเดอร์`
                : `สต็อกมีเพียง ${item.stock} ชิ้น`
              return (
              <div key={item.id} style={{ display: 'flex', gap: 11, padding: 12, background: 'var(--paper-2)', borderRadius: 'var(--r)', border: '1px solid var(--divider)', marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0, background: 'var(--paper-3)' }}>
                  {item.emoji || '🃏'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '.68rem', color: 'var(--ink-3)' }}>
                    {item.setName}{item.condition ? ` · ${item.condition}` : ''}
                    {!!item.maxPerOrder && (
                      <span style={{ marginLeft: 4, color: 'var(--sienna)', fontWeight: 600 }}>
                        · สูงสุด {item.maxPerOrder}/ออเดอร์
                      </span>
                    )}
                  </div>
                  {!!item.maxPerCustomer && (
                    <div style={{ fontSize: '.66rem', color: '#6b46c1', fontWeight: 600, marginTop: 2 }}>
                      👤 {item.alreadyBought > 0
                        ? `ซื้อไปแล้ว ${item.alreadyBought}/${item.maxPerCustomer} ชิ้น/ลูกค้า`
                        : `จำกัด ${item.maxPerCustomer} ชิ้น/ลูกค้า`}
                    </div>
                  )}
                  {/* Deposit toggle — แสดงเฉพาะ preorder ที่มี depositPercent */}
                  {item.isPreorder && item.depositPercent && (() => {
                    const depositPrice = Math.round(item.price * item.depositPercent / 100 * 100) / 100
                    return (
                      <div style={{ marginTop: 5, display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => setPayFullPrice(item.id, false)}
                          style={{
                            flex: 1, padding: '3px 0', fontSize: '.62rem', fontWeight: 700,
                            borderRadius: 4, border: '1.5px solid',
                            cursor: 'pointer', transition: 'all .15s',
                            borderColor: !item.payFullPrice ? '#7c5cff' : 'var(--divider)',
                            background: !item.payFullPrice ? '#f3f0ff' : 'none',
                            color: !item.payFullPrice ? '#7c5cff' : 'var(--ink-3)',
                          }}
                        >
                          มัดจำ {item.depositPercent}%<br />
                          <span style={{ fontFamily: "'Lora', serif", fontSize: '.72rem' }}>฿{depositPrice.toLocaleString()}</span>
                        </button>
                        <button
                          onClick={() => setPayFullPrice(item.id, true)}
                          style={{
                            flex: 1, padding: '3px 0', fontSize: '.62rem', fontWeight: 700,
                            borderRadius: 4, border: '1.5px solid',
                            cursor: 'pointer', transition: 'all .15s',
                            borderColor: item.payFullPrice ? 'var(--sienna)' : 'var(--divider)',
                            background: item.payFullPrice ? 'var(--sienna-bg)' : 'none',
                            color: item.payFullPrice ? 'var(--sienna)' : 'var(--ink-3)',
                          }}
                        >
                          จ่ายเต็มราคา<br />
                          <span style={{ fontFamily: "'Lora', serif", fontSize: '.72rem' }}>฿{item.price.toLocaleString()}</span>
                        </button>
                      </div>
                    )
                  })()}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    {/* Qty stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--divider)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                      <button
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        style={{
                          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', fontWeight: 700, color: 'var(--ink-2)',
                          background: 'none', border: 'none', cursor: 'pointer', transition: 'background .15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-3)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        title="ลดจำนวน"
                      >−</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: '.78rem', fontWeight: 600, color: 'var(--ink)', padding: '0 2px' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        disabled={atCap}
                        style={{
                          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1rem', fontWeight: 700, color: atCap ? 'var(--ink-3)' : 'var(--ink-2)',
                          background: 'none', border: 'none', cursor: atCap ? 'not-allowed' : 'pointer', transition: 'background .15s',
                          opacity: atCap ? 0.4 : 1,
                        }}
                        onMouseEnter={e => { if (!atCap) e.currentTarget.style.background = 'var(--paper-3)' }}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        title={atCap ? capTitle : 'เพิ่มจำนวน'}
                      >+</button>
                    </div>
                    {/* Line total — ใช้ราคา effective (มัดจำ หรือ เต็ม) */}
                    {item.isPreorder && item.depositPercent && !item.payFullPrice ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Lora', serif", fontSize: '.9rem', fontWeight: 600, color: '#7c5cff' }}>
                          ฿{(Math.round(item.price * item.depositPercent / 100 * 100) / 100 * item.quantity).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '.62rem', color: 'var(--ink-3)', textDecoration: 'line-through' }}>
                          ฿{(item.price * item.quantity).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Lora', serif", fontSize: '.9rem', fontWeight: 600, color: 'var(--sienna)' }}>
                        ฿{(item.price * item.quantity).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ color: 'var(--ink-3)', fontSize: '.85rem', transition: 'color .18s', alignSelf: 'flex-start', padding: 2, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: remainingVal > 0 ? 6 : 12 }}>
              <span style={{ fontSize: '.85rem', color: 'var(--ink-2)' }}>
                {remainingVal > 0 ? 'ยอดชำระตอนนี้' : <><span className="en-text">Total</span><span className="th-text">ยอดรวม</span></>}
              </span>
              <span style={{ fontFamily: "'Lora', serif", fontSize: '1.3rem', fontWeight: 600, color: 'var(--sienna)' }}>
                ฿{totalVal.toLocaleString()}
              </span>
            </div>
            {remainingVal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '6px 10px', borderRadius: 'var(--r)', background: '#f3f0ff', border: '1px solid #c4b5fd' }}>
                <span style={{ fontSize: '.75rem', color: '#7c5cff', fontWeight: 600 }}>💜 ค้างชำระเมื่อของมาถึง</span>
                <span style={{ fontFamily: "'Lora', serif", fontSize: '.9rem', fontWeight: 600, color: '#7c5cff' }}>
                  ฿{remainingVal.toLocaleString()}
                </span>
              </div>
            )}
            <button onClick={goCheckout} style={{
              display: 'block', width: '100%', padding: 12, background: 'var(--ink)', color: 'var(--paper)',
              borderRadius: 'var(--r)', fontWeight: 600, fontSize: '.88rem',
              transition: 'all .18s', textAlign: 'center', border: 'none', cursor: 'pointer',
            }}>
              <span className="en-text">Proceed to Checkout →</span>
              <span className="th-text">ดำเนินการสั่งซื้อ →</span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
