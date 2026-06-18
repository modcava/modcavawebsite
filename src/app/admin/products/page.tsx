'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, X as XIcon, Download, CheckSquare, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn, formatPrice, conditionColor } from '@/lib/utils'
import type { ProductWithCategory } from '@/types'
import { ProductFormModal } from '@/components/admin/ProductFormModal'
import { parseDomains } from '@/lib/domains'

const PAGE_SIZE = 50

// ── Views per category (mirrors Modcava_Product_Classification.xlsx) ─
type ViewKey = 'all' | 'mtg-single' | 'mtg-sealed' | 'rb-single' | 'rb-sealed' | 'paint' | 'model-tools' | 'card-accessories'

const VIEWS: { key: ViewKey; label: string; emoji: string; slug: string }[] = [
  { key: 'all',         label: 'ทั้งหมด',          emoji: '📋', slug: '' },
  { key: 'mtg-single',  label: 'MTG Singles',     emoji: '🔮', slug: 'mtg-single' },
  { key: 'mtg-sealed',  label: 'MTG Sealed',      emoji: '📦', slug: 'mtg-sealed' },
  { key: 'rb-single',   label: 'Riftbound Singles', emoji: '⚡', slug: 'rb-single' },
  { key: 'rb-sealed',   label: 'Riftbound Sealed',  emoji: '🎁', slug: 'rb-sealed' },
  { key: 'paint',       label: 'Paints',          emoji: '🎨', slug: 'paint' },
  { key: 'model-tools', label: 'Model Tools',     emoji: '💨', slug: 'model-tools' },
  { key: 'card-accessories', label: 'Card Accessories', emoji: '🎴', slug: 'card-accessories' },
]

// Column definitions per view
type FilterType = 'text' | 'select' | 'none'
type Col = { key: string; label: string; align?: 'left' | 'right' | 'center' }

