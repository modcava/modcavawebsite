'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'

type CommissionType = 'PERCENTAGE' | 'FIXED_AMOUNT'

interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number
  minOrder: number | null
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  influencerName: string | null
  influencerContact: string | null
  commissionType: CommissionType | null
  commissionValue: number | null
  categoryIds: string | null
}

interface Category { id: string; name: string; nameTh: string | null; slug: string }

function parseCatIds(raw: string | null): string[] {
  if (!raw) return []
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : [] } catch { return [] }
}

const S = {
  page: {
    padding: '32px 28px',
    maxWidth: 1100,
  } as React.CSSProperties,
  heading: {
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 24,
  } as React.CSSProperties,
  card: {
    background: 'var(--paper)',
    border: '1px solid var(--divider)',
    borderRadius: 'var(--r-lg)',
    padding: '24px',
    marginBottom: 24,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '.88rem',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: '1px solid var(--divider)',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: '.72rem',
    fontWeight: 600,
    color: 'var(--ink-2)',
    marginBottom: 5,
    letterSpacing: '.04em',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--paper)',
    border: '1.5px solid var(--divider)',
    borderRadius: 'var(--r)',
    color: 'var(--ink)',
    fontSize: '.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--paper)',
    border: '1.5px solid var(--divider)',
    borderRadius: 'var(--r)',
    color: 'var(--ink)',
    fontSize: '.875rem',
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    cursor: 'pointer',
  } as React.CSSProperties,
  submitBtn: {
    padding: '9px 22px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--r)',
    fontSize: '.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity .18s',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '.82rem',
  } as React.CSSProperties,
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: '.72rem',
    fontWeight: 700,
    color: 'var(--ink-2)',
    borderBottom: '2px solid var(--divider)',
    letterSpacing: '.05em',
    textTransform: 'uppercase' as const,
    background: 'var(--paper-2)',
  } as React.CSSProperties,
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid var(--divider)',
    color: 'var(--ink)',
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,
  badge: (active: boolean): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: '.68rem',
    fontWeight: 700,
    background: active ? '#d4edda' : 'var(--paper-3)',
    color: active ? '#155724' : 'var(--ink-3)',
  }),
  typeBadge: (type: CouponType): React.CSSProperties => {
    const map: Record<CouponType, { bg: string; color: string }> = {
      PERCENTAGE:   { bg: '#e8f4fd', color: '#0c5460' },
      FIXED_AMOUNT: { bg: 'rgba(59,130,246,.10)', color: '#2563eb' },
      FREE_SHIPPING: { bg: '#fff3cd', color: '#856404' },
    }
    const c = map[type]
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: '.68rem',
      fontWeight: 700,
      background: c.bg,
      color: c.color,
    }
  },
  toggleBtn: (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    borderRadius: 'var(--r)',
    border: `1px solid ${active ? '#c3e6cb' : 'var(--divider)'}`,
    background: active ? '#d4edda' : 'var(--paper-2)',
    color: active ? '#155724' : 'var(--ink-3)',
    fontSize: '.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .15s',
  }),
  deleteBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--r)',
    border: '1px solid #f5c6cb',
    background: '#f8d7da',
    color: '#721c24',
    fontSize: '.72rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: 6,
    transition: 'all .15s',
  } as React.CSSProperties,
}

