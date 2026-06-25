'use client'
import { useState, useEffect } from 'react'
import { useCart } from '@/store/cart'
import type { ProductWithCategory } from '@/types'
import { isComingSoon, formatReleaseDate, countdownTo } from '@/lib/release'
import { formatDomains } from '@/lib/domains'

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
  onNotify?: () => void
  onClose: () => void
}

// A labelled detail row, only rendered when the value is present.
function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: '.8rem', lineHeight: 1.5 }}>
      <span style={{ color: 'var(--ink-3)', minWidth: 92, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export function QuickViewModal({ product, isWished, onToggleWish, onNotify, onClose }: Props) {
  const addItem = useCart((s) => s.addItem)
  const [qty, setQty] = useState(1)

  const price = typeof product.price === 'object' ? (product.price as { toNumber(): number }).toNumber() : Number(product.price)
  const catSlug = product.category.slug
  const comingSoon = isComingSoon(product.releaseAt)
  const isOutOfStock = product.stock === 0
  const badgeStyle = condBadgeStyle(product.condition)

  // The most a single order can take for this product (stock + maxPerOrder cap)
  const stockCap = product.stock || 1
  const maxQty = Math.max(1, Math.min(stockCap, product.maxPerOrder ?? stockCap))

  // Live countdown — re-render every second while the product is still "coming soon"
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!comingSoon) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [comingSoon])
  const countdown = countdownTo(product.releaseAt, now)

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleAdd() {
    if (isOutOfStock || comingSoon) return
    addItem({
      id:             product.id,
      name:           product.name,
      nameTh:         product.nameTh || '',
      price,
      quantity:       qty,
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
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(20,16,12,.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 'var(--r-lg)', overflow: 'hidden',
          width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 70px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header with close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px 0' }}>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'var(--paper-3)', color: 'var(--ink-2)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', gap: 22, padding: '4px 24px 24px', flexWrap: 'wrap' }}>
          {/* Large image */}
          <div style={{
            flex: '1 1 240px', minWidth: 220, maxWidth: 300,
            aspectRatio: '2/3', borderRadius: 'var(--r)', overflow: 'hidden',
            background: CAT_GRADIENT[catSlug] || 'var(--paper-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem',
          }}>
            {product.imageUrl ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{
                    width: '100%', height: '100%', objectFit: 'contain',
                    ...(product.foil ? { filter: 'brightness(1.08) contrast(1.05) saturate(1.3)' } : {}),
                  }}
                />
                {product.foil && (
                  <div className="foil-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
                )}
              </div>
            ) : (
              <span>{product.emoji || '🃏'}</span>
            )}
          </div>

          {/* Details */}
          <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {product.isNew && <span className="badge badge-new">New</span>}
              <span className="badge" style={badgeStyle}>
                {product.condition === 'SEALED' ? 'Sealed' : product.condition}
              </span>
              {product.foil && (
                <span style={{
                  padding: '2px 6px', borderRadius: 4,
                  background: 'linear-gradient(120deg, #f6d365, #fda085, #c850c0, #4158d0)',
                  color: '#fff', fontSize: '.6rem', fontWeight: 800,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                }}>✦ Foil</span>
              )}
              {(product.setCode || product.setName) && (
                <span className="tag" style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '.06em', fontWeight: 600 }}>
                  {product.setCode || product.setName}
                </span>
              )}
            </div>

            {/* Name */}
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, margin: 0 }}>
                {product.name}
              </h2>
              {product.nameTh && (
                <div style={{ fontSize: '.85rem', color: 'var(--ink-3)', marginTop: 2 }}>{product.nameTh}</div>
              )}
            </div>

            {/* Type-specific details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
              {/* MTG */}
              <Detail label="ประเภท" value={product.cardType} />
              <Detail label="Rarity" value={product.rarity} />
              <Detail label="Collector #" value={product.collectorNumber} />
              {/* Riftbound */}
              <Detail label="Type" value={product.rbType} />
              <Detail label="Chapter" value={product.chapter} />
              <Detail label="Domain" value={formatDomains(product.domain)} />
              <Detail label="Rarity" value={product.rbRarity} />
              {/* Sealed */}
              <Detail label="Product Type" value={product.sealedCat || product.rbSealedCat || product.productType} />
              {/* Paint */}
              <Detail label="Brand" value={product.brand} />
              <Detail label="หมวด" value={product.paintCat} />
              <Detail label="Color Family" value={product.colorFamily} />
              <Detail label="Finish" value={product.finish} />
              <Detail label="ขนาด" value={product.size ? `${product.size} ml` : null} />
              {/* Airbrush */}
              <Detail label="หมวด" value={product.airbrushCat} />
              <Detail label="Nozzle" value={product.nozzle} />
              <Detail label="Feed Type" value={product.feedType} />
              <Detail label="ใช้ได้กับ" value={product.compatibleWith} />
              <Detail label="ภาษา" value={product.language} />
            </div>

            {/* Description */}
            {product.description && (
              <div style={{
                fontSize: '.82rem', color: 'var(--ink-2)', lineHeight: 1.6,
                background: 'var(--paper-2)', border: '1px solid var(--divider)',
                borderRadius: 'var(--r)', padding: '10px 12px', whiteSpace: 'pre-wrap',
              }}>
                {product.description}
              </div>
            )}

            {/* Price + stock */}
            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
              <div style={{ fontFamily: "'Lora', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--sienna)' }}>
                <span style={{ fontSize: '.9rem', fontFamily: 'Inter, sans-serif', marginRight: 2, opacity: .7 }}>฿</span>
                {price.toLocaleString()}
              </div>
              {comingSoon ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 5, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: '.72rem', fontWeight: 700 }}>
                    🕒 เร็วๆ นี้ · วางขาย {formatReleaseDate(product.releaseAt)}
                  </div>
                  {countdown && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {([['วัน', countdown.days], ['ชม.', countdown.hours], ['นาที', countdown.minutes], ['วิ', countdown.seconds]] as const).map(([label, val]) => (
                        <div key={label} style={{ minWidth: 46, textAlign: 'center', background: 'var(--paper-2)', border: '1px solid var(--divider)', borderRadius: 'var(--r)', padding: '6px 4px' }}>
                          <div style={{ fontFamily: "'Lora', serif", fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>{String(val).padStart(2, '0')}</div>
                          <div style={{ fontSize: '.6rem', color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '.75rem', color: isOutOfStock ? '#b83232' : 'var(--ink-3)', marginTop: 3, fontWeight: isOutOfStock ? 700 : 400 }}>
                  {isOutOfStock ? 'สินค้าหมด' : `มีสินค้า ${product.stock} ชิ้น`}
                </div>
              )}
              {/* Purchase limits */}
              {(!!product.maxPerOrder || !!product.maxPerCustomer) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {!!product.maxPerOrder && (
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.25)', fontSize: '.65rem', fontWeight: 700, color: 'var(--sienna)' }}>
                      🛒 สูงสุด {product.maxPerOrder}/ออเดอร์
                    </span>
                  )}
                  {!!product.maxPerCustomer && (
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: '#ede8f5', border: '1px solid rgba(107,70,193,.2)', fontSize: '.65rem', fontWeight: 700, color: '#6b46c1' }}>
                      👤 สูงสุด {product.maxPerCustomer}/คน
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              {/* Quantity stepper */}
              {!isOutOfStock && !comingSoon && (
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    style={{ width: 32, height: 38, border: 'none', background: 'var(--paper-3)', cursor: qty <= 1 ? 'not-allowed' : 'pointer', fontSize: '1.1rem', color: 'var(--ink-2)', opacity: qty <= 1 ? .4 : 1 }}
                  >−</button>
                  <span style={{ minWidth: 34, textAlign: 'center', fontSize: '.9rem', fontWeight: 600 }}>{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    disabled={qty >= maxQty}
                    style={{ width: 32, height: 38, border: 'none', background: 'var(--paper-3)', cursor: qty >= maxQty ? 'not-allowed' : 'pointer', fontSize: '1.1rem', color: 'var(--ink-2)', opacity: qty >= maxQty ? .4 : 1 }}
                  >+</button>
                </div>
              )}
              {comingSoon ? (
                <button
                  onClick={() => onNotify?.()}
                  disabled={!onNotify}
                  style={{
                    flex: 1, height: 38, borderRadius: 'var(--r)',
                    border: '1.5px solid var(--sienna)',
                    background: 'var(--sienna-bg)', color: 'var(--sienna)',
                    fontWeight: 700, fontSize: '.85rem',
                    cursor: onNotify ? 'pointer' : 'not-allowed',
                  }}
                >
                  🔔 แจ้งเตือนเมื่อวางขาย
                </button>
              ) : isOutOfStock ? (
                <button
                  onClick={() => onNotify?.()}
                  disabled={!onNotify}
                  style={{
                    flex: 1, height: 38, borderRadius: 'var(--r)',
                    border: '1.5px solid var(--sienna)',
                    background: 'var(--sienna-bg)', color: 'var(--sienna)',
                    fontWeight: 700, fontSize: '.85rem',
                    cursor: onNotify ? 'pointer' : 'not-allowed',
                  }}
                >
                  🔔 แจ้งเตือนเมื่อมีสินค้า
                </button>
              ) : (
                <button
                  onClick={handleAdd}
                  style={{
                    flex: 1, height: 38, borderRadius: 'var(--r)', border: 'none',
                    background: 'var(--sienna)', color: '#fff',
                    fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
                  }}
                >
                  เพิ่มลงตะกร้า
                </button>
              )}
              {/* Wishlist */}
              <button
                onClick={onToggleWish}
                aria-label="Add to wishlist"
                style={{
                  width: 38, height: 38, borderRadius: 'var(--r)', flexShrink: 0,
                  border: '1.5px solid var(--divider)', background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isWished ? '#e05a7a' : 'var(--ink-4)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill={isWished ? 'currentColor' : 'none'}>
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
