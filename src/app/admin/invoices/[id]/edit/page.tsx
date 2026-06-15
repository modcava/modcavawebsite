'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

// ── Helpers ────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) }
function today(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}
function fmt(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function toNum(v: number | string) { return Number(v) || 0 }
function toDateInput(iso: string | null | undefined) {
  if (!iso) return today()
  return new Date(iso).toISOString().split('T')[0]
}

// ── Main Component ─────────────────────────────────────────────
export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string

  const [loading,    setSaving]    = useState(false)
  const [fetching,   setFetching]  = useState(true)
  const [slipUrl,         setSlipUrl]         = useState<string | null>(null)
  const [orderSlipUrl,    setOrderSlipUrl]    = useState<string | null>(null)
  const [slipUploading,   setSlipUploading]   = useState(false)
  const [showSlipPreview, setShowSlipPreview] = useState(false)

  const [invNum,  setInvNum]  = useState('')
  const [status,  setStatus]  = useState('ISSUED')

  // Customer
  const [customerSearch, setCustomerSearch] = useState('')
  const [suggestions,    setSuggestions]    = useState<CustomerSuggestion[]>([])
  const [showSuggest,    setShowSuggest]    = useState(false)
  const [customerId,     setCustomerId]     = useState('')
  const [customerName,   setCustomerName]   = useState('')
  const [customerEmail,  setCustomerEmail]  = useState('')
  const [customerPhone,  setCustomerPhone]  = useState('')
  const [customerAddr,   setCustomerAddr]   = useState('')

  const [issuedAt, setIssuedAt] = useState(today())
  const [dueDate,  setDueDate]  = useState(today(7))

  const [items, setItems] = useState<LineItem[]>([
    { id: uid(), description: '', qty: 1, unitPrice: 0, discount: 0, discountType: '%', taxMode: '7', tax: 7, withholdingTax: 0 },
  ])
  const [note, setNote] = useState('')
  const [linkedOrderNumber, setLinkedOrderNumber] = useState('')

  // Saved addresses
  const [savedAddresses,   setSavedAddresses]   = useState<SavedAddress[]>([])
  const [showAddrDropdown, setShowAddrDropdown] = useState(false)

  // ── Fetch existing invoice ─────────────────────────────────
  useEffect(() => {
    fetch(`/api/admin/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((j) => {
        const inv = j?.data
        if (!inv) { toast.error('ไม่พบ Invoice'); router.push('/admin/invoices'); return }

        setInvNum(inv.invoiceNumber)
        setStatus(inv.status)
        setCustomerName(inv.customerName || inv.order?.user?.name || '')
        setCustomerEmail(inv.customerEmail || inv.order?.user?.email || '')
        setCustomerPhone(inv.customerPhone || '')
        setCustomerAddr(inv.customerAddress || '')
        setCustomerSearch(inv.customerName || inv.order?.user?.name || inv.order?.user?.email || '')
        setIssuedAt(toDateInput(inv.issuedAt))
        setDueDate(toDateInput(inv.dueDate))
        setNote(inv.note || '')
        setSlipUrl(inv.slipUrl || null)
        setOrderSlipUrl(inv.order?.slipUrl || null)
        setLinkedOrderNumber(inv.order?.orderNumber || '')

        // Parse lineItems JSON
        if (inv.lineItems) {
          try {
            const parsed = JSON.parse(inv.lineItems)
            if (Array.isArray(parsed) && parsed.length > 0) {
              setItems(parsed.map((i: Partial<LineItem>) => ({
                id: uid(),
                description:    i.description    ?? '',
                qty:            i.qty            ?? 1,
                unitPrice:      i.unitPrice      ?? 0,
                discount:       i.discount       ?? 0,
                discountType:   i.discountType   ?? '%',
                taxMode:        i.taxMode        ?? '7',
                tax:            i.tax            ?? 7,
                withholdingTax: i.withholdingTax ?? 0,
              })))
            }
          } catch { /* keep default */ }
        }
      })
      .catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ'))
      .finally(() => setFetching(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  // Customer search
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
    fetch(`/api/admin/members/${c.id}/addresses`)
      .then((r) => r.json())
      .then((j) => setSavedAddresses(j?.data ?? []))
      .catch(() => {})
  }

  // Item helpers
  function addItem() {
    setItems((p) => [...p, { id: uid(), description: '', qty: 1, unitPrice: 0, discount: 0, discountType: '%', taxMode: '7', tax: 7, withholdingTax: 0 }])
  }
  function removeItem(id: string) { setItems((p) => p.filter((i) => i.id !== id)) }
  function updateItem<K extends keyof LineItem>(id: string, key: K, val: LineItem[K]) {
    setItems((p) => p.map((i) => i.id === id ? { ...i, [key]: val } : i))
  }

  // Totals
  function lineDiscount(i: LineItem) {
    return i.discountType === '%' ? i.qty * i.unitPrice * (i.discount / 100) : i.discount
  }
  function lineBase(i: LineItem) { return i.qty * i.unitPrice - lineDiscount(i) }
  const subtotal   = items.reduce((s, i) => s + lineBase(i), 0)
  const totalTax   = items.reduce((s, i) => s + lineBase(i) * (i.tax / 100), 0)
  const totalWht   = items.reduce((s, i) => s + lineBase(i) * (i.withholdingTax / 100), 0)
  const grandTotal = subtotal + totalTax - totalWht

  // Slip upload
  async function handleSlipUpload(file: File) {
    setSlipUploading(true)
    try {
      const fd = new FormData()
      fd.append('slip', file)
      const res = await fetch(`/api/admin/invoices/${invoiceId}/slip`, { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'อัปโหลดไม่สำเร็จ')
      setSlipUrl(j.slipUrl)
      toast.success('อัปโหลดสลิปสำเร็จ')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setSlipUploading(false)
    }
  }

  async function handleUseOrderSlip() {
    if (!orderSlipUrl) { toast.error('ไม่พบสลิปจากคำสั่งซื้อ'); return }
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slipUrl: orderSlipUrl }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || `HTTP ${res.status}`)
      setSlipUrl(orderSlipUrl)
      toast.success('นำสลิปจากคำสั่งซื้อมาใช้แล้ว')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'ไม่สามารถนำสลิปมาใช้ได้')
    }
  }

  async function handleSlipDelete() {
    if (!confirm('ลบสลิปนี้?')) return
    await fetch(`/api/admin/invoices/${invoiceId}/slip`, { method: 'DELETE' })
    setSlipUrl(null)
    toast.success('ลบสลิปแล้ว')
  }

  // Submit
  async function handleSubmit(newStatus?: string) {
    if (!customerName && !customerEmail) { toast.error('กรุณาระบุข้อมูลลูกค้า'); return }
    setSaving(true)
    try {
      const payload = {
        status:          newStatus || status,
        customerName:    customerName  || undefined,
        customerEmail:   customerEmail || undefined,
        customerPhone:   customerPhone || undefined,
        customerAddress: customerAddr  || undefined,
        issuedAt,
        dueDate,
        lineItems: JSON.stringify(items.map(({ id: _id, ...rest }) => rest)),
        discount: 0,
        note: note || null,
        ...(customerId && { customerId }),
      }
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด')
      toast.success('บันทึกการแก้ไขสำเร็จ')
      router.push('/admin/invoices')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#f0f6ff] flex items-center justify-center">
        <div className="text-slate-500 text-sm">กำลังโหลดข้อมูล…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0f6ff] pb-16">
      <div className="px-8 py-5 text-xs text-slate-500 flex items-center gap-2">
        <button onClick={() => router.push('/admin/invoices')} className="hover:text-blue-600 transition-colors">Invoices</button>
        <span>/</span>
        <span className="text-slate-700 font-medium">แก้ไข {invNum}</span>
      </div>

      <div className="px-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
            <h1 className="text-lg font-bold text-slate-800">แก้ไขใบแจ้งหนี้</h1>
            <div className="flex items-center gap-4">
              {linkedOrderNumber && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>คำสั่งซื้อ:</span>
                  <span className="font-mono font-semibold text-blue-700">{linkedOrderNumber}</span>
                </div>
              )}
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">เลขที่เอกสาร</div>
                <div className="font-mono text-sm font-bold text-blue-700">{invNum}</div>
              </div>
            </div>
          </div>

          <div className="p-7 space-y-0 divide-y divide-slate-100">

            {/* ── Section 1: ข้อมูลลูกค้า ── */}
            <section className="pb-7">
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
                      placeholder="พิมพ์เพื่อค้นหาผู้ติดต่อ"
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
                        <button type="button" onClick={() => setShowAddrDropdown((v) => !v)}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors">
                          <Check size={10} /> เลือกที่อยู่ที่บันทึกไว้ ({savedAddresses.length}) <ChevronDown size={10} />
                        </button>
                        {showAddrDropdown && (
                          <div className="absolute right-0 top-full mt-1 z-30 w-80 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                            {savedAddresses.map((a) => (
                              <button key={a.id} type="button"
                                onMouseDown={() => {
                                  const parts = [a.address, a.district, a.province, a.postal].filter(Boolean)
                                  setCustomerAddr(parts.join(', '))
                                  if (a.phone) setCustomerPhone(a.phone)
                                  setShowAddrDropdown(false)
                                }}
                                className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-slate-700">{a.label}</span>
                                  {a.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">ค่าเริ่มต้น</span>}
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
                  <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
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

              <div className="rounded-lg border border-slate-200 overflow-visible mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        { label: 'สินค้า/บริการ',   w: '' },
                        { label: 'จำนวน',            w: 'w-16' },
                        { label: 'ราคา/หน่วย',       w: 'w-24' },
                        { label: 'ส่วนลด',           w: 'w-28' },
                        { label: 'ภาษี %',           w: 'w-24' },
                        { label: 'มูลค่าก่อนภาษี',  w: 'w-28' },
                        { label: 'หัก ณ ที่จ่าย %', w: 'w-24' },
                        { label: '',                 w: 'w-8'  },
                      ].map((h) => (
                        <th key={h.label} className={cn('px-2 py-2.5 text-left font-medium text-xs text-slate-500 tracking-wide', h.w)}>
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const lineTot = lineBase(item)
                      return (
                        <tr key={item.id} className="group hover:bg-slate-50/50">
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
                          <td className="px-2 py-2">
                            <input type="number" min={1} value={item.qty}
                              onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value) || 1)}
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 text-center text-slate-800" />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" min={0} step="0.01" value={item.unitPrice || ''}
                              onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 text-right text-slate-800" />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center border border-slate-200 rounded overflow-hidden focus-within:border-blue-300">
                              <input type="number" min={0} step="0.01" value={item.discount || ''}
                                onChange={(e) => updateItem(item.id, 'discount', Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full text-sm px-2 py-1.5 outline-none text-right text-slate-800 bg-transparent" />
                              <button type="button"
                                onClick={() => updateItem(item.id, 'discountType', item.discountType === '%' ? '฿' : '%')}
                                className="px-1.5 py-1.5 text-[11px] font-semibold border-l border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 transition-colors shrink-0 w-7">
                                {item.discountType}
                              </button>
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <select value={item.taxMode}
                                onChange={(e) => {
                                  const mode = e.target.value as LineItem['taxMode']
                                  updateItem(item.id, 'taxMode', mode)
                                  if (mode === 'none') updateItem(item.id, 'tax', 0)
                                  else if (mode === '7') updateItem(item.id, 'tax', 7)
                                }}
                                className="w-full text-xs px-2 py-1.5 border border-slate-200 rounded outline-none focus:border-blue-300 bg-white text-slate-800">
                                <option value="none">ไม่มี</option>
                                <option value="7">7%</option>
                                <option value="custom">กำหนดเอง</option>
                              </select>
                              {item.taxMode === 'custom' && (
                                <div className="relative">
                                  <input type="number" min={0} max={100} step="0.01" value={item.tax || ''}
                                    onChange={(e) => updateItem(item.id, 'tax', Number(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full text-sm px-2 py-1 pr-5 border border-blue-300 rounded outline-none focus:border-blue-400 text-right text-slate-800" />
                                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right font-mono text-sm text-slate-700">{fmt(lineTot)}</td>
                          <td className="px-2 py-2">
                            <div className="relative">
                              <input type="number" min={0} max={100} step="0.01"
                                value={item.withholdingTax === 0 ? '' : item.withholdingTax}
                                onChange={(e) => updateItem(item.id, 'withholdingTax', Number(e.target.value) || 0)}
                                placeholder="0"
                                className="w-full text-sm px-2 py-1.5 pr-5 border border-slate-200 rounded outline-none focus:border-blue-300 text-right text-slate-800" />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {items.length > 1 && (
                              <button onClick={() => removeItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
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

              <div className="flex gap-2 mb-6">
                <button onClick={addItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs font-medium hover:bg-blue-50 transition-colors">
                  <Plus size={13} /> เพิ่มรายการใหม่
                </button>
              </div>

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
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="หมายเหตุหรือเงื่อนไขสำหรับลูกค้า…"
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400 text-slate-800 placeholder-slate-400 resize-none" />
            </section>

            {/* ── Section 4: สลิปโอนเงิน ── */}
            <section className="py-7">
              <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold text-sm text-slate-700">● สลิปโอนเงิน</span>
                <span className="text-xs text-slate-400">(ไม่แสดงเมื่อพิมพ์เอกสาร)</span>
              </div>

              {/* แจ้งเตือนมีสลิปจากออเดอร์ */}
              {!slipUrl && orderSlipUrl && (
                <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-sm text-amber-800">
                    🧾 ลูกค้าส่งสลิปมาในคำสั่งซื้อนี้แล้ว
                  </span>
                  <button
                    type="button"
                    onClick={handleUseOrderSlip}
                    className="ml-auto shrink-0 text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
                  >
                    นำมาใช้เลย
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSlipPreview(true)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
                  >
                    ดูสลิป
                  </button>
                </div>
              )}

              {slipUrl ? (
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div
                    className="relative w-28 h-28 rounded-lg border border-slate-200 overflow-hidden cursor-pointer group"
                    onClick={() => setShowSlipPreview(true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slipUrl} alt="slip" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Search size={18} className="text-white" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <Check size={12} /> มีสลิปแนบแล้ว
                    </span>
                    <button
                      type="button"
                      onClick={handleSlipDelete}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      ลบสลิป
                    </button>
                  </div>
                </div>
              ) : (
                <label className={cn(
                  'flex flex-col items-center justify-center w-64 h-32 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
                  slipUploading
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50',
                )}>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSlipUpload(f) }}
                  />
                  {slipUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-blue-500">กำลังอัปโหลด…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <Plus size={16} className="text-slate-400" />
                      </div>
                      <span className="text-xs text-slate-500 font-medium">คลิกเพื่อแนบสลิป</span>
                      <span className="text-[10px] text-slate-400">JPG, PNG, WEBP · ไม่เกิน 5MB</span>
                    </div>
                  )}
                </label>
              )}
            </section>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-slate-100 bg-slate-50/50">
            <button onClick={() => router.push('/admin/invoices')}
              className="px-5 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white transition-colors">
              ยกเลิก
            </button>
            <button onClick={() => handleSubmit()} disabled={loading}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
            </button>
          </div>

        </div>
      </div>

      {/* Slip preview popup */}
      {showSlipPreview && (slipUrl || orderSlipUrl) && (
        <div
          onClick={() => setShowSlipPreview(false)}
          className="fixed inset-0 z-[9999] bg-black/75 flex items-center justify-center p-6"
        >
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-lg w-full">
            <button
              onClick={() => setShowSlipPreview(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 font-bold text-sm flex items-center justify-center shadow z-10 hover:bg-slate-100"
            >
              <X size={14} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slipUrl || orderSlipUrl || ''} alt="slip" className="w-full rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{children}</div>
}

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
        <input value={value}
          onChange={(e) => { onChange(e.target.value); setShow(true) }}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          placeholder={placeholder}
          className="w-full text-sm px-2 py-1.5 border border-transparent rounded focus:border-blue-300 focus:bg-white outline-none text-slate-800 placeholder-slate-400 hover:border-slate-200 transition-colors" />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      {show && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-40 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((p) => (
            <button key={p.id}
              onMouseDown={() => { onSelect(p); setShow(false); setSuggestions([]) }}
              className="w-full px-3 py-2.5 text-left hover:bg-blue-50 border-b border-slate-50 last:border-0 transition-colors">
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
                <span className={cn('text-[10px] ml-auto shrink-0', p.stock > 0 ? 'text-green-600' : 'text-red-500')}>
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

// suppress unused import warning
const _x = X
