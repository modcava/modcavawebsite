'use client'
import { useCart } from '@/store/cart'
import type { ProductWithCategory } from '@/types'
import { isComingSoon, formatReleaseDate } from '@/lib/release'
import { parseDomains } from '@/lib/domains'

const CAT_GRADIENT: Record<string, string> = {
  'mtg-single': 'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'mtg-sealed': 'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'rb-single':  'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  'rb-sealed':  'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  paint:        'linear-gradient(145deg, #f5efea, #eaddd2)',
  'model-tools':'linear-gradient(145deg, #f5efea, #eaddd2)',
}

function condBadgeStyle(cond: string): { background: string; color: string } {
  const map: Record<string, { background: string; color: string }> = {
    NM:     { background: '#e6f5ea', color: '#2d7a42' },
    LP:     { background: '#e8f0fb', color: '#2855a0' },
    MP:     { background: '#fdf4e3', color: '#8a5e10' },
    HP:     { background: '#fde8e8', color: '#a02828' },
    DMG:    { background: '#fce8ec', color: '#952030' },
    SEALED: { background: 'var(--sienna-bg)', color: 'var(--sienna)' },
  }
  return map[cond] || map.LP
}

interface Props {
  product: ProductWithCategory
  isWished: boolean
  onToggleWish: () => void
  onQuickView?: () => void
  onNotify?: () => void
}

