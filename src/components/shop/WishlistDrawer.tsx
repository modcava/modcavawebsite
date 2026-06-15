'use client'
import type { ProductWithCategory } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  products: ProductWithCategory[]
  quantities: Record<string, number>
  alreadyBought: Record<string, number>
  onSetQty: (p: ProductWithCategory, qty: number) => void
  onRemove: (p: ProductWithCategory) => void
  onAddOne: (p: ProductWithCategory) => void
  onAddAll: () => void
  onClearAll: () => void
}

const CAT_GRADIENT: Record<string, string> = {
  'mtg-single': 'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'mtg-sealed': 'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'rb-single':  'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  'rb-sealed':  'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  paint:        'linear-gradient(145deg, #f5efea, #eaddd2)',
  'model-tools':'linear-gradient(145deg, #f5efea, #eaddd2)',
}

// ── QtyBtn helper ──────────────────────────────────────────────
function QtyBtn({ onClick, disabled, title, children }: {
  onClick: () => void
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid var(--divider)', borderRadius: 'var(--r)',
        background: disabled ? 'var(--paper-3)' : '#fff',
        color: disabled ? 'var(--ink-3)' : 'var(--ink)',
        fontSize: '.85rem', fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all .15s', lineHeight: 1, flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

export function WishlistDrawer({
  open, onClose, products, quantities, alreadyBought,
  onSetQty, onRemove, onAddOne, onAddAll, onClearAll,
}: Props) {

  // คำนวณ total qty ที่จะ add (เฉพาะที่มีสต็อก + ยังเหลือ quota)
  const totalQty = products
    .filter(p => p.stock > 0)
    .reduce((sum, p) => {
      const boughtBefore = alreadyBought[p.id] ?? 0
      const customerRemaining = p.maxPerCustomer
        ? Math.max(0, p.maxPerCustomer - boughtBefore)
        : Infinity
      const cap = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
      return sum + Math.min(quantities[p.id] ?? 1, cap)
    }, 0)

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
        position: 'fixed', top: 0, right: 0, height: '100%', width: 360,
        background: 'var(--paper)', boxShadow: '-4px 0 32px rgba(0,0,0,.13)',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(110%)',
        opacity: open ? 1 : 0,
        transition: 'all .28s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 14px', borderBottom: '1px solid var(--divider)',
        }}>
          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--ink)' }}>
            ❤️ Wishlist
            {products.length > 0 && (
              <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: '.82rem', marginLeft: 5 }}>
                ({products.length})
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {products.length > 0 && (
              <button
                onClick={() => { if (confirm('ล้าง Wishlist ทั้งหมด?')) onClearAll() }}
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
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: 'var(--ink-3)', cursor: 'pointer',
                borderRadius: 'var(--r)', background: 'none',
                border: '1.5px solid var(--divider)',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Items ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>🤍</div>
              <p style={{ fontSize: '.85rem' }}>ยังไม่มีสินค้าใน Wishlist</p>
            </div>
          ) : (
            products.map((p) => {
              const price         = typeof p.price === 'object' ? (p.price as { toNumber(): number }).toNumber() : Number(p.price)
              const outOfStock    = p.stock <= 0
              const qty           = quantities[p.id] ?? 1
              const boughtBefore  = alreadyBought[p.id] ?? 0
              const customerRemaining = p.maxPerCustomer
                ? Math.max(0, p.maxPerCustomer - boughtBefore)
                : Infinity
              const cap    = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
              const atCap  = !outOfStock && qty >= cap
              const capTitle = p.maxPerCustomer && qty >= customerRemaining
                ? `จำกัดการซื้อ ${p.maxPerCustomer} ชิ้น/ลูกค้า`
                : p.maxPerOrder && qty >= p.maxPerOrder
                ? `จำกัดการซื้อ ${p.maxPerOrder} ชิ้น/ออเดอร์`
                : `สต็อกมีเพียง ${p.stock} ชิ้น`

              return (
                <div key={p.id} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--divider)',
                  background: '#fff',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {/* Row 1: emoji + name + remove */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 'var(--r)',
                      background: CAT_GRADIENT[p.category.slug] || 'var(--paper-2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.15rem', flexShrink: 0,
                    }}>
                      {p.emoji || '🃏'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '.7rem', color: 'var(--ink-3)' }}>
                        {p.setName || p.category.name}
                        {outOfStock && (
                          <span style={{ marginLeft: 6, color: '#c0392b', fontWeight: 600 }}>หมดสต็อก</span>
                        )}
                        {!outOfStock && !!p.maxPerOrder && (
                          <span style={{ marginLeft: 6, color: 'var(--sienna)', fontWeight: 600 }}>
                            สูงสุด {p.maxPerOrder}/ออเดอร์
                          </span>
                        )}
                        {!outOfStock && !!p.maxPerCustomer && (
                          <span style={{ marginLeft: 6, color: '#6b46c1', fontWeight: 600 }}>
                            · {boughtBefore > 0
                              ? `ซื้อไปแล้ว ${boughtBefore}/${p.maxPerCustomer} ชิ้น/ลูกค้า`
                              : `จำกัด ${p.maxPerCustomer} ชิ้น/ลูกค้า`}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(p)}
                      style={{
                        fontSize: '.8rem', color: 'var(--ink-3)', cursor: 'pointer',
                        padding: '3px 6px', borderRadius: 'var(--r)',
                        background: 'none', border: 'none', lineHeight: 1, flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Row 2: price + qty controls + add button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 48 }}>
                    {/* Price */}
                    <span style={{
                      fontFamily: "'Lora', serif", fontSize: '.88rem',
                      fontWeight: 600, color: outOfStock ? 'var(--ink-3)' : 'var(--sienna)',
                      flex: 1,
                    }}>
                      {outOfStock ? '—' : `฿${(price * qty).toLocaleString()}`}
                      {!outOfStock && qty > 1 && (
                        <span style={{ fontSize: '.65rem', fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>
                          (฿{price.toLocaleString()} × {qty})
                        </span>
                      )}
                    </span>

                    {/* Qty controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <QtyBtn
                        onClick={() => onSetQty(p, qty - 1)}
                        disabled={outOfStock || qty <= 1}
                      >
                        −
                      </QtyBtn>
                      <span style={{
                        minWidth: 28, textAlign: 'center',
                        fontSize: '.82rem', fontWeight: 700, color: 'var(--ink)',
                      }}>
                        {qty}
                      </span>
                      <QtyBtn
                        onClick={() => onSetQty(p, qty + 1)}
                        disabled={outOfStock || atCap}
                        title={atCap ? capTitle : undefined}
                      >
                        +
                      </QtyBtn>
                    </div>

                    {/* Add to cart */}
                    <button
                      onClick={() => !outOfStock && onAddOne(p)}
                      disabled={outOfStock}
                      title={outOfStock ? 'หมดสต็อก' : `เพิ่มในตะกร้า ${qty} ชิ้น`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 10px', borderRadius: 'var(--r)',
                        background: outOfStock ? 'var(--paper-3)' : 'var(--sienna)',
                        color: outOfStock ? 'var(--ink-3)' : '#fff',
                        border: 'none', cursor: outOfStock ? 'not-allowed' : 'pointer',
                        fontSize: '.72rem', fontWeight: 700,
                        flexShrink: 0, transition: 'all .18s', whiteSpace: 'nowrap',
                      }}
                    >
                      🛒 ใส่ตะกร้า
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Add All footer ── */}
        {products.length > 0 && (
          <div style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--divider)' }}>
            <button
              onClick={onAddAll}
              style={{
                width: '100%', padding: '11px 14px',
                borderRadius: 'var(--r)', background: 'var(--sienna)', color: '#fff',
                fontSize: '.84rem', fontWeight: 700, cursor: 'pointer',
                border: 'none', transition: 'background .18s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              🛒 เพิ่มทั้งหมดในตะกร้า
              <span style={{ opacity: .75, fontSize: '.72rem', fontWeight: 400 }}>
                ({totalQty} ชิ้น)
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