const COLS: Record<ViewKey, Col[]> = {
  'all': [
    { key: 'sku',       label: 'SKU' },
    { key: 'product',   label: 'Product' },
    { key: 'category',  label: 'Category' },
    { key: 'condition', label: 'Cond.' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'mtg-single': [
    { key: 'sku',        label: 'SKU' },
    { key: 'product',    label: 'Card' },
    { key: 'set',        label: 'Set' },
    { key: 'rarity',     label: 'Rarity' },
    { key: 'foil',       label: 'Foil' },
    { key: 'condition',  label: 'Cond.' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'mtg-sealed': [
    { key: 'sku',        label: 'SKU' },
    { key: 'product',    label: 'Product' },
    { key: 'set',        label: 'Set' },
    { key: 'sealedCat',  label: 'Type' },
    { key: 'language',   label: 'Lang' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'rb-single': [
    { key: 'sku',        label: 'SKU' },
    { key: 'product',    label: 'Card' },
    { key: 'chapter',    label: 'Chapter' },
    { key: 'collector',  label: 'Number' },
    { key: 'rbType',     label: 'Type' },
    { key: 'domain',     label: 'Domain' },
    { key: 'rbRarity',   label: 'Rarity' },
    { key: 'altFoil',    label: 'Alt/Foil' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'rb-sealed': [
    { key: 'sku',         label: 'SKU' },
    { key: 'product',     label: 'Product' },
    { key: 'chapter',     label: 'Chapter' },
    { key: 'rbSealedCat', label: 'Type' },
    { key: 'language',    label: 'Lang' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'paint': [
    { key: 'sku',         label: 'SKU' },
    { key: 'product',     label: 'Product' },
    { key: 'brand',       label: 'Brand' },
    { key: 'paintCat',    label: 'Category' },
    { key: 'colorCode',   label: 'Code' },
    { key: 'colorFamily', label: 'Color' },
    { key: 'finish',      label: 'Finish' },
    { key: 'size',        label: 'Size' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'model-tools': [
    { key: 'sku',         label: 'SKU' },
    { key: 'product',     label: 'Product' },
    { key: 'brand',       label: 'Brand' },
    { key: 'airbrushCat', label: 'Type' },
    { key: 'nozzle',      label: 'Nozzle' },
    { key: 'feedType',    label: 'Feed' },
    { key: 'compatibleWith', label: 'Compat.' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
  'card-accessories': [
    { key: 'sku',         label: 'SKU' },
    { key: 'product',     label: 'Product' },
    { key: 'brand',       label: 'Brand' },
    { key: 'accessoryCat',label: 'Type' },
    { key: 'price',        label: 'Price',      align: 'right'  },
    { key: 'stock',        label: 'Stock',      align: 'right'  },
    { key: 'limitOrder',   label: 'Lmt/Order',  align: 'center' },
    { key: 'limitCustomer',label: 'Lmt/Cust.',  align: 'center' },
    { key: 'status',       label: 'Status' },
  ],
}

// Static dropdown options for specific columns (overrides auto-computed values)
const STATIC_OPTIONS: Record<string, string[]> = {
  condition:   ['NM', 'LP', 'MP', 'HP', 'DMG', 'SEALED'],
  language:    ['EN', 'TH', 'JP', 'DE', 'FR', 'IT', 'ES', 'PT', 'RU', 'KR', 'CS', 'CT'],
  rarity:      ['Common', 'Uncommon', 'Rare', 'Mythic', 'Special', 'Land', 'Token', 'Promo'],
  rbRarity:    ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
  rbType:      ['Champion', 'Ally', 'Spell', 'Rune', 'Domain', 'Legend'],
  altFoil:     ['Foil', 'Alt', 'Foil/Alt'],
  foil:        ['Foil'],
  status:      ['Active', 'Hidden'],
  domain:      ['Fury', 'Body', 'Mind', 'Calm', 'Chaos', 'Order', 'Colorless'],
  sealedCat:   ['Booster Box','Booster Pack','Collector Box','Collector Booster','Bundle','Commander Deck','Starter Kit','Scene Box','Secret Lair','Prerelease Kit'],
  rbSealedCat: ['Booster Box','Booster Pack','Vault Bundle','Champion Deck','Pre-Rift Kit','Starter Deck'],
  paintCat:    ['Scalecolor Individuals',"Metal N' Alchemy Singles",'Inktensity Individuals','Primer','Effect Color','Set','Diorama'],
  colorFamily: ['Neutral','Red','Orange','Yellow','Green','Blue','Purple','Brown','Black','White','Metal','Mixed'],
  finish:      ['Matte','Satin','Gloss'],
  airbrushCat: ['Airbrush','Compressor','Brush','Tool Kit','Glue','Putty','Cutting Mat'],
  accessoryCat:['Sleeve','Deck Box','Playmat','Binder','Dice / Counter','Storage','Other'],
  feedType:    ['Top-feed','Bottom-feed','Side-feed'],
}

// Which filter type applies per column key
const FILTER_TYPES: Record<string, FilterType> = {
  product:        'text',
  category:       'none',  // category tab already handles this; column is display-only
  set:            'select',
  chapter:        'text',
  collector:      'text',
  rarity:         'select',
  rbRarity:       'select',
  rbType:         'select',
  domain:         'select',
  foil:           'select',
  altFoil:        'select',
  condition:      'select',
  language:       'select',
  sku:            'text',
  sealedCat:      'select',
  rbSealedCat:    'select',
  brand:          'select',
  paintCat:       'select',
  colorCode:      'text',
  colorFamily:    'select',
  finish:         'select',
  size:           'none',
  airbrushCat:    'select',
  accessoryCat:   'select',
  nozzle:         'text',
  feedType:       'select',
  compatibleWith: 'text',
  price:          'none',
  stock:          'none',
  limitOrder:     'none',
  limitCustomer:  'none',
  status:         'select',
}

// Extract the comparable raw value (for sort + filter) from a product per column key
function getValue(p: ProductWithCategory, key: string): string | number | boolean | null {
  switch (key) {
    case 'product':        return p.name
    case 'category':       return p.category?.name ?? ''
    case 'set':            return p.setName ?? ''
    case 'chapter':        return p.chapter ?? ''
    case 'collector':      return p.collectorNumber ?? ''
    case 'rarity':         return p.rarity ?? ''
    case 'rbRarity':       return p.rbRarity ?? ''
    case 'rbType':         return p.rbType ?? ''
    case 'domain':         return parseDomains(p.domain).join(' / ')
    case 'foil':           return p.foil ? 'Foil' : ''
    case 'altFoil':        return [p.foil && 'Foil', p.altArt && 'Alt'].filter(Boolean).join('/') || ''
    case 'condition':      return p.condition ?? ''
    case 'language':       return p.language ?? 'EN'
    case 'sku':            return p.sku ?? ''
    case 'sealedCat':      return p.sealedCat ?? ''
    case 'rbSealedCat':    return p.rbSealedCat ?? ''
    case 'brand':          return p.brand ?? ''
    case 'paintCat':       return p.paintCat ?? ''
    case 'colorCode':      return p.colorCode ?? ''
    case 'colorFamily':    return p.colorFamily ?? ''
    case 'finish':         return p.finish ?? ''
    case 'size':           return p.size ?? 0
    case 'airbrushCat':    return p.airbrushCat ?? ''
    case 'accessoryCat':   return p.accessoryCat ?? ''
    case 'nozzle':         return p.nozzle ?? ''
    case 'feedType':       return p.feedType ?? ''
    case 'compatibleWith': return p.compatibleWith ?? ''
    case 'price':          return typeof p.price === 'object' ? p.price.toNumber() : Number(p.price)
    case 'stock':          return p.stock
    case 'limitOrder':     return p.maxPerOrder ?? ''
    case 'limitCustomer':  return p.maxPerCustomer ?? ''
    case 'status':         return p.isActive ? 'Active' : 'Hidden'
    default:               return ''
  }
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null

export default function AdminProductsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [view,   setView]   = useState<ViewKey>('all')
  const [search, setSearch] = useState('')
  const [draft,  setDraft]  = useState('')
  const [page,   setPage]   = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<ProductWithCategory | null>(null)

  // sort + per-column filters
  const [sort,    setSort]    = useState<SortState>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})

  // ── Bulk select ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy,    setBulkBusy]    = useState(false)

  // Reset page when search/view/filters change
  useEffect(() => { setPage(1) }, [search, view, filters])
  // Reset sort + filters when view changes (columns differ)
  useEffect(() => { setSort(null); setFilters({}) }, [view])
  // Clear selection when switching view, searching, or paging
  useEffect(() => { setSelectedIds(new Set()) }, [view, search, page])

  function commitSearch() { setSearch(draft.trim()) }

  const activeView = VIEWS.find((v) => v.key === view)!
  const columns = COLS[view]

  // Fetch all distinct set names for MTG Singles (for filter dropdown)
  const { data: mtgSetNamesData } = useQuery<{ data: string[] }>({
    queryKey: ['admin-mtg-set-names'],
    queryFn: () =>
      fetch('/api/admin/products?category=mtg-single&distinct=setName').then((r) => r.json()),
    staleTime: 30_000,
  })
  const mtgSetNames: string[] = mtgSetNamesData?.data ?? []

  // Stable filter key for query cache
  const filterQueryKey = JSON.stringify(
    Object.entries(filters)
      .filter(([, v]) => v && v.trim())
      .sort(([a], [b]) => a.localeCompare(b)),
  )

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products', search, view, page, filterQueryKey],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (activeView.slug) params.set('category', activeView.slug)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      // Server-side per-column filters
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v.trim()) params.set(`f_${k}`, v.trim())
      })
      const res = await fetch(`/api/admin/products?${params}`)
      return res.json()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      return res.json() as Promise<{ mode: 'hard' | 'soft' }>
    },
    onSuccess: (data) => {
      if (data?.mode === 'soft') {
        toast.warning('ลบไม่ได้ (สินค้ามีประวัติออเดอร์) — ซ่อนสินค้าแทนแล้ว')
      } else {
        toast.success('ลบสินค้าแล้ว')
      }
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    },
    onError: () => toast.error('Failed to remove product'),
  })

  const rawProducts: ProductWithCategory[] = data?.data ?? []
  const total: number = data?.total ?? 0
  const totalPages: number = data?.totalPages ?? 1

  // Unique options for select filters (computed from current page's data)
  const selectOptions = useMemo(() => {
    const out: Record<string, string[]> = {}
    columns.forEach((c) => {
      if (FILTER_TYPES[c.key] === 'select') {
        const set = new Set<string>()
        rawProducts.forEach((p) => {
          const v = getValue(p, c.key)
          if (v !== '' && v != null) set.add(String(v))
        })
        out[c.key] = Array.from(set).sort()
      }
    })
    return out
  }, [rawProducts, columns])

  // Override 'set' options with full list from DB (not just current page)
  const resolvedSelectOptions = useMemo(() => {
    if (view === 'mtg-single' && mtgSetNames.length > 0) {
      return { ...selectOptions, set: mtgSetNames }
    }
    return selectOptions
  }, [selectOptions, view, mtgSetNames])

  // Apply sort client-side (filters are now server-side)
  const products = useMemo(() => {
    let list = rawProducts

    // sort
    if (sort) {
      const { key, dir } = sort
      list = [...list].sort((a, b) => {
        const av = getValue(a, key)
        const bv = getValue(b, key)
        // empty values always last
        const aEmpty = av === '' || av == null
        const bEmpty = bv === '' || bv == null
        if (aEmpty && bEmpty) return 0
        if (aEmpty) return 1
        if (bEmpty) return -1
        if (typeof av === 'number' && typeof bv === 'number') {
          return dir === 'asc' ? av - bv : bv - av
        }
        const cmp = String(av).localeCompare(String(bv), 'en', { numeric: true })
        return dir === 'asc' ? cmp : -cmp
      })
    }

    return list
  }, [rawProducts, sort])

  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: 'asc' }
      if (cur.dir === 'asc')       return { key, dir: 'desc' }
      return null // off
    })
  }
  function setFilter(key: string, v: string) {
    setFilters((f) => ({ ...f, [key]: v }))
  }
  function clearFilters() { setFilters({}); setSort(null) }

  const filterActive  = Object.values(filters).some((v) => v && v.trim()) || !!sort
  const filteredCount = products.length

  // Per-category counts (light query — total only)
  const { data: countsData } = useQuery({
    queryKey: ['admin-products-counts'],
    queryFn: async () => {
      const out: Record<string, number> = {}
      await Promise.all(
        VIEWS.filter((v) => v.slug).map(async (v) => {
          const r = await fetch(`/api/admin/products?category=${v.slug}&pageSize=1`)
          const j = await r.json()
          out[v.slug] = j?.total ?? 0
        }),
      )
      return out
    },
  })
  const counts = countsData ?? {}

  // ── Bulk select helpers ─────────────────────────────────
  const visibleIds = products.map((p) => p.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id))

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id))
      else visibleIds.forEach((id) => next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  async function bulkDelete() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`ลบสินค้า ${ids.length} รายการที่เลือกใช่ไหม? (สินค้าที่ไม่มีออเดอร์จะถูกลบถาวร · สินค้าที่มีออเดอร์จะถูกซ่อน)`)) return

    setBulkBusy(true)
    let hard = 0, soft = 0, fail = 0
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`/api/admin/products?id=${id}`, { method: 'DELETE' })
          if (!r.ok) { fail++; return }
          const j = await r.json()
          if (j.mode === 'soft') soft++
          else hard++
        } catch { fail++ }
      }),
    )
    setBulkBusy(false)
    setSelectedIds(new Set())
    qc.invalidateQueries({ queryKey: ['admin-products'] })
    qc.invalidateQueries({ queryKey: ['admin-products-counts'] })
    qc.invalidateQueries({ queryKey: ['admin-mtg-set-names'] })

    const parts: string[] = []
    if (hard) parts.push(`ลบถาวร ${hard}`)
    if (soft) parts.push(`ซ่อน ${soft} (มีออเดอร์)`)
    if (fail) parts.push(`ล้มเหลว ${fail}`)
    if (fail === 0) toast.success(parts.join(' · '))
    else toast.error(parts.join(' · '))
  }

  return (
    <div className="p-6 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="font-display font-bold text-2xl text-warm-50">Products</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/admin/products/import-mtg')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-blue-300 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors"
          >
            <Download size={14} /> Import MTG
          </button>
          <button onClick={() => { setEditing(null); setModalOpen(true) }} className="btn-amber gap-2">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {VIEWS.map((v) => {
          const active = view === v.key
          const count = v.slug ? counts[v.slug] : total
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold border transition-all flex items-center gap-1.5',
                active
                  ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600',
              )}
            >
              <span>{v.emoji}</span>
              <span>{v.label}</span>
              {v.slug && countsData && (
                <span className={cn(
                  'ml-1 px-1.5 py-px rounded text-[10px] font-mono',
                  active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500',
                )}>
                  {count ?? 0}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search + filter status */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitSearch() }}
            placeholder={`Search ${activeView.label}…`}
            className="input pl-8 text-sm w-full"
          />
        </div>
        <button onClick={commitSearch} className="btn-amber text-xs px-3 py-2 whitespace-nowrap">
          Search
        </button>
        {search && (
          <button
            onClick={() => { setDraft(''); setSearch('') }}
            className="text-slate-500 hover:text-slate-700 text-xs whitespace-nowrap"
          >
            Clear search
          </button>
        )}
        {filterActive && (
          <button
            onClick={clearFilters}
            className="ml-auto inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <XIcon size={12} /> Clear filters & sort
          </button>
        )}
      </div>

      {filterActive && (
        <div className="text-[11px] font-mono text-slate-500 mb-2">
          พบ <span className="text-blue-600 font-semibold">{total.toLocaleString()}</span> รายการตามตัวกรอง
          {sort && <> · จัดเรียงตาม <span className="text-blue-600">{sort.key}</span> ({sort.dir})</>}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Sortable header row */}
              <tr className="bg-blue-50/70">
                <th className="px-3 py-3 w-9">
                  <button onClick={toggleSelectAllVisible} title="เลือก/ยกเลิกทั้งหมด" className="flex items-center justify-center">
                    {allVisibleSelected
                      ? <CheckSquare size={15} className="text-blue-500" />
                      : <Square size={15} className={cn('text-slate-400', someVisibleSelected && 'text-blue-300')} />}
                  </button>
                </th>
                {columns.map((c) => (
                  <Th key={c.key} col={c} sort={sort} onClick={() => toggleSort(c.key)} />
                ))}
                <th className="font-mono text-[10px] uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Actions</th>
              </tr>
              {/* Filter row */}
              <tr className="bg-white border-y border-slate-100">
                <th className="px-3 py-2" />
                {columns.map((c) => {
                  const type = FILTER_TYPES[c.key] || 'text'
                  return (
                    <th key={c.key} className="px-3 py-2 align-middle font-normal">
                      {type === 'none' ? null :
                        type === 'select' ? (
                          <select
                            value={filters[c.key] ?? ''}
                            onChange={(e) => setFilter(c.key, e.target.value)}
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 outline-none focus:border-blue-400"
                          >
                            <option value="">All</option>
                            {(STATIC_OPTIONS[c.key] ?? resolvedSelectOptions[c.key] ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={filters[c.key] ?? ''}
                            onChange={(e) => setFilter(c.key, e.target.value)}
                            placeholder="filter…"
                            className="w-full text-[11px] px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400"
                          />
                        )
                      }
                    </th>
                  )
                })}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={columns.length + 2} className="px-4 py-3">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" />
                  </td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={columns.length + 2} className="px-4 py-12 text-center text-slate-400 text-sm">
                  {filterActive ? 'ไม่พบสินค้าที่ตรงกับตัวกรอง' : 'ยังไม่มีสินค้าในหมวดนี้'}
                </td></tr>
              ) : products.map((p) => {
                const isChecked = selectedIds.has(p.id)
                return (
                <tr
                  key={p.id}
                  className={cn(
                    'transition-colors',
                    isChecked ? 'bg-blue-50/60 hover:bg-blue-50/80' : 'hover:bg-blue-50/40',
                  )}>
                  <td className="px-3 py-3 align-middle cursor-pointer" onClick={() => toggleSelectOne(p.id)}>
                    {isChecked
                      ? <CheckSquare size={15} className="text-blue-500" />
                      : <Square size={15} className="text-slate-300" />}
                  </td>
                  {columns.map((c) => (
                    <td key={c.key}
                      className={cn(
                        'px-4 py-3 align-middle',
                        c.align === 'right'  ? 'text-right'  :
                        c.align === 'center' ? 'text-center' : 'text-left',
                      )}>
                      <Cell colKey={c.key} p={p} />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => { setEditing(p); setModalOpen(true) }}
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => { if (confirm('Remove this product?')) deleteMutation.mutate(p.id) }}
                        className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-red-400 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar (sticky bottom) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white px-4 py-2.5 rounded-full shadow-2xl border border-slate-700">
          <span className="text-xs font-semibold">
            เลือกแล้ว <span className="text-blue-300">{selectedIds.size}</span> รายการ
          </span>
          <span className="h-4 w-px bg-slate-600" />
          <button
            onClick={clearSelection}
            className="text-[11px] text-slate-300 hover:text-white transition-colors"
          >
            ล้างการเลือก
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            <Trash2 size={13} /> {bulkBusy ? 'กำลังลบ…' : `ลบ ${selectedIds.size} รายการ`}
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs">
          <div className="text-slate-500 font-mono">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-mono text-slate-700">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 text-slate-500 hover:border-blue-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <ProductFormModal
          product={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            qc.invalidateQueries({ queryKey: ['admin-products'] })
            qc.invalidateQueries({ queryKey: ['admin-products-counts'] })
          }}
        />
      )}
    </div>
  )
}

// ── Inline price editor ──────────────────────────────────────────
function EditablePrice({ productId, value }: { productId: string; value: number }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(value))
  const [busy,    setBusy]    = useState(false)

  // sync external value when not editing
  useEffect(() => { if (!editing) setDraft(String(value)) }, [value, editing])

  async function save() {
    if (busy || !editing) return
    const next = Number(draft)
    if (!Number.isFinite(next) || next < 0) { toast.error('ราคาไม่ถูกต้อง'); setDraft(String(value)); setEditing(false); return }
    if (next === value) { setEditing(false); return }
    if (next === 0) {
      // PUT validator requires positive; reject here too
      toast.error('ราคาต้องมากกว่า 0')
      setDraft(String(value)); setEditing(false); return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: productId, price: next }),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success(`อัปเดตราคาเป็น ฿${next.toLocaleString()}`)
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('อัปเดตราคาไม่สำเร็จ')
      setDraft(String(value))
    } finally {
      setBusy(false)
      setEditing(false)
    }
  }

  function cancel() { setDraft(String(value)); setEditing(false) }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <span className="font-mono text-xs text-slate-400">฿</span>
        <input
          type="number"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          onBlur={save}
          disabled={busy}
          min={0}
          step="0.01"
          className="w-20 px-2 py-1 text-sm font-mono text-blue-700 bg-white border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200 text-right"
        />
      </div>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="คลิกเพื่อแก้ไขราคา"
      className="font-mono text-sm text-blue-600 font-semibold whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 transition-all cursor-pointer group"
    >
      {formatPrice(value)}
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 text-blue-500 transition-opacity" />
    </button>
  )
}

