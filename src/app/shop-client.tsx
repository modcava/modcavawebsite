'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import type { ProductWithCategory, CartItem } from '@/types'
import { useCart } from '@/store/cart'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CartDrawer } from '@/components/shop/CartDrawer'
import { WishlistDrawer } from '@/components/shop/WishlistDrawer'
import { ProductCard } from '@/components/shop/ProductCard'
import { QuickViewModal } from '@/components/shop/QuickViewModal'
import { parseDomains } from '@/lib/domains'

interface Props {
  initialProducts: ProductWithCategory[]
}

type Lang = 'en' | 'th'

// Category labels
const CAT_EN: Record<string, string> = {
  all: 'ALL PRODUCTS',
  'mtg-single': 'MTG SINGLES',
  'mtg-sealed': 'MTG SEALED',
  'rb-single':  'RIFTBOUND SINGLES',
  'rb-sealed':  'RIFTBOUND SEALED',
  paint:        'PAINTS',
  'model-tools':'AIRBRUSH',
}

// MTG mana-color filter icons (optimized WebP in public/icon/)
const MANA_ICON: Record<string, string> = {
  W: '/icon/white.webp',
  U: '/icon/blue.webp',
  B: '/icon/black.webp',
  R: '/icon/red.webp',
  G: '/icon/green.webp',
  C: '/icon/colorless.webp',
}

// Riftbound domain filter icons (transparent symbols — keys match RB_DOMAINS)
const DOMAIN_ICON: Record<string, string> = {
  Fury:  '/icon/Fury.webp',
  Calm:  '/icon/Calm.webp',
  Chaos: '/icon/Chaos.webp',
  Order: '/icon/Order.webp',
  Mind:  '/icon/Mind.webp',
  Body:  '/icon/Body.webp',
}

// ── Helper: parse JSON safely ─────────────────────────────────
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