const defaultForm = {
  code: '',
  type: 'PERCENTAGE' as CouponType,
  value: '',
  minOrder: '',
  maxDiscount: '',
  usageLimit: '',
  expiresAt: '',
  influencerName: '',
  influencerContact: '',
  commissionType: '' as '' | CommissionType,
  commissionValue: '',
  categoryIds: [] as string[],
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(defaultForm)

  const { data, isLoading } = useQuery<{ data: Coupon[] }>({
    queryKey: ['admin-coupons'],
    queryFn: () => fetch('/api/admin/coupons').then((r) => r.json()),
  })

  const { data: catData } = useQuery<{ data: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then((r) => r.json()),
  })
  const categories = catData?.data ?? []
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id

  function toggleCat(id: string) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((x) => x !== id)
        : [...f.categoryIds, id],
    }))
  }

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return }
      toast.success('Coupon created')
      setForm(defaultForm)
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: () => toast.error('Failed to create coupon'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/coupons/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: () => toast.error('Failed to update coupon'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: (res) => {
      if (res.error) { toast.error(res.error); return }
      toast.success('Coupon deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: () => toast.error('Failed to delete coupon'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const body: Record<string, unknown> = {
      code: form.code,
      type: form.type,
      value: form.type === 'FREE_SHIPPING' ? 0 : Number(form.value),
    }
    if (form.minOrder) body.minOrder = Number(form.minOrder)
    if (form.maxDiscount && form.type === 'PERCENTAGE') body.maxDiscount = Number(form.maxDiscount)
    if (form.usageLimit) body.usageLimit = Number(form.usageLimit)
    if (form.expiresAt) body.expiresAt = form.expiresAt
    // Influencer attribution (optional)
    if (form.influencerName.trim()) body.influencerName = form.influencerName.trim()
    if (form.influencerContact.trim()) body.influencerContact = form.influencerContact.trim()
    if (form.commissionType && form.commissionValue) {
      body.commissionType = form.commissionType
      body.commissionValue = Number(form.commissionValue)
    }
    if (form.categoryIds.length > 0) body.categoryIds = form.categoryIds
    createMutation.mutate(body)
  }

  const coupons = data?.data ?? []

  function formatValue(c: Coupon) {
    if (c.type === 'PERCENTAGE') return `${c.value}%`
    if (c.type === 'FIXED_AMOUNT') return `฿${Number(c.value).toLocaleString()}`
    return '—'
  }

  function formatExpiry(expiresAt: string | null) {
    if (!expiresAt) return '—'
    return new Date(expiresAt).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
  }

  return (
    <div style={S.page}>
      <div style={S.heading}>Coupon Management</div>

      {/* Create Form */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Create New Coupon</div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={S.label}>Code</label>
              <input
                style={S.input}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SAVE20"
                required
              />
            </div>
            <div>
              <label style={S.label}>Type</label>
              <select
                style={S.select}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (฿)</option>
                <option value="FREE_SHIPPING">Free Shipping</option>
              </select>
            </div>
            {form.type !== 'FREE_SHIPPING' && (
              <div>
                <label style={S.label}>{form.type === 'PERCENTAGE' ? 'Discount (%)' : 'Amount (฿)'}</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'PERCENTAGE' ? '10' : '100'}
                  required
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={S.label}>Min Order (฿)</label>
              <input
                style={S.input}
                type="number"
                min={0}
                value={form.minOrder}
                onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
                placeholder="Optional"
              />
            </div>
            {form.type === 'PERCENTAGE' && (
              <div>
                <label style={S.label}>Max Discount (฿)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            )}
            <div>
              <label style={S.label}>Usage Limit</label>
              <input
                style={S.input}
                type="number"
                min={1}
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label style={S.label}>Expires At</label>
              <input
                style={S.input}
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
          </div>

          {/* Influencer attribution (optional) */}
          <div style={{ borderTop: '1px dashed var(--divider)', paddingTop: 16, marginBottom: 18 }}>
            <div style={{ ...S.label, marginBottom: 12, color: '#7c3aed' }}>
              อินฟลูเอนเซอร์ (ไม่บังคับ) — ผูกโค้ดกับอินฟลูเพื่อคิดค่าคอมและออกรายงาน
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <div>
                <label style={S.label}>ชื่ออินฟลู</label>
                <input
                  style={S.input}
                  value={form.influencerName}
                  onChange={(e) => setForm({ ...form, influencerName: e.target.value })}
                  placeholder="เช่น @nong_tcg"
                />
              </div>
              <div>
                <label style={S.label}>ติดต่อ (เบอร์/LINE)</label>
                <input
                  style={S.input}
                  value={form.influencerContact}
                  onChange={(e) => setForm({ ...form, influencerContact: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label style={S.label}>ค่าคอมแบบ</label>
                <select
                  style={S.select}
                  value={form.commissionType}
                  onChange={(e) => setForm({ ...form, commissionType: e.target.value as '' | CommissionType })}
                >
                  <option value="">— ไม่มีค่าคอม —</option>
                  <option value="PERCENTAGE">% ของยอดสินค้า</option>
                  <option value="FIXED_AMOUNT">บาท/ออเดอร์</option>
                </select>
              </div>
              <div>
                <label style={S.label}>{form.commissionType === 'FIXED_AMOUNT' ? 'ค่าคอม (฿)' : 'ค่าคอม (%)'}</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  value={form.commissionValue}
                  onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                  placeholder={form.commissionType === 'FIXED_AMOUNT' ? '20' : '5'}
                  disabled={!form.commissionType}
                />
              </div>
            </div>
          </div>

          {/* Category restriction (optional) */}
          <div style={{ borderTop: '1px dashed var(--divider)', paddingTop: 16, marginBottom: 18 }}>
            <div style={{ ...S.label, marginBottom: 4, color: '#0c5460' }}>
              ใช้ได้กับหมวดสินค้า (ไม่เลือก = ทุกหมวด)
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', marginBottom: 12 }}>
              ถ้าเลือกบางหมวด ส่วนลดจะคิดเฉพาะยอดสินค้าในหมวดที่เลือกเท่านั้น
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((c) => {
                const on = form.categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--r)',
                      border: `1.5px solid ${on ? '#0c5460' : 'var(--divider)'}`,
                      background: on ? '#e8f4fd' : 'var(--paper-2)',
                      color: on ? '#0c5460' : 'var(--ink-2)',
                      fontSize: '.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all .15s',
                    }}
                  >
                    {on ? '✓ ' : ''}{c.name}
                  </button>
                )
              })}
              {categories.length === 0 && (
                <span style={{ fontSize: '.78rem', color: 'var(--ink-3)' }}>กำลังโหลดหมวด…</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            style={{ ...S.submitBtn, opacity: createMutation.isPending ? .6 : 1 }}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Coupon'}
          </button>
        </form>
      </div>

      {/* Coupons Table */}
      <div style={S.card}>
        <div style={S.sectionTitle}>All Coupons ({coupons.length})</div>
        {isLoading ? (
          <div style={{ color: 'var(--ink-3)', fontSize: '.85rem', padding: '20px 0' }}>Loading…</div>
        ) : coupons.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: '.85rem', padding: '20px 0', textAlign: 'center' }}>
            No coupons yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Code</th>
                  <th style={S.th}>Type</th>
                  <th style={S.th}>Value</th>
                  <th style={S.th}>Influencer</th>
                  <th style={S.th}>Min Order</th>
                  <th style={S.th}>Used / Limit</th>
                  <th style={S.th}>Expires</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} style={{ background: c.isActive ? 'transparent' : 'var(--paper-2)' }}>
                    <td style={S.td}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.85rem', color: 'var(--ink)' }}>
                        {c.code}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={S.typeBadge(c.type)}>
                        {c.type === 'PERCENTAGE' ? '%' : c.type === 'FIXED_AMOUNT' ? '฿' : 'Ship'}
                      </span>
                    </td>
                    <td style={S.td}>
                      {formatValue(c)}
                      {parseCatIds(c.categoryIds).length > 0 && (
                        <div style={{ fontSize: '.66rem', color: '#0c5460', marginTop: 3, fontWeight: 600 }}>
                          เฉพาะ: {parseCatIds(c.categoryIds).map(catName).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      {c.influencerName || c.commissionType ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '.78rem' }}>{c.influencerName || '—'}</div>
                          {c.commissionType && (
                            <div style={{ fontSize: '.7rem', color: '#7c3aed' }}>
                              คอม {c.commissionType === 'PERCENTAGE' ? `${c.commissionValue}%` : `฿${Number(c.commissionValue).toLocaleString()}`}
                            </div>
                          )}
                        </div>
                      ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td style={S.td}>{c.minOrder ? `฿${Number(c.minOrder).toLocaleString()}` : '—'}</td>
                    <td style={S.td}>
                      {c.usedCount} / {c.usageLimit ?? '∞'}
                    </td>
                    <td style={S.td}>{formatExpiry(c.expiresAt)}</td>
                    <td style={S.td}>
                      <span style={S.badge(c.isActive)}>{c.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={S.td}>
                      <button
                        style={S.toggleBtn(c.isActive)}
                        onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}
                      >
                        {c.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        style={S.deleteBtn}
                        onClick={() => {
                          if (confirm(`Delete coupon ${c.code}?`)) deleteMutation.mutate(c.id)
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