export function ProductCard({ product, isWished, onToggleWish, onQuickView, onNotify }: Props) {
  const addItem = useCart((s) => s.addItem)
  const comingSoon = isComingSoon(product.releaseAt)
  const isOutOfStock = product.stock === 0
  const cannotBuy = isOutOfStock || comingSoon  // out of stock OR not yet released
  const price = typeof product.price === 'object' ? (product.price as { toNumber(): number }).toNumber() : Number(product.price)
  const catSlug = product.category.slug
  const badgeStyle = condBadgeStyle(product.condition)
  // Trading cards are portrait (2:3); paints/tools/sealed photos look better in a
  // square frame so they fill the box instead of floating in tall empty margins.
  const isCard = catSlug === 'mtg-single' || catSlug === 'rb-single'
  const imgAspect = isCard ? '2/3' : '1/1'

  function handleAdd() {
    if (isOutOfStock || comingSoon) return
    addItem({
      id:             product.id,
      name:           product.name,
      nameTh:         product.nameTh || '',
      price,
      quantity:       1,
      stock:          product.stock,
      maxPerOrder:    product.maxPerOrder ?? null,
      maxPerCustomer: product.maxPerCustomer ?? null,
      alreadyBought:  0,
      condition:      product.condition,
      setName:        product.setName,
      emoji:          product.emoji,
      imageUrl:       product.imageUrl,
      categorySlug:   catSlug,
      isPreorder:     product.isPreorder ?? false,
      depositPercent: (product as { depositPercent?: number | null }).depositPercent ?? null,
    })
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid var(--divider)',
      borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'relative',
      transition: 'all .22s', display: 'flex', flexDirection: 'column',
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget
      el.style.borderColor = 'var(--sienna)'
      el.style.boxShadow = '0 6px 24px rgba(184,92,42,.1)'
      el.style.transform = 'translateY(-2px)'
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget
      el.style.borderColor = 'var(--divider)'
      el.style.boxShadow = 'none'
      el.style.transform = 'translateY(0)'
    }}>
      {/* Pre-order corner ribbon — ซื้อได้ก่อน ส่งภายหลัง (ไม่บล็อกการซื้อ) */}
      {product.isPreorder && (
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: 96, height: 96, overflow: 'hidden', zIndex: 2, pointerEvents: 'none' }}>
          <span style={{
            position: 'absolute', left: -34, top: 16, width: 140,
            transform: 'rotate(-45deg)', textAlign: 'center', padding: '4px 0',
            background: 'linear-gradient(135deg, #7c5cff, #4338ca)', color: '#fff',
            fontSize: '.56rem', fontWeight: 800, letterSpacing: '.12em',
            boxShadow: '0 2px 6px rgba(0,0,0,.28)',
          }}>
            PRE-ORDER
          </span>
        </div>
      )}

      {/* Image area — click to open quick view */}
      <div
        onClick={onQuickView}
        style={{ aspectRatio: imgAspect, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: onQuickView ? 'pointer' : 'default' }}
      >
        <div style={{
          width: '100%', height: '100%',
          background: CAT_GRADIENT[catSlug] || 'var(--paper-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.6rem',
        }}>
          {product.imageUrl ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.name}
                loading="lazy"
                decoding="async"
                style={{
                  width: '100%', height: '100%', objectFit: 'contain',
                  ...(product.foil ? {
                    filter: 'brightness(1.08) contrast(1.05) saturate(1.3)',
                  } : {}),
                }}
              />
              {product.foil && (
                <div className="foil-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 2 }} />
              )}
            </div>
          ) : (
            <span>{product.emoji || '🃏'}</span>
          )}
        </div>
      </div>

      {/* Badges + Wishlist row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderTop: '1px solid var(--divider)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {product.isNew && (
            <span className="badge badge-new">New</span>
          )}
          <span className="badge" style={badgeStyle}>
            {product.condition === 'SEALED' ? 'Sealed' : product.condition}
          </span>
          {product.foil && (
            <span style={{
              padding: '2px 6px', borderRadius: 4,
              background: 'linear-gradient(120deg, #f6d365, #fda085, #c850c0, #4158d0)',
              color: '#fff', fontSize: '.6rem', fontWeight: 800,
              letterSpacing: '.08em', textTransform: 'uppercase',
              boxShadow: '0 1px 6px rgba(0,0,0,.25)',
              lineHeight: 1.5,
            }}>
              ✦ Foil
            </span>
          )}
        </div>
        {/* Wishlist heart */}
        <button
          onClick={onToggleWish}
          title="Add to wishlist"
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', border: 'none', transition: 'all .18s',
            color: isWished ? '#e05a7a' : 'var(--ink-4)',
            flexShrink: 0,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill={isWished ? 'currentColor' : 'none'}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '11px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div
          onClick={onQuickView}
          style={{ fontSize: '.86rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', cursor: onQuickView ? 'pointer' : 'default' }}
        >
          <span className="en-text">{product.name}</span>
          <span className="th-text">{product.nameTh || product.name}</span>
          {(product.setCode || product.setName) && (
            <span className="tag" style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 600, flexShrink: 0 }}>
              {product.setCode || product.setName}
            </span>
          )}
        </div>
        {product.nameTh && (
          <div style={{ fontSize: '.73rem', color: 'var(--ink-3)' }} className="en-text">{product.nameTh}</div>
        )}
        {/* MTG card type */}
        {product.cardType && (
          <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', fontStyle: 'italic' }}>{product.cardType}</div>
        )}

        {/* Riftbound Singles details */}
        {product.rbType && (
          <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', fontStyle: 'italic' }}>{product.rbType}</div>
        )}
        {(product.chapter || product.domain || product.rbRarity) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
            {product.chapter && (
              <span style={{ fontSize: '.65rem', color: 'var(--ink-3)', background: 'var(--paper-3)', border: '1px solid var(--divider)', borderRadius: 4, padding: '1px 6px' }}>
                {product.chapter}
              </span>
            )}
            {parseDomains(product.domain).map((d) => (
              <span key={d} style={{ fontSize: '.65rem', color: '#fff', background: '#6b46c1', borderRadius: 4, padding: '1px 6px' }}>
                {d}
              </span>
            ))}
            {product.rbRarity && (
              <span style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--sienna)', background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.25)', borderRadius: 4, padding: '1px 6px' }}>
                {product.rbRarity}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: '1rem', fontWeight: 600, color: 'var(--sienna)' }}>
              <span style={{ fontSize: '.72rem', fontFamily: 'Inter, sans-serif', marginRight: 1, opacity: .7 }}>฿</span>
              {price.toLocaleString()}
            </div>
            {comingSoon ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, marginTop: 4 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px',
                  background: '#eef2ff', border: '1px solid #c7d2fe',
                  borderRadius: 4, fontSize: '.65rem', fontWeight: 700,
                  color: '#4338ca', letterSpacing: '.02em',
                }}>
                  🕒 เร็วๆ นี้
                </div>
                <div style={{ fontSize: '.62rem', color: 'var(--ink-3)' }}>
                  วางขาย {formatReleaseDate(product.releaseAt)}
                </div>
                {onNotify && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onNotify() }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 5,
                      background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.3)',
                      color: 'var(--sienna)', fontSize: '.66rem', fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    🔔 แจ้งเตือนเมื่อวางขาย
                  </button>
                )}
              </div>
            ) : product.stock === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, marginTop: 4 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 7px',
                  background: '#fde8e8', border: '1px solid #f5b8b8',
                  borderRadius: 4, fontSize: '.65rem', fontWeight: 700,
                  color: '#b83232', letterSpacing: '.02em',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#b83232', flexShrink: 0 }} />
                  Out of stock
                </div>
                {onNotify && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onNotify() }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 5,
                      background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.3)',
                      color: 'var(--sienna)', fontSize: '.66rem', fontWeight: 700,
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    🔔 แจ้งเตือนเมื่อมีสินค้า
                  </button>
                )}
              </div>
            ) : product.stock <= 3 ? (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 4, padding: '2px 7px',
                background: '#fff3cd', border: '1px solid #ffc107',
                borderRadius: 4, fontSize: '.65rem', fontWeight: 700,
                color: '#92610a', letterSpacing: '.02em',
                animation: 'pulse-badge 2s ease-in-out infinite',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e6900a', flexShrink: 0 }} />
                เหลือ {product.stock} ชิ้น!
              </div>
            ) : (
              <div style={{ fontSize: '.68rem', color: 'var(--ink-3)', marginTop: 2 }}>
                {product.stock} in stock
              </div>
            )}
            {/* Purchase limit badges */}
            {(!!product.maxPerOrder || !!product.maxPerCustomer) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                {!!product.maxPerOrder && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px', borderRadius: 4,
                    background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.25)',
                    fontSize: '.6rem', fontWeight: 700, color: 'var(--sienna)',
                    letterSpacing: '.01em', whiteSpace: 'nowrap',
                  }}>
                    🛒 สูงสุด {product.maxPerOrder}/ออเดอร์
                  </span>
                )}
                {!!product.maxPerCustomer && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px', borderRadius: 4,
                    background: '#ede8f5', border: '1px solid rgba(107,70,193,.2)',
                    fontSize: '.6rem', fontWeight: 700, color: '#6b46c1',
                    letterSpacing: '.01em', whiteSpace: 'nowrap',
                  }}>
                    👤 สูงสุด {product.maxPerCustomer}/คน
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleAdd}
            disabled={cannotBuy}
            title={comingSoon ? 'ยังไม่เปิดจำหน่าย' : undefined}
            style={{
              width: 30, height: 30, borderRadius: 'var(--r)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--paper-3)', border: '1.5px solid var(--divider)',
              color: 'var(--ink-2)', flexShrink: 0, transition: 'all .18s',
              cursor: cannotBuy ? 'not-allowed' : 'pointer',
              opacity: cannotBuy ? .3 : 1,
            }}
            onMouseEnter={(e) => {
              if (!cannotBuy) {
                const el = e.currentTarget
                el.style.background = 'var(--sienna)'
                el.style.borderColor = 'var(--sienna)'
                el.style.color = '#fff'
              }
            }}
            onMouseLeave={(e) => {
              if (!cannotBuy) {
                const el = e.currentTarget
                el.style.background = 'var(--paper-3)'
                el.style.borderColor = 'var(--divider)'
                el.style.color = 'var(--ink-2)'
              }
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