export function ShopClient({ initialProducts }: Props) {
  const { data: session, status } = useSession()

  // ── State ──────────────────────────────────────────────────
  const [lang,       setLangState]   = useState<Lang>('en')
  const [currentCat, setCurrentCat]  = useState('all')
  const [searchQ,    setSearchQ]     = useState('')
  const [wishlist,     setWishlist]    = useState<string[]>([])
  const [wishlistQty,  setWishlistQty] = useState<Record<string, number>>({})
  const [alreadyBought, setAlreadyBought] = useState<Record<string, number>>({})
  const [cartOpen,   setCartOpen]    = useState(false)
  const [wishOpen,   setWishOpen]    = useState(false)
  const [quickView,  setQuickView]   = useState<ProductWithCategory | null>(null)

  // Toolbar filters
  const [condFilter,  setCondFilter]  = useState('all')
  const [priceFilter, setPriceFilter] = useState('all')
  const [sortFilter,  setSortFilter]  = useState('default')

  // MTG sidebar filters
  const [mtgName,      setMtgName]      = useState('')
  const [mtgNameDraft, setMtgNameDraft] = useState('')
  const [mtgEdition,   setMtgEdition]   = useState('')
  const [mtgFormat,    setMtgFormat]    = useState('')
  const [mtgInStock,   setMtgInStock]   = useState(false)
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [mtgRarities,  setMtgRarities]  = useState<string[]>([])
  const [mtgTypes,     setMtgTypes]     = useState<string[]>([])

  // MTG Sealed sidebar
  const [sealedName,  setSealedName]  = useState('')
  const [sealedCat,   setSealedCat]   = useState('')
  const [sealedInv,   setSealedInv]   = useState('all')

  // RB Singles sidebar
  const [rbName,      setRbName]      = useState('')
  const [rbNameDraft, setRbNameDraft] = useState('')
  const [rbSet,       setRbSet]       = useState('')
  const [rbInStock,   setRbInStock]   = useState(false)
  const [rbRarities,  setRbRarities]  = useState<string[]>([])
  const [rbTypes,     setRbTypes]     = useState<string[]>([])
  const [rbDomains,   setRbDomains]   = useState<string[]>([])

  // RB Sealed sidebar
  const [rbSealedName, setRbSealedName] = useState('')
  const [rbSealedCatF, setRbSealedCatF] = useState('')
  const [rbSealedInv,  setRbSealedInv]  = useState('all')

  // Paint sidebar
  const [paintName, setPaintName] = useState('')
  const [paintCatF, setPaintCatF] = useState('')
  const [paintInv,  setPaintInv]  = useState('all')

  // Model Tools sidebar
  const [modelName, setModelName] = useState('')
  const [modelCatF, setModelCatF] = useState('')
  const [modelInv,  setModelInv]  = useState('all')

  const [currentPage, setCurrentPage] = useState(1)

  const cart = useCart()
  const router = useRouter()

  // Refresh server data when user returns to this tab after ≥3 s away (picks up admin edits)
  const hiddenAtRef = useRef<number>(0)
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (Date.now() - hiddenAtRef.current > 3000) {
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [router])

  // ── Per-user cart & wishlist management ────────────────────
  //
  // หลักการ:
  //   - ตอน login: โหลด cart/wishlist ที่บันทึกไว้ของ user นั้น (ถ้ามี)
  //   - ระหว่าง login: บันทึก cart/wishlist ลง user-specific key ทุกครั้งที่เปลี่ยน
  //   - ตอน logout: ล้าง cart/wishlist ออกจากหน้าจอ (ข้อมูลยังอยู่ใน user-specific key)
  //
  // Keys:
  //   modcava_user_id              — id ของ user เจ้าของข้อมูล generic keys ปัจจุบัน
  //   modcava-cart                 — generic key (Zustand persist)
  //   modcava-cart-{uid}           — user-specific cart snapshot
  //   modcava_wishlist-{uid}       — user-specific wishlist
  //   modcava_wishlist_qty-{uid}   — user-specific wishlist quantities

  // 1) Hydrate cart จาก generic localStorage (Zustand skipHydration)
  useEffect(() => {
    useCart.persist.rehydrate()
    useCart.getState().validateLimits()
  }, [])

  // 2) Load wishlist จาก generic localStorage ตอน mount
  useEffect(() => {
    const stored = localStorage.getItem('modcava_wishlist')
    if (stored) setWishlist(JSON.parse(stored))
    const storedQty = localStorage.getItem('modcava_wishlist_qty')
    if (storedQty) setWishlistQty(JSON.parse(storedQty))
  }, [])

  // 3) Detect user change → merge (guest→login) หรือ clear+restore (logout/switch)
  useEffect(() => {
    if (status === 'loading') return

    const currentId = session?.user?.id ?? null
    const storedId  = localStorage.getItem('modcava_user_id')

    if (storedId === currentId) return   // ไม่มีอะไรเปลี่ยน

    // helper: แยก cart items ที่ stock=0 ออกไป wishlist
    function splitByStock(
      items: CartItem[],
      wish: string[],
      wishQty: Record<string, number>
    ) {
      const cartItems: CartItem[] = []
      const nextWish = [...wish]
      const nextWishQty = { ...wishQty }
      for (const item of items) {
        const product = initialProducts.find((p) => p.id === item.id)
        const currentStock = product !== undefined ? product.stock : item.stock
        if (currentStock === 0) {
          if (!nextWish.includes(item.id)) nextWish.push(item.id)
          if (!nextWishQty[item.id]) nextWishQty[item.id] = item.quantity
        } else {
          cartItems.push(item)
        }
      }
      return { cartItems, nextWish, nextWishQty }
    }

    // ── กรณี: Guest → Login (storedId เป็น null หมายถึงก่อนหน้าไม่ได้ login) ──
    if (storedId === null && currentId !== null) {
      // อ่าน cart ของ guest (generic key) และ cart ที่บันทึกไว้ของ user
      const guestItems: CartItem[] = safeParse<{ state?: { items?: CartItem[] } }>(
        localStorage.getItem('modcava-cart'), {}
      )?.state?.items ?? []

      const userItems: CartItem[] = safeParse<{ state?: { items?: CartItem[] } }>(
        localStorage.getItem(`modcava-cart-${currentId}`), {}
      )?.state?.items ?? []

      // Merge cart: เริ่มจาก user's items แล้ว + guest items ที่ไม่มีใน user's cart
      // ถ้ามีสินค้าตัวเดียวกัน ให้รวม quantity (capped at stock)
      const mergedItems = [...userItems]
      for (const gItem of guestItems) {
        const existing = mergedItems.find((i) => i.id === gItem.id)
        if (existing) {
          existing.quantity = Math.min(existing.quantity + gItem.quantity, gItem.stock)
        } else {
          mergedItems.push(gItem)
        }
      }

      // Merge wishlist: union
      const guestWish: string[] = safeParse(localStorage.getItem('modcava_wishlist'), [])
      const userWish:  string[] = safeParse(localStorage.getItem(`modcava_wishlist-${currentId}`), [])
      const mergedWish = Array.from(new Set([...userWish, ...guestWish]))

      // Merge wishlist qty: user ค่าสูงกว่าของ guest
      const guestWishQty: Record<string, number> = safeParse(localStorage.getItem('modcava_wishlist_qty'), {})
      const userWishQty:  Record<string, number> = safeParse(localStorage.getItem(`modcava_wishlist_qty-${currentId}`), {})
      const mergedWishQty = { ...guestWishQty, ...userWishQty }

      // ย้าย cart items ที่ stock=0 ไป wishlist
      const { cartItems, nextWish, nextWishQty } = splitByStock(mergedItems, mergedWish, mergedWishQty)

      // เขียน merged data กลับเป็น generic keys แล้ว rehydrate
      const mergedCartData = JSON.stringify({ state: { items: cartItems }, version: 0 })
      localStorage.setItem('modcava-cart', mergedCartData)
      useCart.persist.rehydrate()

      setWishlist(nextWish)
      setWishlistQty(nextWishQty)
      localStorage.setItem('modcava_wishlist', JSON.stringify(nextWish))
      localStorage.setItem('modcava_wishlist_qty', JSON.stringify(nextWishQty))

      localStorage.setItem('modcava_user_id', currentId)
      return
    }

    // ── กรณี: Logout หรือ Switch user ──
    useCart.getState().clearCart()
    localStorage.removeItem('modcava-cart')
    setWishlist([])
    setWishlistQty({})
    localStorage.removeItem('modcava_wishlist')
    localStorage.removeItem('modcava_wishlist_qty')

    if (currentId) {
      // Switch user: โหลดข้อมูลของ user ใหม่
      const savedCart = localStorage.getItem(`modcava-cart-${currentId}`)
      const restoredItems: CartItem[] = safeParse<{ state?: { items?: CartItem[] } }>(
        savedCart, {}
      )?.state?.items ?? []

      const savedWish     = safeParse<string[]>(localStorage.getItem(`modcava_wishlist-${currentId}`), [])
      const savedWishQty  = safeParse<Record<string, number>>(localStorage.getItem(`modcava_wishlist_qty-${currentId}`), {})

      // ย้าย cart items ที่ stock=0 ไป wishlist
      const { cartItems, nextWish, nextWishQty } = splitByStock(restoredItems, savedWish, savedWishQty)

      if (cartItems.length > 0 || restoredItems.length > 0) {
        localStorage.setItem('modcava-cart', JSON.stringify({ state: { items: cartItems }, version: 0 }))
        useCart.persist.rehydrate()
      }
      setWishlist(nextWish)
      setWishlistQty(nextWishQty)
      localStorage.setItem('modcava_wishlist', JSON.stringify(nextWish))
      localStorage.setItem('modcava_wishlist_qty', JSON.stringify(nextWishQty))
      localStorage.setItem('modcava_user_id', currentId)
    } else {
      localStorage.removeItem('modcava_user_id')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, status])

  // 4) Auto-save cart ของ user ที่ login อยู่ ทุกครั้งที่ cart.items เปลี่ยน
  // ⚠️  ไม่ใส่ session/status ใน deps เพราะเมื่อ login, Zustand rehydrate เกิดก่อน re-render
  //     ถ้าใส่ deps เหล่านั้น effect นี้จะ fire ก่อน re-render แล้วบันทึก cart เปล่าทับข้อมูลที่ restore ไว้
  useEffect(() => {
    const userId = session?.user?.id
    if (status !== 'authenticated' || !userId) return
    localStorage.setItem(
      `modcava-cart-${userId}`,
      JSON.stringify({ state: { items: cart.items }, version: 0 }),
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items])  // ← เจตนาใส่แค่ cart.items: บันทึกเมื่อตะกร้าเปลี่ยนจริงๆ เท่านั้น

  // 5) Auto-save wishlist ของ user ที่ login อยู่ ทุกครั้งที่ wishlist เปลี่ยน
  // ⚠️  เหตุผลเดียวกับ effect #4 — ไม่ใส่ session/status ใน deps
  useEffect(() => {
    const userId = session?.user?.id
    if (status !== 'authenticated' || !userId) return
    localStorage.setItem(`modcava_wishlist-${userId}`, JSON.stringify(wishlist))
    localStorage.setItem(`modcava_wishlist_qty-${userId}`, JSON.stringify(wishlistQty))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wishlist, wishlistQty])  // ← เจตนาใส่แค่ wishlist: บันทึกเมื่อ wishlist เปลี่ยนจริงๆ เท่านั้น

  // ── Reset page เมื่อ filter/category/search เปลี่ยน ──
  // Derive unique set names from MTG Singles products (sorted A→Z)
  const mtgSetOptions = useMemo(() => {
    const sets = new Set<string>()
    initialProducts.forEach((p) => {
      if (p.category.slug === 'mtg-single' && p.setName) sets.add(p.setName)
    })
    return Array.from(sets).sort((a, b) => a.localeCompare(b))
  }, [initialProducts])

  const rbSetOptions = useMemo(() => {
    const sets = new Set<string>()
    initialProducts.forEach((p) => {
      if (p.category.slug === 'rb-single' && p.chapter) sets.add(p.chapter)
    })
    return Array.from(sets).sort((a, b) => a.localeCompare(b))
  }, [initialProducts])

  const filterKey = useMemo(() => [
    currentCat, searchQ, condFilter, priceFilter, sortFilter,
    mtgName, mtgEdition, mtgFormat, String(mtgInStock),
    Array.from(activeColors).sort().join(','), mtgRarities.join(','), mtgTypes.join(','),
    sealedName, sealedCat, sealedInv,
    rbName, rbSet, String(rbInStock), rbRarities.join(','), rbTypes.join(','), rbDomains.join(','),
    rbSealedName, rbSealedCatF, rbSealedInv,
    paintName, paintCatF, paintInv,
    modelName, modelCatF, modelInv,
  ].join('|'), [
    currentCat, searchQ, condFilter, priceFilter, sortFilter,
    mtgName, mtgEdition, mtgFormat, mtgInStock, activeColors, mtgRarities, mtgTypes,
    sealedName, sealedCat, sealedInv,
    rbName, rbSet, rbInStock, rbRarities, rbTypes, rbDomains,
    rbSealedName, rbSealedCatF, rbSealedInv,
    paintName, paintCatF, paintInv,
    modelName, modelCatF, modelInv,
  ])
  useEffect(() => { setCurrentPage(1) }, [filterKey])

  // Sync lang to html data-lang
  function setLang(l: Lang) {
    setLangState(l)
    document.documentElement.setAttribute('data-lang', l)
  }

  // Toggle mana color
  function toggleColor(color: string) {
    setActiveColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  // Toggle wishlist
  function toggleWishlist(id: string) {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem('modcava_wishlist', JSON.stringify(next))
      return next
    })
  }

  function clearWishlist() {
    setWishlist([])
    setWishlistQty({})
    localStorage.removeItem('modcava_wishlist')
    localStorage.removeItem('modcava_wishlist_qty')
  }

  // Subscribe to a back-in-stock alert for an out-of-stock product (login required)
  async function notifyRestock(productId: string, productName: string) {
    if (!session) {
      toast.error('กรุณาเข้าสู่ระบบเพื่อรับการแจ้งเตือน')
      return
    }
    try {
      const res = await fetch('/api/stock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success(`เราจะแจ้งเตือนเมื่อ "${productName}" กลับมามีสินค้า`)
      } else {
        toast.error(data?.error || 'ไม่สามารถตั้งการแจ้งเตือนได้')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
  }

  // ตั้งจำนวนสินค้าใน wishlist (1 ≤ qty ≤ min(stock, maxPerOrder, customerRemaining))
  function setItemQty(productId: string, qty: number, stock: number, maxPerOrder: number | null, name?: string, maxPerCustomer?: number | null) {
    const boughtBefore      = alreadyBought[productId] ?? 0
    const customerRemaining = maxPerCustomer ? Math.max(0, maxPerCustomer - boughtBefore) : Infinity
    const cap     = Math.min(stock, maxPerOrder || Infinity, customerRemaining)
    const clamped = Math.min(Math.max(1, qty), cap)
    if (qty > cap && name) {
      const reason = maxPerCustomer && qty > customerRemaining
        ? `จำกัดการซื้อ ${maxPerCustomer} ชิ้น/ลูกค้า`
        : maxPerOrder && qty > maxPerOrder
        ? `จำกัดการซื้อ ${maxPerOrder} ชิ้น/ออเดอร์`
        : `สต็อกมีเพียง ${stock} ชิ้น`
      toast.warning(`"${name}" ${reason}`)
    }
    setWishlistQty((prev) => {
      const next = { ...prev, [productId]: clamped }
      localStorage.setItem('modcava_wishlist_qty', JSON.stringify(next))
      return next
    })
  }

  const filteredProducts = useMemo(() => {
    let res = initialProducts.filter((p) => {
      const cat = p.category.slug

      if (currentCat !== 'all' && cat !== currentCat) return false

      // Global search
      if (searchQ) {
        const q = searchQ.toLowerCase()
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.nameTh || '').toLowerCase().includes(q) &&
          !(p.setName || '').toLowerCase().includes(q)
        ) return false
      }

      // Condition filter
      if (condFilter !== 'all') {
        if (condFilter === 'sealed' && p.condition !== 'SEALED') return false
        if (condFilter !== 'sealed' && p.condition !== condFilter) return false
      }

      // Price filter
      if (priceFilter !== 'all') {
        const price = typeof p.price === 'object' ? (p.price as { toNumber(): number }).toNumber() : Number(p.price)
        const ranges: Record<string, [number, number]> = {
          '0-500':    [0, 500],
          '500-2000': [500, 2000],
          '2000-5000':[2000, 5000],
          '5000+':    [5000, Infinity],
        }
        const [lo, hi] = ranges[priceFilter] || [0, Infinity]
        if (price < lo || price > hi) return false
      }

      // MTG singles sidebar
      if (currentCat === 'mtg-single') {
        if (mtgName && !p.name.toLowerCase().includes(mtgName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(mtgName.toLowerCase())) return false
        if (mtgEdition && p.setName !== mtgEdition) return false
        if (mtgFormat && p.formats) {
          const fmts: string[] = JSON.parse(p.formats)
          if (!fmts.includes(mtgFormat)) return false
        }
        if (mtgInStock && p.stock === 0) return false
        if (activeColors.size > 0) {
          const cardTypeLower = (p.cardType || '').toLowerCase()
          const isLand = cardTypeLower.includes('land')
          const isArtifact = cardTypeLower.includes('artifact')
          const cols: string[] = p.colors ? JSON.parse(p.colors) : []
          if (isLand) {
            if (!activeColors.has('C')) return false
          } else if (isArtifact) {
            const coloredCols = cols.filter((c) => c !== 'C')
            if (coloredCols.length === 0) {
              if (!activeColors.has('C')) return false
            } else {
              const nonCSelected = Array.from(activeColors).filter((c) => c !== 'C')
              if (!activeColors.has('C') && !nonCSelected.every((c) => coloredCols.includes(c))) return false
            }
          } else if (p.colors) {
            if (!Array.from(activeColors).every((c) => cols.includes(c))) return false
          }
        }
        if (mtgRarities.length > 0) {
          const matchesRarity = mtgRarities.includes(p.rarity || '')
          const matchesLandType = mtgRarities.includes('Land') && (p.cardType || '').toLowerCase().includes('land')
          if (!matchesRarity && !matchesLandType) return false
        }
        if (mtgTypes.length > 0) {
          const ct = (p.cardType || '').toLowerCase()
          if (!mtgTypes.some((t) => ct.includes(t.toLowerCase()))) return false
        }
      }

      // MTG Sealed sidebar
      if (currentCat === 'mtg-sealed') {
        if (sealedName && !p.name.toLowerCase().includes(sealedName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(sealedName.toLowerCase())) return false
        if (sealedCat && p.sealedCat !== sealedCat) return false
        if (sealedInv === 'available' && p.stock === 0) return false
      }

      // RB Singles sidebar
      if (currentCat === 'rb-single') {
        if (rbName && !p.name.toLowerCase().includes(rbName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(rbName.toLowerCase())) return false
        if (rbSet && p.chapter !== rbSet) return false
        if (rbInStock && p.stock === 0) return false
        if (rbRarities.length > 0 && !rbRarities.includes(p.rbRarity || '')) return false
        if (rbTypes.length > 0 && !rbTypes.includes(p.rbType || '')) return false
        if (rbDomains.length > 0 && !parseDomains(p.domain).some((d) => rbDomains.includes(d))) return false
      }

      // RB Sealed sidebar
      if (currentCat === 'rb-sealed') {
        if (rbSealedName && !p.name.toLowerCase().includes(rbSealedName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(rbSealedName.toLowerCase())) return false
        if (rbSealedCatF && p.rbSealedCat !== rbSealedCatF) return false
        if (rbSealedInv === 'available' && p.stock === 0) return false
      }

      // Paint sidebar
      if (currentCat === 'paint') {
        if (paintName && !p.name.toLowerCase().includes(paintName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(paintName.toLowerCase())) return false
        if (paintCatF && p.paintCat !== paintCatF) return false
        if (paintInv === 'available' && p.stock === 0) return false
      }

      // Model tools sidebar
      if (currentCat === 'model-tools') {
        if (modelName && !p.name.toLowerCase().includes(modelName.toLowerCase()) && !(p.nameTh || '').toLowerCase().includes(modelName.toLowerCase())) return false
        if (modelCatF && p.airbrushCat !== modelCatF) return false
        if (modelInv === 'available' && p.stock === 0) return false
      }

      return true
    })

    // Sort
    if (sortFilter === 'price-asc')  res = [...res].sort((a, b) => Number(a.price) - Number(b.price))
    if (sortFilter === 'price-desc') res = [...res].sort((a, b) => Number(b.price) - Number(a.price))
    if (sortFilter === 'name-asc')   res = [...res].sort((a, b) => a.name.localeCompare(b.name))
    if (sortFilter === 'newest')     res = [...res].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))

    // Always surface in-stock items first. Array.sort is stable, so the chosen
    // sort above is preserved as the secondary order within each stock group.
    res = [...res].sort((a, b) => (a.stock === 0 ? 1 : 0) - (b.stock === 0 ? 1 : 0))

    return res
  }, [
    initialProducts, currentCat, searchQ, condFilter, priceFilter, sortFilter,
    mtgName, mtgEdition, mtgFormat, mtgInStock, activeColors, mtgRarities, mtgTypes,
    sealedName, sealedCat, sealedInv,
    rbName, rbSet, rbInStock, rbRarities, rbTypes, rbDomains,
    rbSealedName, rbSealedCatF, rbSealedInv,
    paintName, paintCatF, paintInv,
    modelName, modelCatF, modelInv,
  ])

  // Sidebar Category filter options, derived from the products actually in stock.
  // New paintCat / airbrushCat values an admin enters appear here automatically.
  const distinctValues = (slug: string, pick: (p: ProductWithCategory) => string | null | undefined) =>
    Array.from(new Set(initialProducts.filter((p) => p.category.slug === slug).map(pick).filter((v): v is string => !!v))).sort()
  const paintCatOptions = useMemo(() => distinctValues('paint', (p) => p.paintCat), [initialProducts])
  const modelCatOptions = useMemo(() => distinctValues('model-tools', (p) => p.airbrushCat), [initialProducts])

  // helper: แปลง product เป็น CartItem แล้ว addItem (รองรับ qty)
  function addProductToCart(p: (typeof initialProducts)[0], qty = 1) {
    const price = typeof p.price === 'object' ? (p.price as { toNumber(): number }).toNumber() : Number(p.price)
    const boughtBefore      = alreadyBought[p.id] ?? 0
    const customerRemaining = p.maxPerCustomer ? Math.max(0, p.maxPerCustomer - boughtBefore) : Infinity
    cart.addItem({
      id: p.id, name: p.name, nameTh: p.nameTh || '',
      price, quantity: 1, stock: p.stock,
      maxPerOrder:    p.maxPerOrder ?? null,
      maxPerCustomer: p.maxPerCustomer ?? null,
      alreadyBought:  boughtBefore,
      condition: p.condition, setName: p.setName,
      emoji: p.emoji, imageUrl: p.imageUrl,
      categorySlug: p.category.slug,
    })
    if (qty > 1) {
      const cap = Math.min(p.stock, p.maxPerOrder || Infinity, customerRemaining)
      cart.updateQty(p.id, Math.min(qty, cap))
    }
  }

  // ดึง stock + limit + ประวัติการซื้อล่าสุดจาก API แล้ว sync ลงตะกร้าก่อน validate
  async function openCart() {
    const ids = useCart.getState().items.map((i) => i.id)
    if (ids.length > 0) {
      try {
        const idsParam = ids.join(',')
        const [productsRes, historyRes] = await Promise.all([
          fetch(`/api/products?ids=${idsParam}&pageSize=100`),
          session?.user ? fetch(`/api/user/purchase-history?productIds=${idsParam}`) : Promise.resolve(null),
        ])
        const productsData = productsRes.ok ? await productsRes.json() : null
        const historyData  = historyRes?.ok ? await historyRes.json() : null
        const boughtMap: Record<string, number> = historyData?.data ?? {}
        if (productsData?.data) {
          useCart.getState().syncProducts(
            (productsData.data as ProductWithCategory[]).map((p) => ({
              id:             p.id,
              stock:          p.stock,
              maxPerOrder:    p.maxPerOrder ?? null,
              maxPerCustomer: p.maxPerCustomer ?? null,
              alreadyBought:  boughtMap[p.id] ?? 0,
            }))
          )
        }
      } catch {}
    }
    useCart.getState().validateLimits()
    setCartOpen(true)
  }

  // ตรวจสอบ wishlist qty ทั้งหมด clamp ค่าที่เกิน limit แล้ว toast รวม
  function validateWishlistLimits(boughtMap: Record<string, number> = alreadyBought) {
    const wishedProducts = initialProducts.filter((p) => wishlist.includes(p.id) && p.stock > 0)
    type Fix = { id: string; name: string; from: number; to: number }
    const fixes: Fix[] = []
    for (const p of wishedProducts) {
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

  // Add สินค้าชิ้นเดียวจาก wishlist → add cart ตาม qty แล้วลบออก wishlist
  function addOneFromWishlist(p: (typeof initialProducts)[0]) {
    if (p.stock <= 0) return
    const qty = wishlistQty[p.id] ?? 1
    addProductToCart(p, qty)
    toggleWishlist(p.id)
  }

  // Add ทั้งหมดจาก wishlist → add cart เฉพาะสินค้าที่มี stock
  // สินค้า stock=0 จะยังคงอยู่ใน wishlist
  function addAllToCart() {
    const inStock    = initialProducts.filter((p) => wishlist.includes(p.id) && p.stock > 0)
    const outOfStock = initialProducts.filter((p) => wishlist.includes(p.id) && p.stock <= 0)

    // เพิ่มสินค้าที่มี stock เข้า cart
    inStock.forEach((p) => addProductToCart(p, wishlistQty[p.id] ?? 1))

    if (outOfStock.length === 0) {
      // ทุกชิ้นมี stock → ล้าง wishlist ทั้งหมด
      clearWishlist()
    } else {
      // บางชิ้น stock=0 → ลบเฉพาะชิ้นที่เพิ่มไป cart แล้ว
      const outOfStockIds = new Set(outOfStock.map((p) => p.id))
      setWishlist((prev) => {
        const next = prev.filter((id) => outOfStockIds.has(id))
        localStorage.setItem('modcava_wishlist', JSON.stringify(next))
        return next
      })
      // ล้าง wishlistQty เฉพาะสินค้าที่ถูกลบออก
      setWishlistQty((prev) => {
        const next = { ...prev }
        inStock.forEach((p) => delete next[p.id])
        localStorage.setItem('modcava_wishlist_qty', JSON.stringify(next))
        return next
      })
    }
  }

  const wishedProducts = initialProducts.filter((p) => wishlist.includes(p.id))

  function toggleMtgRarity(val: string) {
    setMtgRarities((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }
  function toggleMtgType(val: string) {
    setMtgTypes((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }
  function toggleRbRarity(val: string) {
    setRbRarities((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }
  function toggleRbType(val: string) {
    setRbTypes((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }
  function toggleRbDomain(val: string) {
    setRbDomains((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val])
  }

  function resetMtg() {
    setMtgName(''); setMtgNameDraft('')
    setMtgEdition(''); setMtgFormat(''); setMtgInStock(false)
    setActiveColors(new Set()); setMtgRarities([]); setMtgTypes([])
  }
  function resetSealed() {
    setSealedName(''); setSealedCat(''); setSealedInv('all')
  }
  function resetRbSingle() {
    setRbName(''); setRbNameDraft('')
    setRbSet(''); setRbInStock(false); setRbRarities([]); setRbTypes([]); setRbDomains([])
  }
  function resetRbSealed() {
    setRbSealedName(''); setRbSealedCatF(''); setRbSealedInv('all')
  }
  function resetPaint() {
    setPaintName(''); setPaintCatF(''); setPaintInv('all')
  }
  function resetModel() {
    setModelName(''); setModelCatF(''); setModelInv('all')
  }

  const cartCount = cart.count()
  const wishCount = wishlist.length

  // NAV items
  const navItems = [
    { cat: 'all',          labelEn: 'All',                 labelTh: 'ทั้งหมด',              icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    )},
    { cat: 'mtg-single',   labelEn: 'MTG Singles',         labelTh: 'MTG ใบเดี่ยว',         icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/>
      </svg>
    )},
    { cat: 'mtg-sealed',   labelEn: 'MTG Sealed',          labelTh: 'MTG ซีล',              icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      </svg>
    )},
    { cat: 'rb-single',    labelEn: 'Riftbound Singles',   labelTh: 'Riftbound ใบเดี่ยว',   icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    )},
    { cat: 'rb-sealed',    labelEn: 'Riftbound Sealed',    labelTh: 'Riftbound ซีล',        icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
      </svg>
    )},
    { cat: 'paint',        labelEn: 'Paints',              labelTh: 'สี',                   icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <circle cx="11" cy="11" r="2"/>
      </svg>
    )},
    { cat: 'model-tools',  labelEn: 'Airbrush',            labelTh: 'แอร์บรัช',             icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    )},
  ]

  return (
    <>
      {/* ── Header ── */}
      <Header
        lang={lang}
        setLang={setLang}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        cartCount={cartCount}
        wishCount={wishCount}
        onCartOpen={() => { openCart() }}
        onWishOpen={() => {
          const needHistory = initialProducts.filter(
            (p) => wishlist.includes(p.id) && p.maxPerCustomer && session?.user
          )
          if (needHistory.length > 0) {
            fetch(`/api/user/purchase-history?productIds=${needHistory.map(p => p.id).join(',')}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => {
                const boughtMap = { ...alreadyBought, ...(d?.data ?? {}) }
                setAlreadyBought(boughtMap)
                validateWishlistLimits(boughtMap)
                setWishOpen(true)
              })
              .catch(() => { validateWishlistLimits(); setWishOpen(true) })
          } else {
            validateWishlistLimits()
            setWishOpen(true)
          }
        }}
      />


      {/* ── Hero ── */}
      <section className="hero-section" style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--divider)' }}>
        <div className="hero-inner">
          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              <span className="en-text">Modcava</span>
              <span className="th-text">Modcava</span>
            </div>
            <h1 style={{ fontFamily: "'Lora', serif", fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 600, lineHeight: 1.18, color: 'var(--ink)', marginBottom: 14, letterSpacing: '-.01em' }}>
              <span className="en-text">Your hobby.<br /><em style={{ fontStyle: 'italic', color: 'var(--sienna)' }}>Your style.</em></span>
              <span className="th-text">งานอดิเรกของคุณ.<br /><em style={{ fontStyle: 'italic', color: 'var(--sienna)' }}>สไตล์ของคุณ.</em></span>
            </h1>
            <p style={{ fontSize: '.92rem', color: 'var(--ink-2)', maxWidth: 460, lineHeight: 1.75, marginBottom: 32 }}>
              <span className="en-text">Everything a hobbyist needs — from premium trading cards to paints and models for painters at every level.</span>
              <span className="th-text">ทุกสิ่งที่นักสะสมต้องการ — ตั้งแต่การ์ดสะสมพรีเมียม ไปจนถึงสีและโมเดลสำหรับนักทาสีทุกระดับ</span>
            </p>
          </div>
          <div className="hero-mascot" style={{ position: 'relative', width: 200, flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Modcava mascot"
              style={{ width: 180, height: 'auto', mixBlendMode: 'multiply', filter: 'sepia(15%) brightness(.95) contrast(1.05)', animation: 'float 4s ease-in-out infinite' }}
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none' }}
            />
            <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 120, height: 18, background: 'radial-gradient(ellipse, rgba(42,34,24,.14) 0%, transparent 70%)', borderRadius: '50%', animation: 'shadow-breathe 4s ease-in-out infinite' }} />
          </div>
        </div>
      </section>

      {/* ── Category Pills ── */}
      <div className="cat-strip" style={{ borderBottom: '1px solid var(--divider)', background: 'var(--paper)' }}>
        <div className="cat-strip-inner">
          {[
            { cat: 'all',         emoji: '',   en: 'All Products',       th: 'ทั้งหมด' },
            { cat: 'mtg-single',  emoji: '🔮', en: 'MTG Singles',        th: 'MTG ใบเดี่ยว' },
            { cat: 'mtg-sealed',  emoji: '📦', en: 'MTG Sealed',         th: 'MTG ซีล' },
            { cat: 'rb-single',   emoji: '⚡', en: 'Riftbound Singles',  th: 'Riftbound ใบเดี่ยว' },
            { cat: 'rb-sealed',   emoji: '🎁', en: 'Riftbound Sealed',   th: 'Riftbound ซีล' },
            { cat: 'paint',       emoji: '🎨', en: 'Paints',             th: 'สี' },
            { cat: 'model-tools', emoji: '💨', en: 'Airbrush',           th: 'แอร์บรัช' },
          ].map((item) => (
            <button key={item.cat} onClick={() => setCurrentCat(item.cat)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 99,
              background: currentCat === item.cat ? 'var(--sienna)' : 'var(--paper-2)',
              border: `1.5px solid ${currentCat === item.cat ? 'var(--sienna)' : 'var(--divider)'}`,
              fontSize: '.76rem', fontWeight: 500,
              color: currentCat === item.cat ? '#fff' : 'var(--ink-2)',
              transition: 'all .18s', cursor: 'pointer',
            }}>
              {item.emoji && <span>{item.emoji}</span>}
              <span className="en-text">{item.en}</span>
              <span className="th-text">{item.th}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main ── */}
      <main className="shop-main">
        {/* Section head */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <span className="eyebrow">{CAT_EN[currentCat] || 'PRODUCTS'}</span>
          <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
          <span style={{ fontSize: '.78rem', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
            <strong style={{ color: 'var(--sienna)' }}>{filteredProducts.length}</strong>{' '}
            <span className="en-text">items</span><span className="th-text">รายการ</span>
          </span>
        </div>

        <div className="shop-layout">
          {/* ── MTG Singles Sidebar ── */}
          {currentCat === 'mtg-single' && (
            <aside className="shop-sidebar">
              <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'sticky', top: 112 }}>
                <FilterSection label="Card Name">
                  <div style={{ position: 'relative' }}>
                    <input className="mtg-field" type="text" placeholder="Search…" value={mtgNameDraft}
                      onChange={(e) => setMtgNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setMtgName(mtgNameDraft.trim()) }}
                      autoComplete="off"
                      style={{ width: '100%', padding: '7px 34px 7px 10px', background: 'var(--paper)', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', color: 'var(--ink)', fontSize: '.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    <button
                      onClick={() => setMtgName(mtgNameDraft.trim())}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sienna)', color: '#fff', border: 'none', borderRadius: '0 var(--r) var(--r) 0', cursor: 'pointer', fontSize: '.85rem' }}
                      title="Search"
                    >
                      🔍
                    </button>
                  </div>
                </FilterSection>
                <FilterSection label="Edition">
                  <MtgSelect value={mtgEdition} onChange={setMtgEdition}>
                    <option value="">All Editions</option>
                    {mtgSetOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </MtgSelect>
                </FilterSection>
                <FilterSection label="Availability">
                  <CheckRow label="In-Stock" checked={mtgInStock} onChange={setMtgInStock} />
                </FilterSection>
                <FilterSection label="Card Color">
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {(['W','U','B','R','G','C'] as const).map((c) => (
                      <button key={c} onClick={() => toggleColor(c)}
                        title={c}
                        style={{
                          width: 28, height: 28, cursor: 'pointer', borderRadius: '50%', padding: 0,
                          background: 'none', border: 'none',
                          outline: activeColors.has(c) ? '2.5px solid var(--sienna)' : 'none',
                          outlineOffset: activeColors.has(c) ? 2 : 0,
                          transition: 'transform .15s',
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={MANA_ICON[c]} alt={c} width={28} height={28} style={{ width: 28, height: 28, display: 'block', borderRadius: '50%', objectFit: 'cover' }} />
                      </button>
                    ))}
                  </div>
                </FilterSection>
                <FilterSection label="Rarity">
                  {[
                    { val: 'Mythic',   dot: '#e57000' },
                    { val: 'Rare',     dot: '#d4a017' },
                    { val: 'Uncommon', dot: '#607d8b' },
                    { val: 'Common',   dot: '#bbb' },
                    { val: 'Land',     dot: '#5b8a5b' },
                    { val: 'Special',  dot: '#b06080' },
                    { val: 'Token',    dot: '#7b5ea7' },
                    { val: 'Promo',    dot: '#2a7a6e' },
                  ].map(({ val, dot }) => (
                    <CheckRow key={val} label={<><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot, marginRight: 5 }} />{val}</>}
                      checked={mtgRarities.includes(val)} onChange={(v) => toggleMtgRarity(val)} />
                  ))}
                </FilterSection>
                <FilterSection label="Type">
                  {['Creature','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Land'].map((t) => (
                    <CheckRow key={t} label={t} checked={mtgTypes.includes(t)} onChange={() => toggleMtgType(t)} />
                  ))}
                </FilterSection>
                <FilterSection>
                  <button onClick={resetMtg} style={{ width: '100%', padding: 7, borderRadius: 'var(--r)', border: '1.5px solid var(--divider)', color: 'var(--ink-3)', fontSize: '.74rem', textAlign: 'center', transition: 'all .18s', background: '#fff', cursor: 'pointer' }}>
                    Clear All Filters
                  </button>
                </FilterSection>
              </div>
            </aside>
          )}

          {/* ── MTG Sealed Sidebar ── */}
          {currentCat === 'mtg-sealed' && (
            <SealedSidebar
              name={sealedName} onName={setSealedName}
              inv={sealedInv} onInv={setSealedInv}
              catVal={sealedCat} onCat={setSealedCat}
              catOptions={['Booster Box','Booster Pack','Collector Box','Collector Booster','Bundle','Commander Deck','Starter Kit','Scene Box','Secret Lair','Prerelease Kit']}
              onReset={resetSealed}
            />
          )}

          {/* ── RB Singles Sidebar ── */}
          {currentCat === 'rb-single' && (
            <aside className="shop-sidebar">
              <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'sticky', top: 112 }}>
                <FilterSection label="Card Name">
                  <div style={{ position: 'relative' }}>
                    <input className="mtg-field" type="text" placeholder="Search…" value={rbNameDraft}
                      onChange={(e) => setRbNameDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setRbName(rbNameDraft.trim()) }}
                      autoComplete="off"
                      style={{ width: '100%', padding: '7px 34px 7px 10px', background: 'var(--paper)', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', color: 'var(--ink)', fontSize: '.8rem', outline: 'none', boxSizing: 'border-box' }} />
                    <button
                      onClick={() => setRbName(rbNameDraft.trim())}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sienna)', color: '#fff', border: 'none', borderRadius: '0 var(--r) var(--r) 0', cursor: 'pointer', fontSize: '.85rem' }}
                      title="Search"
                    >
                      🔍
                    </button>
                  </div>
                </FilterSection>
                <FilterSection label="Chapter / Set">
                  <MtgSelect value={rbSet} onChange={setRbSet}>
                    <option value="">All Chapters</option>
                    {rbSetOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </MtgSelect>
                </FilterSection>
                <FilterSection label="Availability">
                  <CheckRow label="In-Stock" checked={rbInStock} onChange={setRbInStock} />
                </FilterSection>
                <FilterSection label="Domain">
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['Fury','Calm','Chaos','Order','Mind','Body'].map((d) => (
                      <button key={d} onClick={() => toggleRbDomain(d)}
                        title={d}
                        style={{
                          width: 28, height: 28, cursor: 'pointer', borderRadius: '50%', padding: 0,
                          background: 'none', border: 'none',
                          outline: rbDomains.includes(d) ? '2.5px solid var(--sienna)' : 'none',
                          outlineOffset: rbDomains.includes(d) ? 2 : 0,
                          transition: 'transform .15s',
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={DOMAIN_ICON[d]} alt={d} width={28} height={28} style={{ width: 28, height: 28, display: 'block', objectFit: 'contain' }} />
                      </button>
                    ))}
                  </div>
                </FilterSection>
                <FilterSection label="Rarity">
                  {[
                    { val: 'Legendary', dot: '#e57000' },
                    { val: 'Epic',      dot: '#b06080' },
                    { val: 'Rare',      dot: '#d4a017' },
                    { val: 'Uncommon',  dot: '#607d8b' },
                    { val: 'Common',    dot: '#bbb' },
                  ].map(({ val, dot }) => (
                    <CheckRow key={val} label={<><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: dot, marginRight: 5 }} />{val}</>}
                      checked={rbRarities.includes(val)} onChange={() => toggleRbRarity(val)} />
                  ))}
                </FilterSection>
                <FilterSection label="Type">
                  {['Champion','Ally','Spell','Rune','Domain','Legend'].map((t) => (
                    <CheckRow key={t} label={t} checked={rbTypes.includes(t)} onChange={() => toggleRbType(t)} />
                  ))}
                </FilterSection>
                <FilterSection>
                  <button onClick={resetRbSingle} style={{ width: '100%', padding: 7, borderRadius: 'var(--r)', border: '1.5px solid var(--divider)', color: 'var(--ink-3)', fontSize: '.74rem', textAlign: 'center', transition: 'all .18s', background: '#fff', cursor: 'pointer' }}>
                    Clear All Filters
                  </button>
                </FilterSection>
              </div>
            </aside>
          )}

          {/* ── RB Sealed Sidebar ── */}
          {currentCat === 'rb-sealed' && (
            <SealedSidebar
              name={rbSealedName} onName={setRbSealedName}
              inv={rbSealedInv} onInv={setRbSealedInv}
              catVal={rbSealedCatF} onCat={setRbSealedCatF}
              catOptions={['Booster Box','Booster Pack','Vault Bundle','Champion Deck','Pre-Rift Kit','Starter Deck']}
              onReset={resetRbSealed}
            />
          )}

          {/* ── Paint Sidebar ── */}
          {currentCat === 'paint' && (
            <SealedSidebar
              name={paintName} onName={setPaintName}
              inv={paintInv} onInv={setPaintInv}
              catVal={paintCatF} onCat={setPaintCatF}
              catOptions={paintCatOptions}
              onReset={resetPaint}
            />
          )}

          {/* ── Model Tools Sidebar ── */}
          {currentCat === 'model-tools' && (
            <SealedSidebar
              name={modelName} onName={setModelName}
              inv={modelInv} onInv={setModelInv}
              catVal={modelCatF} onCat={setModelCatF}
              catOptions={modelCatOptions}
              onReset={resetModel}
            />
          )}

          {/* ── Product Area ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <FilterSel value={condFilter} onChange={setCondFilter}>
                  <option value="all">All Conditions</option>
                  <option value="NM">NM — Near Mint</option>
                  <option value="LP">LP — Light Play</option>
                  <option value="MP">MP — Moderate Play</option>
                  <option value="HP">HP — Heavy Play</option>
                  <option value="sealed">Sealed</option>
                </FilterSel>
                <FilterSel value={priceFilter} onChange={setPriceFilter}>
                  <option value="all">All Prices</option>
                  <option value="0-500">฿0 – ฿500</option>
                  <option value="500-2000">฿500 – ฿2,000</option>
                  <option value="2000-5000">฿2,000 – ฿5,000</option>
                  <option value="5000+">฿5,000+</option>
                </FilterSel>
                <FilterSel value={sortFilter} onChange={setSortFilter}>
                  <option value="default">Sort: Default</option>
                  <option value="price-asc">Price ↑</option>
                  <option value="price-desc">Price ↓</option>
                  <option value="name-asc">Name A → Z</option>
                  <option value="newest">Newest First</option>
                </FilterSel>
              </div>
            </div>

            {/* Product Grid */}
            {(() => {
              const PAGE_SIZE = 50
              const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE)
              const pagedProducts = filteredProducts.slice(
                (currentPage - 1) * PAGE_SIZE,
                currentPage * PAGE_SIZE,
              )

              return (
                <>
                  <div className="product-grid">
                    {filteredProducts.length === 0 ? (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '80px 20px', color: 'var(--ink-3)' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: 14, opacity: .35 }}>🔍</div>
                        <h3 style={{ fontSize: '1rem', color: 'var(--ink-2)', marginBottom: 5 }}>No products found</h3>
                        <p>Try a different search or filter</p>
                      </div>
                    ) : (
                      pagedProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          isWished={wishlist.includes(p.id)}
                          onToggleWish={() => toggleWishlist(p.id)}
                          onQuickView={() => setQuickView(p)}
                          onNotify={() => notifyRestock(p.id, p.name)}
                        />
                      ))
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, flexWrap: 'wrap', gap: 12 }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--ink-3)' }}>
                        แสดง {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} จาก {filteredProducts.length} รายการ
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {/* Prev */}
                        <PagBtn disabled={currentPage <= 1} onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          ‹
                        </PagBtn>
                        {/* Page numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                          .reduce<(number | '...')[]>((acc, p, i, arr) => {
                            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                            acc.push(p)
                            return acc
                          }, [])
                          .map((p, i) =>
                            p === '...' ? (
                              <span key={`d${i}`} style={{ padding: '0 4px', color: 'var(--ink-3)', fontSize: '.8rem' }}>…</span>
                            ) : (
                              <PagBtn
                                key={p}
                                active={currentPage === p}
                                onClick={() => { setCurrentPage(p as number); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                              >
                                {p}
                              </PagBtn>
                            )
                          )}
                        {/* Next */}
                        <PagBtn disabled={currentPage >= totalPages} onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                          ›
                        </PagBtn>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </main>

      <Footer />

      {/* ── Cart Drawer ── */}
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      {/* ── Wishlist Drawer ── */}
      <WishlistDrawer
        open={wishOpen}
        onClose={() => setWishOpen(false)}
        products={wishedProducts}
        quantities={wishlistQty}
        alreadyBought={alreadyBought}
        onSetQty={(p, qty) => setItemQty(p.id, qty, p.stock, p.maxPerOrder ?? null, p.name, p.maxPerCustomer ?? null)}
        onRemove={(p) => toggleWishlist(p.id)}
        onAddOne={addOneFromWishlist}
        onAddAll={addAllToCart}
        onClearAll={clearWishlist}
      />

      {/* ── Quick View Modal ── */}
      {quickView && (
        <QuickViewModal
          product={quickView}
          isWished={wishlist.includes(quickView.id)}
          onToggleWish={() => toggleWishlist(quickView.id)}
          onNotify={() => notifyRestock(quickView.id, quickView.name)}
          onClose={() => setQuickView(null)}
        />
      )}
    </>
  )
}

// ── Helper sub-components ──────────────────────────────────

// ── Pagination button ──────────────────────────────────────
function PagBtn({ children, onClick, disabled, active }: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, height: 32, padding: '0 6px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--r)',
        border: `1.5px solid ${active ? 'var(--sienna)' : 'var(--divider)'}`,
        background: active ? 'var(--sienna-bg)' : '#fff',
        color: active ? 'var(--sienna)' : 'var(--ink-2)',
        fontSize: '.82rem', fontWeight: active ? 700 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

function FilterSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '13px 14px', borderBottom: '1px solid var(--divider)' }}>
      {label && (
        <div style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 9 }}>
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function MtgSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      width: '100%', padding: '7px 24px 7px 9px', borderRadius: 'var(--r)',
      background: `var(--paper) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a8978a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 7px center`,
      border: '1.5px solid var(--divider)', color: 'var(--ink-2)', fontSize: '.78rem',
      appearance: 'none', cursor: 'pointer', outline: 'none',
    }}>
      {children}
    </select>
  )
}

function CheckRow({ label, checked, onChange }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--sienna)', flexShrink: 0 }} />
      <span style={{ fontSize: '.78rem', color: 'var(--ink-2)' }}>{label}</span>
    </label>
  )
}

function FilterSel({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{
      padding: '7px 28px 7px 11px', borderRadius: 'var(--r)',
      background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a8978a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 8px center`,
      border: '1.5px solid var(--divider)', color: 'var(--ink-2)', fontSize: '.8rem', fontWeight: 500,
      appearance: 'none', cursor: 'pointer', outline: 'none',
    }}>
      {children}
    </select>
  )
}

function SealedSidebar({
  name, onName, inv, onInv, catVal, onCat, catOptions, onReset,
}: {
  name: string; onName: (v: string) => void
  inv: string; onInv: (v: string) => void
  catVal: string; onCat: (v: string) => void
  catOptions: string[]; onReset: () => void
}) {
  const [nameDraft, setNameDraft] = useState(name)

  function commit() { onName(nameDraft.trim()) }

  // sync draft เมื่อ parent reset
  useEffect(() => { setNameDraft(name) }, [name])

  return (
    <aside className="shop-sidebar">
      <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'sticky', top: 112 }}>
        <FilterSection label="Search">
          <div style={{ position: 'relative' }}>
            <input type="text" placeholder="Product name" value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
              autoComplete="off"
              style={{ width: '100%', padding: '8px 34px 8px 10px', background: 'var(--paper)', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', color: 'var(--ink)', fontSize: '.82rem', outline: 'none', boxSizing: 'border-box' }} />
            <button
              onClick={commit}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sienna)', color: '#fff', border: 'none', borderRadius: '0 var(--r) var(--r) 0', cursor: 'pointer', fontSize: '.85rem' }}
              title="Search"
            >
              🔍
            </button>
          </div>
        </FilterSection>
        <FilterSection label="Inventory">
          <div style={{ display: 'flex', border: '1.5px solid var(--divider)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            {(['all', 'available'] as const).map((v) => (
              <button key={v} onClick={() => onInv(v)} style={{
                flex: 1, padding: '7px 4px', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: inv === v ? '#fff' : 'var(--ink-3)',
                background: inv === v ? 'var(--sienna)' : '#fff',
                border: 'none', cursor: 'pointer', transition: 'all .18s',
                borderRight: v === 'all' ? '1px solid var(--divider)' : 'none',
              }}>
                {v === 'all' ? 'All' : 'Available'}
              </button>
            ))}
          </div>
        </FilterSection>
        <FilterSection label="Category">
          <select value={catVal} onChange={(e) => onCat(e.target.value)} style={{
            width: '100%', padding: '8px 24px 8px 10px', borderRadius: 'var(--r)',
            background: `var(--paper) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a8978a' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 8px center`,
            border: '1.5px solid var(--divider)', color: 'var(--ink-2)', fontSize: '.8rem',
            appearance: 'none', cursor: 'pointer', outline: 'none',
          }}>
            <option value="">Select</option>
            {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </FilterSection>
        <FilterSection>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={commit} style={{ flex: 1, padding: 9, borderRadius: 'var(--r)', background: 'var(--sienna)', color: '#fff', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', border: 'none' }}>
              Search
            </button>
            <button onClick={() => { setNameDraft(''); onReset() }} style={{ flex: 1, padding: 9, borderRadius: 'var(--r)', background: '#fff', color: 'var(--ink-2)', border: '1.5px solid var(--divider)', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Reset
            </button>
          </div>
        </FilterSection>
      </div>
    </aside>
  )
}