// ── Inline stock editor ──────────────────────────────────────────
function EditableStock({ productId, value }: { productId: string; value: number }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(value))
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { if (!editing) setDraft(String(value)) }, [value, editing])

  async function save() {
    if (busy || !editing) return
    const next = Number(draft)
    if (!Number.isFinite(next) || !Number.isInteger(next) || next < 0) {
      toast.error('Stock ต้องเป็นจำนวนเต็ม ≥ 0')
      setDraft(String(value)); setEditing(false); return
    }
    if (next === value) { setEditing(false); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: productId, stock: next }),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success(`อัปเดต stock เป็น ${next}`)
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('อัปเดต stock ไม่สำเร็จ')
      setDraft(String(value))
    } finally {
      setBusy(false)
      setEditing(false)
    }
  }

  function cancel() { setDraft(String(value)); setEditing(false) }

  if (editing) {
    return (
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        onBlur={save}
        disabled={busy}
        min={0}
        step={1}
        className="w-16 px-2 py-1 text-sm font-mono text-slate-800 bg-white border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200 text-right"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="คลิกเพื่อแก้ไข stock"
      className={cn(
        'font-mono text-sm font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 hover:ring-1 hover:ring-slate-300 transition-all cursor-pointer group',
        value === 0 ? 'text-red-500' : value <= 2 ? 'text-yellow-600' : 'text-slate-700',
      )}
    >
      {value}
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 text-slate-500 transition-opacity" />
    </button>
  )
}

