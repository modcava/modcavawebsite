'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useCart } from '@/store/cart'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { WishlistDrawer } from '@/components/shop/WishlistDrawer'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import type { ProductWithCategory } from '@/types'

function safeParse<T>(str: string | null, fallback: T): T {
  try { return str ? JSON.parse(str) : fallback } catch { return fallback }
}

export function AccountShell({ children }: { children: React.ReactNode }) {
  const cart = useCart()
  const [cartOpen,     setCartOpen]     = useState(false)
  const [wishOpen,     setWishOpen]     = useState(false)
  const [wishlist,     setWishlist]     = useState<string[]>([])
  const [wishlistQty,  setWishlistQty]  = useState<Record<string, number>>({})
  const [wishProducts, setWishProducts] = useState<ProductWithCategory[]>([])
  const [alreadyBought, setAlreadyBought] = useState<Record<string, number>>({})

  useEffect(() => { useCart.persist.rehydrate() }, [])

  useEffect(() => {
    setWishlist(safeParse(localStorage.getItem('modcava_wishlist'), []))
    setWishlistQty(safeParse(localStorage.getItem('modcava_wishlist_qty'), {}))
  }, [])

  useEffect(() => {
    if (wishlist.length === 0) { setWishProducts([]); return }
    fetch(`/api/products?ids=${wishlist.join(',')}&pageSize=100`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setWishProducts(d?.data || []))
      .catch(() => {})
  }, [wishlist])

  async function openCart() {
    const ids = useCart.getState().items.map((i) => i.id)
    if (ids.length > 0) {
      try {
        const idsParam = ids.join(',')
        const [productsRes, historyRes] = await Promise.all([
          fetch(`/api/products?ids=${idsParam}&pageSize=100`),
          fetch(`/api/user/purchase-history?productIds=${idsParam}`),
        ])
        const productsData = productsRes.ok ? await productsRes.json() : null
        const historyData  = historyRes.ok  ? await historyRes.json()  : null
        const boughtMap: Record<string, number> = historyData?.data ?? {}
        if (productsData?.data) {
          useCart.getState().syncProducts(
            (productsData.data as ProductWithCategory[]).map((p) => ({
              id:             p.id,
              stock:          p.stock,
              maxPerOrder:    p.maxPerOrder ?? null,
              maxPerCustomer: p.maxPerCustomer ?? null,
              alreadyBought:  boughtMap[p.id] ?? 0,
              isPreorder:     p.isPreorder ?? false,
              depositPercent: p.depositPercent ?? null,
            }))
          )
        }
      } catch {}
    }
    useCart.getState().validateLimits()
    setCartOpen(true)
  }

  function addProductToCart(p: ProductWithCategory, qty = 1) {
    const price = typeof p.price === 'object' ? (p.price as { toNumber(): number }).toNumber() : Number(p.price)
    const boughtBefore      = alreadyBought[p.id] ?? 0
    const customerRemaining = p.maxPerCustomer ? Math.max(0, p.maxPerCustomer - boughtBefore) : Infinity
    cart.addItem({
      id: p.id, name: p.name, nameTh: p.nameTh || '',
      price, quantity: 1, stock: p.stock,
      maxPerOrder:    p.maxPerOrder ?? null,
      maxPerCustomer: p.maxPerCustomer ?? null,
      alreadyBought:  boughtBefore,
      condition: p.condition, setName: p.setName ?? null,
      emoji: p.emoji ?? null, imageUrl: p.imageUrl ?? null,
      categorySlug: p.category.slug,
      isPreorder:     p.isPreorder ?? false,
      depositPercent: p.depositPercent ?? null,
    })
    if (qty > 1) {
      const cap = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
      cart.updateQty(p.id, Math.min(qty, cap))
    }
  }

  function removeFromWishlist(id: string) {
    const next = wishlist.filter(i => i !== id)
    setWishlist(next)
    localStorage.setItem('modcava_wishlist', JSON.stringify(next))
  }

  function setWishQty(p: ProductWithCategory, qty: number) {
    const boughtBefore      = alreadyBought[p.id] ?? 0
    const customerRemaining = p.maxPerCustomer ? Math.max(0, p.maxPerCustomer - boughtBefore) : Infinity
    const cap = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
    if (qty < 1 || qty > cap) return
    const next = { ...wishlistQty, [p.id]: qty }
    setWishlistQty(next)
    localStorage.setItem('modcava_wishlist_qty', JSON.stringify(next))
  }

  function addOneFromWishlist(p: ProductWithCategory) {
    if (p.stock <= 0) return
    addProductToCart(p, wishlistQty[p.id] ?? 1)
    removeFromWishlist(p.id)
  }

  function addAllFromWishlist() {
    const inStock    = wishProducts.filter(p => p.stock > 0)
    const outOfStock = wishProducts.filter(p => p.stock <= 0)
    inStock.forEach(p => addProductToCart(p, wishlistQty[p.id] ?? 1))
    const remaining = outOfStock.map(p => p.id)
    setWishlist(remaining)
    localStorage.setItem('modcava_wishlist', JSON.stringify(remaining))
    const nextQty = { ...wishlistQty }
    inStock.forEach(p => delete nextQty[p.id])
    setWishlistQty(nextQty)
    localStorage.setItem('modcava_wishlist_qty', JSON.stringify(nextQty))
  }

  function clearAllWishlist() {
    setWishlist([])
    setWishlistQty({})
    localStorage.removeItem('modcava_wishlist')
    localStorage.removeItem('modcava_wishlist_qty')
  }

  // Clamp wishlist qty ถ้าเกิน cap (stock, maxPerOrder, customer remaining quota)
  function validateWishlistLimits(boughtMap: Record<string, number> = alreadyBought) {
    type Fix = { id: string; name: string; from: number; to: number }
    const fixes: Fix[] = []
    for (const p of wishProducts) {
      if (p.stock <= 0) continue
      const boughtBefore      = boughtMap[p.id] ?? 0
      const customerRemaining = p.maxPerCustomer ? Math.max(0, p.maxPerCustomer - boughtBefore) : Infinity
      const cap               = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
      const current           = wishlistQty[p.id] ?? 1
      if (current > cap) fixes.push({ id: p.id, name: p.name, from: current, to: Math.max(1, cap) })
    }
    if (fixes.length === 0) return
    setWishlistQty((prev) => {
      const next = { ...prev }
      fixes.forEach((f) => { next[f.id] = f.to })
      localStorage.setItem('modcava_wishlist_qty', JSON.stringify(next))
      return next
    })
    const label = fixes.length === 1
      ? `"${fixes[0].name}" ปรับจาก ${fixes[0].from} → ${fixes[0].to} ชิ้น (เกินลิมิต)`
      : `ปรับ ${fixes.length} รายการใน Wishlist ที่เกินลิมิต`
    toast.warning(label)
  }

  function openWishlist() {
    const withLimit = wishProducts.filter(p => p.maxPerCustomer)
    if (withLimit.length > 0) {
      fetch(`/api/user/purchase-history?productIds=${withLimit.map(p => p.id).join(',')}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.data) {
            const boughtMap = { ...alreadyBought, ...d.data }
            setAlreadyBought(boughtMap)
            validateWishlistLimits(boughtMap)
          } else {
            validateWishlistLimits()
          }
          setWishOpen(true)
        })
        .catch(() => { validateWishlistLimits(); setWishOpen(true) })
    } else {
      validateWishlistLimits()
      setWishOpen(true)
    }
  }

  return (
    <>
      <Header
        cartCount={cart.count()}
        wishCount={wishlist.length}
        onCartOpen={openCart}
        onWishOpen={openWishlist}
      />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <WishlistDrawer
        open={wishOpen}
        onClose={() => setWishOpen(false)}
        products={wishProducts}
        quantities={wishlistQty}
        alreadyBought={alreadyBought}
        onSetQty={setWishQty}
        onRemove={p => removeFromWishlist(p.id)}
        onAddOne={addOneFromWishlist}
        onAddAll={addAllFromWishlist}
        onClearAll={clearAllWishlist}
      />
    </>
  )
}
