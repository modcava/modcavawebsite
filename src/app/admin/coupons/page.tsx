'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'

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
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(defaultForm)

  const { data, isLoading } = useQuery<{ data: Coupon[] }>({
    queryKey: ['admin-coupons'],
    queryFn: () => fetch('/api/admin/coupons').then((r) => r.json()),
  })

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
                    <td style={S.td}>{formatValue(c)}</td>
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