// ── Inline limit editor (maxPerOrder / maxPerCustomer) ──────────
function EditableLimit({ productId, field, value }: {
  productId: string
  field: 'maxPerOrder' | 'maxPerCustomer'
  value: number | null
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value === null ? '' : String(value))
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { if (!editing) setDraft(value === null ? '' : String(value)) }, [value, editing])

  async function save() {
    if (busy || !editing) return
    const raw  = draft.trim()
    const next = raw === '' ? null : Number(raw)
    if (next !== null && (!Number.isFinite(next) || !Number.isInteger(next) || next < 0)) {
      setDraft(value === null ? '' : String(value)); setEditing(false); return
    }
    if (next === value) { setEditing(false); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: productId, [field]: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(!next ? 'ลบลิมิตแล้ว' : `ตั้งลิมิตเป็น ${next}`)
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('อัปเดตไม่สำเร็จ')
      setDraft(value === null ? '' : String(value))
    } finally { setBusy(false); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        type="number" autoFocus min={0} step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false) } }}
        onBlur={save}
        disabled={busy}
        placeholder="∞"
        className="w-14 px-2 py-1 text-sm font-mono text-slate-800 bg-white border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200 text-center"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="คลิกเพื่อแก้ไขลิมิต (เว้นว่างหรือ 0 = ไม่จำกัด)"
      className={cn(
        'font-mono text-xs font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 hover:ring-1 hover:ring-slate-300 transition-all cursor-pointer group',
        !value ? 'text-slate-300' : 'text-indigo-600',
      )}
    >
      {!value ? '∞' : value}
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 text-slate-500 transition-opacity" />
    </button>
  )
}

