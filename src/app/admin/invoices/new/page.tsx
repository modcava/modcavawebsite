'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────
interface LineItem {
  id:             string
  description:    string
  qty:            number
  unitPrice:      number
  discount:       number
  discountType:   '%' | '฿'
  taxMode:        'none' | '7' | 'custom'
  tax:            number
  withholdingTax: number
}

interface CustomerSuggestion {
  id: string
  name: string | null
  email: string
  phone?: string | null
  savedAddress?: string | null
  savedDistrict?: string | null
  savedProvince?: string | null
  savedPostal?: string | null
}

interface SavedAddress {
  id:        string
  label:     string
  name:      string
  phone:     string
  address:   string
  district:  string | null
  province:  string
  postal:    string | null
  isDefault: boolean
}

interface ProductSuggestion {
  id: string
  name: string
  nameTh: string | null
  sku: string | null
  price: number | string
  emoji: string | null
  stock: number
}

interface OrderItem {
  id: string
  productName: string
  quantity: number
  price: number | string
}

interface OrderSuggestion {
  id: string
  orderNumber: string
  total: number | string
  status: string
  user: { name: string | null; email: string; phone?: string | null } | null
  recipientName: string | null
  address: string | null
  district: string | null
  province: string | null
  postalCode: string | null
  phone: string | null
  items: OrderItem[]
}

// ── Steps ──────────────────────────────────────────────────────
const STEPS = [
  { key: 'IV',  label: 'ใบแจ้งหนี้',       active: true  },
  { key: 'RE',  label: 'ใบเสร็จรับเงิน',    active: false },
  { key: 'TAX', label: 'ใบกำกับภาษี',       active: false },
]

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'รอดำเนินการ',
  CONFIRMED: 'ยืนยันแล้ว',
  SHIPPED:   'จัดส่งแล้ว',
  DELIVERED: 'ส่งถึงแล้ว',
  CANCELLED: 'ยกเลิก',
}

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }
function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}
function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function toNum(v: number | string) { return typeof v === 'object' ? Number(v) : Number(v) }

