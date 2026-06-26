'use client'
import Link from 'next/link'
import { toast } from 'sonner'
import { useCart } from '@/store/cart'
import type { ProductWithCategory } from '@/types'
import { isComingSoon } from '@/lib/release'

// Shared visual tokens — mirror ProductCard / QuickViewModal so rail cards look
// identical to the main grid cards.
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

function toNum(price: unknown): number {
  return typeof price === 'object' && price !== null
    ? (price as { toNumber(): number }).toNumber()
    : Number(price)
}

// One compact card in a rail. Clicking the image or name navigates to the
// product page (good for discovery + internal linking); the "+" adds to cart.
function RailCard({ product }: { product: ProductWithCategory }) {
  const addItem = useCart((s) => s.addItem)

  const price        = toNum(product.price)
  const catSlug      = product.category.slug
  const comingSoon   = isComingSoon(product.releaseAt)
  const isOutOfStock = product.stock === 0
  const cannotBuy    = isOutOfStock || comingSoon
  const isCard       = catSlug === 'mtg-single' || catSlug === 'rb-single'
  const imgAspect    = isCard ? '2/3' : '1/1'
  const dep          = product.isPreorder ? (product.depositPercent ?? null) : null
  const depositPrice = dep ? Math.round(price * dep / 100 * 100) / 100 : 0
  const href         = `/products/${product.id}`

  function handleAdd() {
    if (cannotBuy) return
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
      depositPercent: product.depositPercent ?? null,
      payFullPrice:   false,
    })
    toast.success('เพิ่มลงตะกร้าแล้ว')
  }

  return (
    <div className="rail-card">
      {/* Pre-order corner tag */}
      {product.isPreorder && (
        <span style={{
          position: 'absolute', top: 6, left: 6, zIndex: 2,
          background: 'linear-gradient(135deg,#7c5cff,#4338ca)', color: '#fff',
          fontSize: '.52rem', fontWeight: 800, letterSpacing: '.08em',
          padding: '2px 6px', borderRadius: 4, pointerEvents: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,.25)',
        }}>PRE-ORDER</span>
      )}

      {/* Image → product page */}
      <Link href={href} aria-label={product.name} style={{ display: 'block' }}>
        <div style={{
          aspectRatio: imgAspect, background: CAT_GRADIENT[catSlug] || 'var(--paper-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.2rem', overflow: 'hidden',
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
      </Link>

      {/* Body */}
      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {product.isNew && <span className="badge badge-new">New</span>}
          <span className="badge" style={condBadgeStyle(product.condition)}>
            {product.condition === 'SEALED' ? 'Sealed' : product.condition}
          </span>
          {product.foil && (
            <span style={{
              padding: '1px 5px', borderRadius: 3,
              background: 'linear-gradient(120deg, #f6d365, #fda085, #c850c0, #4158d0)',
              color: '#fff', fontSize: '.55rem', fontWeight: 800, letterSpacing: '.06em',
            }}>✦ Foil</span>
          )}
        </div>

        <Link href={href} style={{
          textDecoration: 'none', fontSize: '.8rem', fontWeight: 600, color: 'var(--ink)',
          lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', minHeight: '2.1em',
        }}>
          {product.name}
        </Link>

        <div style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ minWidth: 0 }}>
            {dep ? (
              <>
                <div style={{ fontFamily: "'Lora', serif", fontSize: '.95rem', fontWeight: 600, color: '#7c5cff' }}>
                  <span style={{ fontSize: '.62rem', fontFamily: 'Inter, sans-serif', marginRight: 1, opacity: .8 }}>฿</span>
                  {depositPrice.toLocaleString()}
                </div>
                <div style={{ fontSize: '.62rem', color: 'var(--ink-3)', textDecoration: 'line-through' }}>
                  ฿{price.toLocaleString()}
                </div>
              </>
            ) : (
              <div style={{ fontFamily: "'Lora', serif", fontSize: '.95rem', fontWeight: 600, color: 'var(--sienna)' }}>
                <span style={{ fontSize: '.62rem', fontFamily: 'Inter, sans-serif', marginRight: 1, opacity: .7 }}>฿</span>
                {price.toLocaleString()}
              </div>
            )}
            {comingSoon ? (
              <div style={{ fontSize: '.6rem', color: '#4338ca', fontWeight: 700, marginTop: 2 }}>🕒 เร็วๆ นี้</div>
            ) : isOutOfStock ? (
              <div style={{ fontSize: '.6rem', color: '#b83232', fontWeight: 700, marginTop: 2 }}>สินค้าหมด</div>
            ) : product.stock <= 3 ? (
              <div style={{ fontSize: '.6rem', color: '#92610a', fontWeight: 700, marginTop: 2 }}>เหลือ {product.stock} ชิ้น!</div>
            ) : null}
          </div>

          <button
            onClick={handleAdd}
            disabled={cannotBuy}
            aria-label="เพิ่มลงตะกร้า"
            title={comingSoon ? 'ยังไม่เปิดจำหน่าย' : isOutOfStock ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}
            style={{
              width: 28, height: 28, borderRadius: 'var(--r)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: cannotBuy ? 'var(--paper-3)' : 'var(--sienna)',
              border: `1.5px solid ${cannotBuy ? 'var(--divider)' : 'var(--sienna)'}`,
              color: cannotBuy ? 'var(--ink-4)' : '#fff',
              cursor: cannotBuy ? 'not-allowed' : 'pointer', opacity: cannotBuy ? .5 : 1,
              transition: 'all .18s',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// A horizontal "shelf" of products. Renders nothing when empty so callers can
// drop it in unconditionally.
export function ProductRail({
  title, emoji, products,
}: {
  title: React.ReactNode
  emoji?: string
  products: ProductWithCategory[]
}) {
  if (!products || products.length === 0) return null
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        {emoji && <span style={{ fontSize: '1.05rem' }}>{emoji}</span>}
        <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
          {title}
        </h2>
        <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
      </div>
      <div className="product-rail">
        {products.map((p) => <RailCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}