// ── Inline status toggle (Active / Hidden) ───────────────────────
function EditableStatus({ productId, value }: { productId: string; value: boolean }) {
  const qc   = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function set(isActive: boolean) {
    if (busy || isActive === value) { setOpen(false); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: productId, isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(isActive ? 'เปิดขายแล้ว' : 'ซ่อนสินค้าแล้ว')
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('อัปเดตไม่สำเร็จ')
    } finally { setBusy(false); setOpen(false) }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={cn(
          'badge text-[10px] cursor-pointer select-none transition-all',
          value
            ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200',
          busy && 'opacity-50 cursor-wait',
        )}
      >
        {value ? 'Active' : 'Hidden'}
        <span style={{ marginLeft: 3, opacity: .6, fontSize: 8 }}>▾</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: '#fff', border: '1px solid #e2e8f0',
            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.1)',
            zIndex: 50, minWidth: 110, overflow: 'hidden',
          }}>
            {[
              { label: '● Active',  isActive: true,  cls: 'text-green-700 hover:bg-green-50' },
              { label: '○ Hidden',  isActive: false, cls: 'text-slate-500 hover:bg-slate-50' },
            ].map(({ label, isActive, cls }) => (
              <button
                key={String(isActive)}
                onClick={() => set(isActive)}
                className={cn('w-full text-left px-3 py-2 text-xs font-semibold transition-colors', cls)}
                style={{ background: isActive === value ? '#f8fafc' : 'transparent', borderBottom: '1px solid #f1f5f9' }}
              >
                {label}
                {isActive === value && <span style={{ float: 'right', opacity: .5 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Inline SKU editor ────────────────────────────────────────────
function EditableSku({ productId, value }: { productId: string; value: string }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  async function save() {
    if (busy || !editing) return
    const next = draft.trim()
    if (next === value) { setEditing(false); return }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/products', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: productId, sku: next || null }),
      })
      if (!res.ok) throw new Error('save failed')
      toast.success(next ? `อัปเดต SKU เป็น ${next}` : 'ลบ SKU แล้ว')
      qc.invalidateQueries({ queryKey: ['admin-products'] })
    } catch {
      toast.error('อัปเดต SKU ไม่สำเร็จ')
      setDraft(value)
    } finally {
      setBusy(false)
      setEditing(false)
    }
  }

  function cancel() { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
        onBlur={save}
        disabled={busy}
        placeholder="SKU"
        className="w-28 px-2 py-1 text-[11px] font-mono text-slate-800 bg-white border border-blue-400 rounded outline-none focus:ring-2 focus:ring-blue-200"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="คลิกเพื่อแก้ไข SKU"
      className="font-mono text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 hover:ring-1 hover:ring-slate-300 transition-all cursor-pointer group max-w-[140px]"
    >
      <span className={cn('truncate', value ? 'text-slate-600' : 'text-slate-300')}>
        {value || '— เพิ่ม SKU —'}
      </span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 text-slate-500 transition-opacity flex-shrink-0" />
    </button>
  )
}

// ── Sortable header cell ─────────────────────────────────────────
function Th({ col, sort, onClick }: { col: Col; sort: SortState; onClick: () => void }) {
  const active = sort?.key === col.key
  const dir    = active ? sort?.dir : null
  return (
    <th
      onClick={onClick}
      className={cn(
        'font-mono text-[10px] uppercase tracking-wider px-4 py-3 cursor-pointer select-none transition-colors',
        active ? 'text-blue-600 bg-blue-100/50' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-100/30',
        col.align === 'right'  ? 'text-right'  :
        col.align === 'center' ? 'text-center' : 'text-left',
      )}
    >
      <span className={cn(
        'inline-flex items-center gap-1',
        col.align === 'right' ? 'flex-row-reverse' : '',
      )}>
        <span>{col.label}</span>
        {dir === 'asc'  ? <ArrowUp size={11} /> :
         dir === 'desc' ? <ArrowDown size={11} /> :
         <ArrowUpDown size={10} className="opacity-30" />}
      </span>
    </th>
  )
}

// ── Cell renderer ────────────────────────────────────────────────
function Cell({ colKey, p }: { colKey: string; p: ProductWithCategory }) {
  const price = typeof p.price === 'object' ? p.price.toNumber() : Number(p.price)

  switch (colKey) {
    case 'product':
      return (
        <div className="flex items-center gap-2.5 min-w-[180px]">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.name}
              className="w-10 h-10 rounded object-cover border border-slate-200 flex-shrink-0" />
          ) : (
            <span className="w-10 h-10 flex items-center justify-center text-lg bg-slate-50 rounded border border-slate-200 flex-shrink-0">
              {p.emoji || p.category.emoji || '🃏'}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-medium text-warm-100 leading-tight truncate">{p.name}</p>
            {p.nameTh && <p className="text-xs text-slate-500 truncate">{p.nameTh}</p>}
          </div>
        </div>
      )

    case 'category':
      return <span className="text-slate-600 text-xs">{p.category.emoji} {p.category.name}</span>

    case 'set':
      return (
        <div className="text-xs">
          <div className="text-slate-700">{p.setName || '—'}</div>
          {p.setCode && <div className="text-[10px] text-slate-400 font-mono">{p.setCode}</div>}
        </div>
      )

    case 'chapter':
      return <span className="text-slate-700 text-xs">{p.chapter || '—'}</span>

    case 'collector':
      return <span className="font-mono text-xs text-slate-500">{p.collectorNumber || '—'}</span>

    case 'rarity':
      return p.rarity ? <RarityPill text={p.rarity} /> : <span className="text-slate-400">—</span>

    case 'rbRarity':
      return p.rbRarity ? <RarityPill text={p.rbRarity} /> : <span className="text-slate-400">—</span>

    case 'rbType':
      return <span className="text-slate-700 text-xs">{p.rbType || '—'}</span>

    case 'domain': {
      const domains = parseDomains(p.domain)
      return domains.length
        ? <span className="inline-flex flex-wrap gap-1">{domains.map((d) => <span key={d} className="inline-block px-2 py-px rounded text-[10px] font-semibold bg-violet-100 text-violet-700">{d}</span>)}</span>
        : <span className="text-slate-400">—</span>
    }

    case 'foil':
      return p.foil
        ? <span className="inline-block px-2 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-700">✨ Foil</span>
        : <span className="text-slate-400 text-xs">—</span>

    case 'altFoil':
      return (
        <div className="flex flex-col gap-0.5 items-start">
          {p.foil   && <span className="px-1.5 py-px rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Foil</span>}
          {p.altArt && <span className="px-1.5 py-px rounded text-[10px] font-semibold bg-pink-100 text-pink-700">Alt</span>}
          {!p.foil && !p.altArt && <span className="text-slate-400 text-xs">—</span>}
        </div>
      )

    case 'condition':
      return p.condition
        ? <span className={cn('badge text-[10px]', conditionColor(p.condition))}>{p.condition}</span>
        : <span className="text-slate-400">—</span>

    case 'language':
      return <span className="font-mono text-xs text-slate-500">{p.language || 'EN'}</span>

    case 'sku':
      return <EditableSku productId={p.id} value={p.sku ?? ''} />

    case 'sealedCat':
      return <span className="text-slate-700 text-xs">{p.sealedCat || '—'}</span>

    case 'rbSealedCat':
      return <span className="text-slate-700 text-xs">{p.rbSealedCat || '—'}</span>

    case 'brand':
      return <span className="text-slate-700 text-xs">{p.brand || '—'}</span>

    case 'paintCat':
      return <span className="text-slate-700 text-xs">{p.paintCat || '—'}</span>

    case 'colorCode':
      return <span className="font-mono text-[11px] text-slate-600">{p.colorCode || '—'}</span>

    case 'colorFamily':
      return p.colorFamily
        ? <span className="inline-block px-2 py-px rounded text-[10px] font-semibold bg-slate-100 text-slate-700">{p.colorFamily}</span>
        : <span className="text-slate-400">—</span>

    case 'finish':
      return <span className="text-slate-700 text-xs">{p.finish || '—'}</span>

    case 'size':
      return <span className="font-mono text-xs text-slate-600">{p.size ? `${p.size} ml` : '—'}</span>

    case 'airbrushCat':
      return <span className="text-slate-700 text-xs">{p.airbrushCat || '—'}</span>

    case 'accessoryCat':
      return <span className="text-slate-700 text-xs">{p.accessoryCat || '—'}</span>

    case 'nozzle':
      return <span className="font-mono text-xs text-slate-600">{p.nozzle || '—'}</span>

    case 'feedType':
      return <span className="text-slate-700 text-xs">{p.feedType || '—'}</span>

    case 'compatibleWith':
      return <span className="text-slate-600 text-xs truncate max-w-[140px] inline-block">{p.compatibleWith || '—'}</span>

    case 'price':
      return <EditablePrice productId={p.id} value={price} />

    case 'stock':
      return <EditableStock productId={p.id} value={p.stock} />

    case 'limitOrder':
      return <EditableLimit productId={p.id} field="maxPerOrder" value={p.maxPerOrder ?? null} />

    case 'limitCustomer':
      return <EditableLimit productId={p.id} field="maxPerCustomer" value={p.maxPerCustomer ?? null} />

    case 'status':
      return <EditableStatus productId={p.id} value={p.isActive} />

    default:
      return <span className="text-slate-400">—</span>
  }
}

// ── Rarity pill ──────────────────────────────────────────────────
function RarityPill({ text }: { text: string }) {
  const map: Record<string, string> = {
    'Common':      'bg-slate-100 text-slate-700',
    'Uncommon':    'bg-emerald-100 text-emerald-700',
    'Rare':        'bg-blue-100 text-blue-700',
    'Mythic Rare': 'bg-orange-100 text-orange-700',
    'Epic':        'bg-violet-100 text-violet-700',
    'Legendary':   'bg-yellow-100 text-yellow-700',
    'Special':     'bg-pink-100 text-pink-700',
    'Promo':       'bg-pink-100 text-pink-700',
    'Land':        'bg-stone-100 text-stone-700',
    'Token':       'bg-stone-100 text-stone-700',
  }
  return (
    <span className={cn('inline-block px-2 py-px rounded text-[10px] font-semibold', map[text] || 'bg-slate-100 text-slate-700')}>
      {text}
    </span>
  )
}