// ── Main Component ─────────────────────────────────────────────
export default function NewInvoicePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillOrderId = searchParams.get('orderId')

  const [saving,  setSaving]  = useState(false)
  const [invNum,  setInvNum]  = useState('IV-…')

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [suggestions,    setSuggestions]    = useState<CustomerSuggestion[]>([])
  const [showSuggest,    setShowSuggest]    = useState(false)
  const [customerId,     setCustomerId]     = useState('')
  const [customerName,   setCustomerName]   = useState('')
  const [customerEmail,  setCustomerEmail]  = useState('')
  const [customerPhone,  setCustomerPhone]  = useState('')
  const [customerAddr,   setCustomerAddr]   = useState('')

  // Dates
  const [issuedAt, setIssuedAt] = useState(today())
  const [dueDate,  setDueDate]  = useState(today(7))

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { id: uid(), description: '', qty: 1, unitPrice: 0, discount: 0, discountType: '%', taxMode: '7', tax: 7, withholdingTax: 0 },
  ])
  const [note, setNote] = useState('')

  // Linked order
  const [linkedOrderId,     setLinkedOrderId]     = useState(prefillOrderId || '')
  const [linkedOrderNumber, setLinkedOrderNumber] = useState('')

  // Saved addresses
  const [savedAddresses,    setSavedAddresses]    = useState<SavedAddress[]>([])
  const [showAddrDropdown,  setShowAddrDropdown]  = useState(false)

  // Order search
  const [orderSearch,      setOrderSearch]      = useState('')
  const [orderSuggestions, setOrderSuggestions] = useState<OrderSuggestion[]>([])
  const [showOrderSuggest, setShowOrderSuggest] = useState(false)
  const [orderSearching,   setOrderSearching]   = useState(false)

  // Generate invoice number on mount
  useEffect(() => {
    const d = new Date()
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const rand = Math.floor(Math.random() * 90000 + 10000)
    setInvNum(`IV-${ym}${rand}`)
  }, [])

  // Prefill from order if orderId passed in URL — fixed: use dedicated endpoint
  useEffect(() => {
    if (!prefillOrderId) return
    fetch(`/api/admin/orders/${prefillOrderId}`)
      .then((r) => r.json())
      .then((j) => {
        const order: OrderSuggestion = j?.data
        if (!order) return
        applyOrder(order)
      })
      .catch(() => toast.error('ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillOrderId])

  // ── Apply an order to the form ──────────────────────────────
  function applyOrder(order: OrderSuggestion) {
    setLinkedOrderId(order.id)
    setLinkedOrderNumber(order.orderNumber)
    setCustomerName(order.user?.name || order.recipientName || '')
    setCustomerEmail(order.user?.email || '')
    setCustomerPhone(order.phone || order.user?.phone || '')
    setCustomerSearch(order.user?.name || order.recipientName || order.user?.email || '')
    const addrParts = [order.address, order.district, order.province, order.postalCode].filter(Boolean)
    setCustomerAddr(addrParts.join(', '))
    const mapped: LineItem[] = (order.items || []).map((i) => ({
      id: uid(),
      description: i.productName,
      qty: i.quantity,
      unitPrice: toNum(i.price),
      discount: 0,
      discountType: '%' as const,
      taxMode: '7' as const,
      tax: 7,
      withholdingTax: 0,
    }))
    if (mapped.length) setItems(mapped)
    setOrderSearch('')
    setOrderSuggestions([])
    setShowOrderSuggest(false)
    toast.success(`นำเข้าข้อมูลจากคำสั่งซื้อ ${order.orderNumber} สำเร็จ`)
  }

  // ── Order search debounce ──────────────────────────────────
  const searchOrders = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setOrderSuggestions([]); return }
    setOrderSearching(true)
    try {
      const r = await fetch(`/api/admin/orders?orderNumber=${encodeURIComponent(q)}&pageSize=8`)
      const j = await r.json()
      setOrderSuggestions(j?.data ?? [])
    } finally {
      setOrderSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchOrders(orderSearch), 300)
    return () => clearTimeout(t)
  }, [orderSearch, searchOrders])

  // ── Customer search debounce ───────────────────────────────
  const searchCustomers = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setSuggestions([]); return }
    const r = await fetch(`/api/admin/members?search=${encodeURIComponent(q)}&pageSize=8`)
    const j = await r.json()
    setSuggestions(j?.data ?? [])
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 280)
    return () => clearTimeout(t)
  }, [customerSearch, searchCustomers])

  function selectCustomer(c: CustomerSuggestion) {
    setCustomerId(c.id)
    setCustomerName(c.name || '')
    setCustomerEmail(c.email)
    setCustomerPhone(c.phone || '')
    setCustomerSearch(c.name || c.email)
    const addrParts = [c.savedAddress, c.savedDistrict, c.savedProvince, c.savedPostal].filter(Boolean)
    if (addrParts.length) setCustomerAddr(addrParts.join(', '))
    setSuggestions([])
    setShowSuggest(false)
    setSavedAddresses([])
    // ดึง saved addresses ของลูกค้าคนนี้
    fetch(`/api/admin/members/${c.id}/addresses`)
      .then((r) => r.json())
      .then((j) => setSavedAddresses(j?.data ?? []))
      .catch(() => {})
  }

  // ── Item helpers ───────────────────────────────────────────
  function addItem() { setItems((p) => [...p, { id: uid(), description: '', qty: 1, unitPrice: 0, discount: 0, discountType: '%', taxMode: '7', tax: 7, withholdingTax: 0 }]) }
  function removeItem(id: string) { setItems((p) => p.filter((i) => i.id !== id)) }
  function updateItem<K extends keyof LineItem>(id: string, key: K, val: LineItem[K]) {
    setItems((p) => p.map((i) => i.id === id ? { ...i, [key]: val } : i))
  }

  // Totals
  function lineDiscount(i: LineItem) {
    return i.discountType === '%'
      ? i.qty * i.unitPrice * (i.discount / 100)
      : i.discount
  }
  function lineBase(i: LineItem) { return i.qty * i.unitPrice - lineDiscount(i) }
  const subtotal   = items.reduce((s, i) => s + lineBase(i), 0)
  const totalTax   = items.reduce((s, i) => s + lineBase(i) * (i.tax / 100), 0)
  const totalWht   = items.reduce((s, i) => s + lineBase(i) * (i.withholdingTax / 100), 0)
  const grandTotal = subtotal + totalTax - totalWht

  // ── Submit ─────────────────────────────────────────────────
  async function handleSubmit(status: 'DRAFT' | 'ISSUED') {
    if (!customerName && !customerEmail) { toast.error('กรุณาระบุข้อมูลลูกค้า'); return }
    setSaving(true)
    try {
      const payload = {
        invoiceNumber:   invNum,
        status,
        orderId:         linkedOrderId  || undefined,
        customerId:      customerId     || undefined,
        customerName:    customerName   || undefined,
        customerEmail:   customerEmail  || undefined,
        customerPhone:   customerPhone  || undefined,
        customerAddress: customerAddr   || undefined,
        issuedAt,
        dueDate,
        lineItems: JSON.stringify(items.map(({ id: _id, ...rest }) => rest)),
        discount: 0,
        note: note || undefined,
      }
      const res = await fetch('/api/admin/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด')
      toast.success(status === 'ISSUED' ? `ออกใบแจ้งหนี้ ${invNum} สำเร็จ` : 'บันทึกร่างแล้ว')
      router.push('/admin/invoices')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  // ── UI ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f0f6ff] pb-16">

      {/* Step indicator */}
      <div className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-center justify-center gap-0 max-w-lg mx-auto">
          {STEPS.map((step, idx) => (
            <div key={step.key} className="flex items-center">
              <div className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold border transition-all',
                step.active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-400 border-slate-200',
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  step.active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-400',
                )}>
                  {step.active ? <Check size={10} /> : idx + 1}
                </span>
                {step.label}
                <span className={cn(
                  'text-[10px] font-mono opacity-60',
                  step.active ? 'text-blue-100' : 'text-slate-400',
                )}>
                  {step.key}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="flex items-center mx-1">
                  <div className="w-8 h-px bg-slate-200" />
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-slate-200" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Page title row */}
      <div className="px-8 py-4 text-xs text-slate-500">
        รายการโปรดของใบแจ้งหนี้
      </div>

      {/* Main card */}
      <div className="px-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
            <h1 className="text-lg font-bold text-slate-800">สร้างใบแจ้งหนี้</h1>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">เลขที่เอกสาร</div>
              <div className="font-mono text-sm font-bold text-blue-700">{invNum}</div>
            </div>
          </div>

          <div className="p-7 space-y-0 divide-y divide-slate-100">

            {/* ── Section 0: นำเข้าจากคำสั่งซื้อ ── */}
            <section className="pb-7">
              <div className="flex items-center gap-2 mb-4">
                <Search size={14} className="text-blue-500" />
                <span className="font-semibold text-sm text-slate-700">นำเข้าจากคำสั่งซื้อ</span>
                <span className="text-xs text-slate-400">(ไม่บังคับ — ค้นหาเพื่อดึงข้อมูลลูกค้าและสินค้าโดยอัตโนมัติ)</span>
              </div>

              {/* Linked badge */}
              {linkedOrderNumber && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg w-fit">
                  <Check size={13} className="text-green-600" />
                  <span className="text-xs font-semibold text-green-700">
                    เชื่อมต่อกับคำสั่งซื้อ {linkedOrderNumber}
                  </span>
                  <button
                    onClick={() => { setLinkedOrderId(''); setLinkedOrderNumber('') }}
                    className="ml-1 text-green-500 hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              <div className="relative max-w-md">
                <Label>ค้นหาด้วยเลขคำสั่งซื้อ</Label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={orderSearch}
                    onChange={(e) => { setOrderSearch(e.target.value); setShowOrderSuggest(true) }}
                    onFocus={() => setShowOrderSuggest(true)}
                    onBlur={() => setTimeout(() => setShowOrderSuggest(false), 200)}
                    placeholder="พิมพ์เลขคำสั่งซื้อ เช่น ORD-2025…"
                    className="w-full text-sm pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white text-slate-800 placeholder-slate-400"
                  />
                  {orderSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {showOrderSuggest && orderSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {orderSuggestions.map((o) => (
                      <button
                        key={o.id}
                        onMouseDown={() => applyOrder(o)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-mono text-xs font-semibold text-blue-700">{o.orderNumber}</span>
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                            o.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                            'bg-amber-100 text-amber-700',
                          )}>
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-700 font-medium">
                          {o.user?.name || o.recipientName || o.user?.email || '—'}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[11px] text-slate-400">{o.user?.email}</span>
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            ฿{fmt(toNum(o.total))}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showOrderSuggest && orderSearch.length >= 2 && !orderSearching && orderSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-xs text-slate-400">
                    ไม่พบคำสั่งซื้อที่ตรงกัน
                  </div>
                )}
              </div>
            </section>

            {/* ── Section 1: ข้อมูลลูกค้า ── */}
            <section className="py-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-white" />
                </div>
                <span className="font-semibold text-sm text-slate-700">ข้อมูลลูกค้า</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Customer search */}
                <div className="relative">
                  <Label>ชื่อลูกค้า <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <input
                      value={customerSearch || customerName}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerName(e.target.value); setShowSuggest(true) }}
                      onFocus={() => setShowSuggest(true)}
                      placeholder="พิมพ์เพื่อค้นหาผู้ติดต่อ หรือสร้างลูกค้าใหม่"
                      className="w-full text-sm px-3 py-2 pr-8 border border-slate-200 rounded-lg outline-none focus:border-blue-400 bg-white text-slate-800 placeholder-slate-400"
                    />
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {showSuggest && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                      {suggestions.map((c) => {
                        const addrParts = [c.savedAddress, c.savedDistrict, c.savedProvince, c.savedPostal].filter(Boolean)
                        return (
                          <button key={c.id} onMouseDown={() => selectCustomer(c)}
                            className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
                            <div className="font-medium text-slate-800 text-sm">{c.name || c.email}</div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500">{c.email}</span>
                              {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                            </div>
                            {addrParts.length > 0 && (
                              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{addrParts.join(', ')}</div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Issued date */}
                <div>
                  <Label>วันที่ออก <span className="text-red-400">*</span></Label>
                  <input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800" />
                </div>

                {/* Due date */}
                <div>
                  <Label>วันที่ครบกำหนด <span className="text-red-400">*</span></Label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800" />
                </div>

                {/* Address */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>ที่อยู่</Label>
                    {savedAddresses.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowAddrDropdown((v) => !v)}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                        >
                          <Check size={10} /> เลือกที่อยู่ที่บันทึกไว้ ({savedAddresses.length})
                          <ChevronDown size={10} />
                        </button>
                        {showAddrDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-80 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            {savedAddresses.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onMouseDown={() => {
                                  const parts = [a.address, a.district, a.province, a.postal].filter(Boolean)
                                  setCustomerAddr(parts.join(', '))
                                  if (a.phone) setCustomerPhone(a.phone)
                                  setShowAddrDropdown(false)
                                }}
                                className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
                              >
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-slate-700">{a.label}</span>
                                  {a.isDefault && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">ค่าเริ่มต้น</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600">{a.name} · {a.phone}</div>
                                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {[a.address, a.district, a.province, a.postal].filter(Boolean).join(', ')}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input value={customerAddr} onChange={(e) => setCustomerAddr(e.target.value)}
                    placeholder="ที่อยู่จัดส่ง / เรียกเก็บเงิน"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400" />
                </div>

                {/* Phone */}
                <div>
                  <Label>เบอร์โทร</Label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0XX-XXX-XXXX"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400" />
                </div>

                {/* Email */}
                <div className="col-span-2">
                  <Label>อีเมล</Label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400" />
                </div>
              </div>
            </section>

            {/* ── Section 2: รายการสินค้า ── */}
            <section className="py-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-white" />
                </div>
                <span className="font-semibold text-sm text-slate-700">รายการ</span>
              </div>

              {/* Items table */}
              <div className="rounded-lg border border-slate-200 overflow-visible mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        { label: 'สินค้า/บริการ',  w: '' },
                        { label: 'จำนวน',           w: 'w-16' },
                        { label: 'ราคา/หน่วย',      w: 'w-24' },
                        { label: 'ส่วนลด',          w: 'w-28' },
                        { label: 'ภาษี %',          w: 'w-24' },
                        { label: 'มูลค่าก่อนภาษี', w: 'w-28' },
                        { label: 'หัก ณ ที่จ่าย %', w: 'w-24' },
                        { label: '',                w: 'w-8'  },
                      ].map((h) => (
                        <th key={h.label} className={cn('px-2 py-2.5 text-left font-medium text-xs text-slate-500 tracking-wide', h.w)}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const lineTotal = lineBase(item)
                      return (
                        <tr key={item.id} className="group hover:bg-slate-50/50">
                          {/* สินค้า/บริการ */}
                          <td className="px-2 py-2">
                            <ProductInput
                              value={item.description}
                              placeholder={`รายการที่ ${idx + 1}`}
                              onChange={(desc) => updateItem(item.id, 'description', desc)}
                              onSelect={(p) => {
                                updateItem(item.id, 'description', p.name)
                                updateItem(item.id, 'unitPrice', toNum(p.price))
                              }}
                            />
                          </td>
                          {/* จำนวน */}
                          <td className="px-2 py-2">
                            <input
                              type="number" min={1}
                              value={item.qty}
                              onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value) || 1)}
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 text-center text-slate-800"
                            />
                          </td>
                          {/* ราคา/หน่วย */}
                          <td className="px-2 py-2">
                            <input
                              type="number" min={0} step="0.01"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 text-right text-slate-800"
                            />
                          </td>
                          {/* ส่วนลด */}
                          <td className="px-2 py-2">
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden focus-within:border-blue-300">
                              <input
                                type="number" min={0} step="0.01"
                                value={item.discount || ''}
                                onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full text-sm px-2 py-1.5 outline-none text-right text-slate-800 bg-transparent"
                              />
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, 'discountType', item.discountType === '%' ? '฿' : '%')}
                                className="px-1.5 py-1.5 text-[11px] font-semibold border-l border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 transition-colors shrink-0 w-7"
                              >
                                {item.discountType}
                              </button>
                            </div>
                          </td>
                          {/* ภาษี % */}
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <select
                                value={item.taxMode}
                                onChange={(e) => {
                                  const mode = e.target.value as LineItem['taxMode']
                                  updateItem(item.id, 'taxMode', mode)
                                  if (mode === 'none') updateItem(item.id, 'tax', 0)
                                  else if (mode === '7') updateItem(item.id, 'tax', 7)
                                }}
                                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 bg-white text-slate-800"
                              >
                                <option value="none">ไม่มี</option>
                                <option value="7">7%</option>
                                <option value="custom">กำหนดเอง</option>
                              </select>
                              {item.taxMode === 'custom' && (
                                <div className="relative">
                                  <input
                                    type="number" min={0} max={100} step="0.01"
                                    value={item.tax || ''}
                                    onChange={(e) => updateItem(item.id, 'tax', Number(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full text-sm px-2 py-1 pr-5 border border-blue-300 rounded outline-none focus:border-blue-400 text-right text-slate-800"
                                  />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {/* มูลค่าก่อนภาษี */}
                          <td className="px-2 py-2 text-right font-mono text-sm text-slate-700">
                            {fmt(lineTotal)}
                          </td>
                          {/* หัก ณ ที่จ่าย % */}
                          <td className="px-2 py-2">
                            <div className="relative">
                              <input
                                type="number" min={0} max={100} step="0.01"
                                value={item.withholdingTax === 0 ? '' : item.withholdingTax}
                                onChange={(e) => updateItem(item.id, 'withholdingTax', Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full text-sm px-2 py-1.5 pr-5 border border-slate-200 rounded outline-none focus:border-blue-300 text-right text-slate-800"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                            </div>
                          </td>
                          {/* ลบ */}
                          <td className="px-2 py-2 text-center">
                            {items.length > 1 && (
                              <button
                                onClick={() => removeItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add item button */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors"
                >
                  <Plus size={13} /> เพิ่มรายการใหม่
                </button>
              </div>

              {/* Summary */}
              <div className="flex justify-end">
                <div className="w-80">
                  <div className="flex justify-between items-center py-2 text-sm">
                    <span className="text-slate-500">ราคารวมก่อนภาษี</span>
                    <span className="font-mono text-slate-700">{fmt(subtotal)} บาท</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-sm border-t border-slate-100">
                    <span className="text-slate-500">ภาษีมูลค่าเพิ่ม (VAT)</span>
                    <span className="font-mono text-slate-700">+ {fmt(totalTax)} บาท</span>
                  </div>
                  <div className="flex justify-between items-center py-2 text-sm border-t border-slate-100">
                    <span className="text-slate-500">หัก ณ ที่จ่าย (WHT)</span>
                    <span className="font-mono text-red-500">− {fmt(totalWht)} บาท</span>
                  </div>
                  <div className="flex justify-between items-center py-3 mt-1 rounded-lg bg-slate-800 px-4">
                    <span className="font-semibold text-white text-sm">จำนวนเงินทั้งสิ้น</span>
                    <span className="font-mono font-bold text-white text-base">{fmt(grandTotal)} บาท</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Section 3: หมายเหตุ ── */}
            <section className="py-7">
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-slate-700">● หมายเหตุสำหรับลูกค้า</span>
                <button className="text-xs text-blue-600 hover:underline">ย่อ/ขยาย</button>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="หมายเหตุหรือเงื่อนไขสำหรับลูกค้า…"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400 resize-none"
              />
            </section>

          </div>{/* end divide-y */}

          {/* ── Footer ── */}
          <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => router.push('/admin/invoices')}
              className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => handleSubmit('DRAFT')}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึกร่าง'}
            </button>
            <button
              onClick={() => handleSubmit('ISSUED')}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'กำลังออก…' : 'อนุมัติใบแจ้งหนี้'} ▾
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{children}</div>
}

// ── Product search input for line items ────────────────────────
function ProductInput({
  value, placeholder, onChange, onSelect,
}: {
  value: string
  placeholder: string
  onChange: (v: string) => void
  onSelect: (p: ProductSuggestion) => void
}) {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [show,        setShow]        = useState(false)
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    if (!value || value.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/admin/products?search=${encodeURIComponent(value)}&pageSize=8`)
        const j = await r.json()
        setSuggestions(j?.data ?? [])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); setShow(true) }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          placeholder={placeholder}
          className="w-full text-sm px-2 py-1.5 border border-transparent rounded focus:border-blue-300 focus:bg-white outline-none text-slate-800 placeholder-slate-400 hover:border-slate-200 transition-colors"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-40 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((p) => (
            <button
              key={p.id}
              onMouseDown={() => { onSelect(p); setShow(false); setSuggestions([]) }}
              className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-800 truncate">
                  {p.emoji ? `${p.emoji} ` : ''}{p.name}
                </span>
                <span className="font-mono text-xs font-semibold text-blue-700 shrink-0">
                  ฿{toNum(p.price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {p.sku && <span className="text-[11px] text-slate-400 font-mono">SKU: {p.sku}</span>}
                {p.nameTh && <span className="text-[11px] text-slate-400 truncate">{p.nameTh}</span>}
                <span className={cn(
                  'text-[10px] ml-auto shrink-0',
                  p.stock > 0 ? 'text-green-600' : 'text-red-500',
                )}>
                  {p.stock > 0 ? `คงเหลือ ${p.stock}` : 'หมด'}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
