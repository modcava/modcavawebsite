import { cache } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ProductActions } from '@/components/shop/ProductActions'
import { isComingSoon, formatReleaseDate } from '@/lib/release'
import { formatDomains } from '@/lib/domains'

// ISR: แคชหน้าไว้ 60 วิ (เร็วขึ้น + ลดภาระ DB) — สต็อก/ราคาอาจช้าได้สูงสุด 60 วิ
// แต่ตอนหยิบลงตะกร้า/เช็คเอาต์มีการตรวจสต็อกจริงอีกชั้น
export const revalidate = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://modcava.com'

const CAT_GRADIENT: Record<string, string> = {
  'mtg-single':  'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'mtg-sealed':  'linear-gradient(145deg, #ede8f5, #d8cff0)',
  'rb-single':   'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  'rb-sealed':   'linear-gradient(145deg, #e8f2f0, #d0e8e4)',
  paint:         'linear-gradient(145deg, #f5efea, #eaddd2)',
  'model-tools': 'linear-gradient(145deg, #f5efea, #eaddd2)',
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

// Dedupe the DB hit between generateMetadata and the page render in one request.
const getProduct = cache(async (id: string) =>
  prisma.product.findUnique({ where: { id, isActive: true }, include: { category: true } }),
)

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await getProduct(params.id)
  if (!product) return { title: 'ไม่พบสินค้า', robots: { index: false, follow: false } }

  const price = toNum(product.price)
  const title = [product.name, product.nameTh].filter(Boolean).join(' / ')
  const description =
    product.description?.replace(/\s+/g, ' ').trim().slice(0, 160) ||
    `${product.name}${product.setName ? ` (${product.setName})` : ''} ราคา ฿${price.toLocaleString()} — สั่งซื้อออนไลน์ที่ Modcava ร้านการ์ด MTG, Riftbound และอุปกรณ์ทาสีโมเดล`
  const url = `${APP_URL}/products/${product.id}`
  const image = product.imageUrl || '/logo.png'

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website', url, siteName: 'Modcava',
      title: `${title} | Modcava`, description,
      images: [{ url: image, alt: product.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Modcava`, description, images: [image],
    },
  }
}

// Labelled detail row — only rendered when the value is present.
function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: '.85rem', lineHeight: 1.6 }}>
      <span style={{ color: 'var(--ink-3)', minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  if (!product) notFound()

  const price = toNum(product.price)
  const catSlug = product.category.slug
  const comingSoon = isComingSoon(product.releaseAt)
  const isOutOfStock = product.stock === 0
  const badgeStyle = condBadgeStyle(product.condition)

  const availability = comingSoon
    ? 'https://schema.org/PreOrder'
    : isOutOfStock
      ? 'https://schema.org/OutOfStock'
      : 'https://schema.org/InStock'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name,
        ...(product.nameTh ? { alternateName: product.nameTh } : {}),
        ...(product.description ? { description: product.description } : {}),
        ...(product.imageUrl ? { image: product.imageUrl } : {}),
        ...(product.sku ? { sku: product.sku } : {}),
        ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
        category: product.category.name,
        offers: {
          '@type': 'Offer',
          price: price.toFixed(2),
          priceCurrency: 'THB',
          availability,
          url: `${APP_URL}/products/${product.id}`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: APP_URL },
          { '@type': 'ListItem', position: 2, name: product.category.name, item: `${APP_URL}/?cat=${catSlug}` },
          { '@type': 'ListItem', position: 3, name: product.name },
        ],
      },
    ],
  }

  return (
    <>
      <Header />
      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', padding: '20px 24px 48px', width: '100%' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginBottom: 18, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>หน้าแรก</Link>
          <span>›</span>
          <Link href={`/?cat=${catSlug}`} style={{ color: 'var(--ink-3)', textDecoration: 'none' }}>{product.category.name}</Link>
          <span>›</span>
          <span style={{ color: 'var(--ink-2)' }}>{product.name}</span>
        </nav>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Image */}
          <div style={{
            flex: '1 1 320px', minWidth: 280, maxWidth: 420,
            aspectRatio: '2/3', borderRadius: 'var(--r-lg)', overflow: 'hidden',
            background: CAT_GRADIENT[catSlug] || 'var(--paper-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7rem',
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
          <div style={{ flex: '1 1 340px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.6rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, margin: 0 }}>
                {product.name}
              </h1>
              {product.nameTh && (
                <div style={{ fontSize: '.95rem', color: 'var(--ink-3)', marginTop: 4 }}>{product.nameTh}</div>
              )}
            </div>

            {/* Type-specific details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
              <Detail label="ประเภท" value={product.cardType} />
              <Detail label="Rarity" value={product.rarity} />
              <Detail label="Collector #" value={product.collectorNumber} />
              <Detail label="Type" value={product.rbType} />
              <Detail label="Chapter" value={product.chapter} />
              <Detail label="Domain" value={formatDomains(product.domain)} />
              <Detail label="Rarity" value={product.rbRarity} />
              <Detail label="Product Type" value={product.sealedCat || product.rbSealedCat || product.productType} />
              <Detail label="Brand" value={product.brand} />
              <Detail label="หมวด" value={product.paintCat} />
              <Detail label="Color Family" value={product.colorFamily} />
              <Detail label="Finish" value={product.finish} />
              <Detail label="ขนาด" value={product.size ? `${product.size} ml` : null} />
              <Detail label="หมวด" value={product.airbrushCat} />
              <Detail label="Nozzle" value={product.nozzle} />
              <Detail label="Feed Type" value={product.feedType} />
              <Detail label="ใช้ได้กับ" value={product.compatibleWith} />
              <Detail label="ภาษา" value={product.language} />
            </div>

            {/* Description */}
            {product.description && (
              <div style={{
                fontSize: '.88rem', color: 'var(--ink-2)', lineHeight: 1.7,
                background: 'var(--paper-2)', border: '1px solid var(--divider)',
                borderRadius: 'var(--r)', padding: '12px 14px', whiteSpace: 'pre-wrap',
              }}>
                {product.description}
              </div>
            )}

            {/* Price + stock */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontFamily: "'Lora', serif", fontSize: '2rem', fontWeight: 700, color: 'var(--sienna)' }}>
                <span style={{ fontSize: '1rem', fontFamily: 'Inter, sans-serif', marginRight: 2, opacity: .7 }}>฿</span>
                {price.toLocaleString()}
              </div>
              {comingSoon ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 5, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', fontSize: '.78rem', fontWeight: 700, marginTop: 6 }}>
                  🕒 เร็วๆ นี้ · วางขาย {formatReleaseDate(product.releaseAt)}
                </div>
              ) : (
                <div style={{ fontSize: '.82rem', color: isOutOfStock ? '#b83232' : 'var(--ink-3)', marginTop: 4, fontWeight: isOutOfStock ? 700 : 400 }}>
                  {isOutOfStock ? 'สินค้าหมด' : `มีสินค้า ${product.stock} ชิ้น`}
                </div>
              )}
              {/* Purchase limits */}
              {(!!product.maxPerOrder || !!product.maxPerCustomer) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {!!product.maxPerOrder && (
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: 'var(--sienna-bg)', border: '1px solid rgba(184,92,42,.25)', fontSize: '.68rem', fontWeight: 700, color: 'var(--sienna)' }}>
                      🛒 สูงสุด {product.maxPerOrder}/ออเดอร์
                    </span>
                  )}
                  {!!product.maxPerCustomer && (
                    <span style={{ padding: '2px 7px', borderRadius: 4, background: '#ede8f5', border: '1px solid rgba(107,70,193,.2)', fontSize: '.68rem', fontWeight: 700, color: '#6b46c1' }}>
                      👤 สูงสุด {product.maxPerCustomer}/คน
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Interactive actions (client island) */}
            <ProductActions
              product={{
                id:             product.id,
                name:           product.name,
                nameTh:         product.nameTh,
                price,
                stock:          product.stock,
                condition:      product.condition,
                setName:        product.setName,
                emoji:          product.emoji,
                imageUrl:       product.imageUrl,
                categorySlug:   catSlug,
                maxPerOrder:    product.maxPerOrder ?? null,
                maxPerCustomer: product.maxPerCustomer ?? null,
                releaseAt:      product.releaseAt ? product.releaseAt.toISOString() : null,
              }}
            />

            <Link href="/" style={{ fontSize: '.82rem', color: 'var(--sienna)', textDecoration: 'none', marginTop: 4 }}>
              ← เลือกซื้อสินค้าอื่น
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
