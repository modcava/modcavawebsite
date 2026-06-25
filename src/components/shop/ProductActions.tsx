'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCart } from '@/store/cart'
import { isComingSoon } from '@/lib/release'
import type { Condition } from '@prisma/client'

// Serializable shape passed from the server component. Price is already a plain
// number (Prisma Decimal can't cross the RSC boundary) and releaseAt is an ISO string.
export interface ProductActionsProduct {
  id: string
  name: string
  nameTh: string | null
  price: number
  stock: number
  condition: Condition
  setName: string | null
  emoji: string | null
  imageUrl: string | null
  categorySlug: string
  maxPerOrder: number | null
  maxPerCustomer: number | null
  releaseAt: string | null
  isPreorder: boolean
  depositPercent: number | null
}

const WISHLIST_KEY = 'modcava_wishlist'

function readWishlist(): string[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function ProductActions({ product }: { product: ProductActionsProduct }) {
  const router = useRouter()
  const addItem = useCart((s) => s.addItem)
  const updateQty = useCart((s) => s.updateQty)
  const [qty, setQty] = useState(1)
  const [isWished, setIsWished] = useState(false)
  const [notifying, setNotifying] = useState(false)

  const comingSoon = isComingSoon(product.releaseAt)
  const isOutOfStock = product.stock === 0

  // Cart store uses skipHydration — must rehydrate before adding, or we'd
  // overwrite the persisted cart with an empty array. (See CLAUDE.md.)
  useEffect(() => { useCart.persist.rehydrate() }, [])
  useEffect(() => { setIsWished(readWishlist().includes(product.id)) }, [product.id])

  // Most a single order can take: stock capped by maxPerOrder. Customer quota is
  // enforced by the cart store on add (we don't know alreadyBought here).
  const stockCap = product.stock || 1
  const maxQty = Math.max(1, Math.min(stockCap, product.maxPerOrder ?? stockCap))

  function handleAdd() {
    if (isOutOfStock || comingSoon) return
    addItem({
      id:             product.id,
      name:           product.name,
      nameTh:         product.nameTh || '',
      price:          product.price,
      quantity:       qty,
      stock:          product.stock,
      maxPerOrder:    product.maxPerOrder ?? null,
      maxPerCustomer: product.maxPerCustomer ?? null,
      alreadyBought:  0,
      condition:      product.condition,
      setName:        product.setName,
      emoji:          product.emoji,
      imageUrl:       product.imageUrl,
      categorySlug:   product.categorySlug,
      isPreorder:     product.isPreorder,
      depositPercent: product.depositPercent,
    })
    // addItem always inserts a new item at qty 1; set the chosen quantity
    // explicitly (mirrors AccountShell's add-with-quantity flow).
    if (qty > 1) updateQty(product.id, Math.min(qty, maxQty))
    toast.success('เพิ่มลงตะกร้าแล้ว', {
      action: { label: 'ดูตะกร้า', onClick: () => router.push('/checkout') },
    })
  }

  function toggleWish() {
    const list = readWishlist()
    const next = list.includes(product.id)
      ? list.filter((i) => i !== product.id)
      : [...list, product.id]
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(next))
    setIsWished(next.includes(product.id))
  }

  async function handleNotify() {
    if (notifying) return
    setNotifying(true)
    try {
      const res = await fetch('/api/stock-notify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ productId: product.id }),
      })
      if (res.status === 401) {
        toast.error('กรุณาเข้าสู่ระบบเพื่อรับการแจ้งเตือน')
        router.push('/login')
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(data?.error || 'ไม่สามารถรับการแจ้งเตือนได้')
        return
      }
      toast.success('เราจะแจ้งเตือนคุณทางอีเมลเมื่อสินค้าพร้อมจำหน่าย')
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setNotifying(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
      {/* Quantity stepper */}
      {!isOutOfStock && !comingSoon && (
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1}
            aria-label="ลดจำนวน"
            style={{ width: 36, height: 42, border: 'none', background: 'var(--paper-3)', cursor: qty <= 1 ? 'not-allowed' : 'pointer', fontSize: '1.2rem', color: 'var(--ink-2)', opacity: qty <= 1 ? .4 : 1 }}
          >−</button>
          <span style={{ minWidth: 38, textAlign: 'center', fontSize: '.95rem', fontWeight: 600 }}>{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty}
            aria-label="เพิ่มจำนวน"
            style={{ width: 36, height: 42, border: 'none', background: 'var(--paper-3)', cursor: qty >= maxQty ? 'not-allowed' : 'pointer', fontSize: '1.2rem', color: 'var(--ink-2)', opacity: qty >= maxQty ? .4 : 1 }}
          >+</button>
        </div>
      )}

      {comingSoon || isOutOfStock ? (
        <button
          onClick={handleNotify}
          disabled={notifying}
          style={{
            flex: 1, height: 42, borderRadius: 'var(--r)',
            border: '1.5px solid var(--sienna)',
            background: 'var(--sienna-bg)', color: 'var(--sienna)',
            fontWeight: 700, fontSize: '.9rem',
            cursor: notifying ? 'wait' : 'pointer',
          }}
        >
          🔔 {comingSoon ? 'แจ้งเตือนเมื่อวางขาย' : 'แจ้งเตือนเมื่อมีสินค้า'}
        </button>
      ) : (
        <button
          onClick={handleAdd}
          style={{
            flex: 1, height: 42, borderRadius: 'var(--r)', border: 'none',
            background: 'var(--sienna)', color: '#fff',
            fontWeight: 600, fontSize: '.9rem', cursor: 'pointer',
          }}
        >
          เพิ่มลงตะกร้า
        </button>
      )}

      {/* Wishlist */}
      <button
        onClick={toggleWish}
        aria-label="เพิ่มในรายการที่อยากได้"
        style={{
          width: 42, height: 42, borderRadius: 'var(--r)', flexShrink: 0,
          border: '1.5px solid var(--divider)', background: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isWished ? '#e05a7a' : 'var(--ink-4)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" fill={isWished ? 'currentColor' : 'none'}>
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
        </svg>
      </button>
    </div>
  )
}
