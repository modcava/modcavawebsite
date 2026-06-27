'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCart } from '@/store/cart'
import { CARD_MAX_TOTAL } from '@/lib/payment'
import { ThaiAddressSelect } from '@/components/shop/ThaiAddressSelect'
import Link from 'next/link'

type SavedAddress = {
  id: string
  label: string
  name: string
  phone: string
  address: string
  subdistrict: string | null
  district: string | null
  province: string
  postal: string | null
  isDefault: boolean
}

const schema = z.object({
  recipientName:  z.string().min(2, 'กรุณากรอกชื่อ'),
  phone:          z.string().min(9, 'เบอร์โทรไม่ถูกต้อง'),
  address:        z.string().min(5, 'กรุณากรอกที่อยู่'),
  subdistrict:    z.string().min(1, 'กรุณาเลือกแขวง/ตำบล'),
  district:       z.string().min(1, 'กรุณาเลือกเขต/อำเภอ'),
  province:       z.string().min(1, 'กรุณาเลือกจังหวัด'),
  postalCode:     z.string().length(5, 'รหัสไปรษณีย์ต้องมี 5 หลัก'),
  shippingMethod: z.string(),
  paymentMethod:  z.string(),
  note:           z.string().optional(),
})
type Form = z.infer<typeof schema>

// ── Shared inline styles ──────────────────────────────────────
const S = {
  page: {
    maxWidth: 1080,
    margin: '0 auto',
    padding: '40px 24px 80px',
  } as React.CSSProperties,

  card: {
    background: '#fff',
    border: '1px solid var(--divider)',
    borderRadius: 'var(--r-lg)',
    padding: '20px 22px',
    marginBottom: 16,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '.88rem',
    fontWeight: 700,
    color: 'var(--ink)',
    marginBottom: 16,
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
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '9px 13px',
    background: '#fff',
    border: '1.5px solid var(--divider)',
    borderRadius: 'var(--r)',
    color: 'var(--ink)',
    fontSize: '.875rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  error: {
    fontSize: '.7rem',
    color: '#c0392b',
    marginTop: 4,
  } as React.CSSProperties,

  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'var(--sienna)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--r)',
    fontSize: '.92rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background .18s',
    marginTop: 8,
  } as React.CSSProperties,

  radioCard: (selected: boolean): React.CSSProperties => ({
    padding: '10px',
    textAlign: 'center',
    fontSize: '.78rem',
    fontWeight: 600,
    border: `1.5px solid ${selected ? 'var(--sienna)' : 'var(--divider)'}`,
    borderRadius: 'var(--r)',
    color: selected ? 'var(--sienna)' : 'var(--ink-2)',
    background: selected ? 'var(--sienna-bg)' : '#fff',
    cursor: 'pointer',
    transition: 'all .18s',
  }),
}

const SHIPPING_FEE: Record<string, number> = { 'Store Pickup': 0, EMS: 50, SPX: 40 }
// Free shipping once the post-discount product total (after coupon + points) reaches this amount.
// Must match FREE_SHIPPING_THRESHOLD in src/app/api/orders/route.ts (server is authoritative).
const FREE_SHIPPING_THRESHOLD = 1000

export default function CheckoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { items, total, remainingTotal, clearCart } = useCart()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shipping, setShipping] = useState('SPX')
  const [payment, setPayment]   = useState('PromptPay')

  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [showAddressPicker, setShowAddressPicker] = useState(false)
  const [saveAddress, setSaveAddress] = useState(true)

  // Points & Coupon state
  const [userPoints, setUserPoints] = useState(0)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [couponCode, setCouponCode] = useState('')
  const [couponResult, setCouponResult] = useState<null | { discount: number; freeShipping: boolean; type: string; value: number }>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  // useForm ต้องประกาศก่อน useEffect ที่ใช้ reset
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      shippingMethod: 'SPX', paymentMethod: 'PromptPay',
      province: '', district: '', subdistrict: '', postalCode: '',
    },
  })

  // Address parts are driven by the cascading <ThaiAddressSelect>; mirror them
  // into RHF (registered as hidden inputs) so zod validation + submit still work.
  const addrParts = {
    province:    watch('province')    ?? '',
    district:    watch('district')    ?? '',
    subdistrict: watch('subdistrict') ?? '',
    postalCode:  watch('postalCode')  ?? '',
  }

  // Rehydrate cart from localStorage (skipHydration: true in store)
  useEffect(() => {
    useCart.persist.rehydrate()
    setMounted(true)
  }, [])

  // Reset couponResult เมื่อจำนวนสินค้าใน cart เปลี่ยน (ป้องกัน stale discount)
  useEffect(() => {
    if (couponResult) {
      setCouponResult(null)
      setCouponCode('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  // Fill form from a saved address
  const applyAddress = useCallback((addr: SavedAddress) => {
    reset({
      recipientName:  addr.name,
      phone:          addr.phone,
      address:        addr.address,
      subdistrict:    addr.subdistrict ?? '',
      district:       addr.district  ?? '',
      province:       addr.province,
      postalCode:     addr.postal    ?? '',
      shippingMethod: shipping,
      paymentMethod:  payment,
    })
    setShowAddressPicker(false)
    toast.success(`เลือกที่อยู่ "${addr.label}" แล้ว`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, shipping, payment])

  // Fetch user points and saved addresses when session is available
  useEffect(() => {
    if (session) {
      fetch('/api/user/points')
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d) setUserPoints(d.points ?? 0) })
        .catch(() => {})

      fetch('/api/user/addresses')
        .then((r) => r.ok ? r.json() : null)
        .then((d: { data: SavedAddress[] } | null) => {
          if (d?.data?.length) {
            setSavedAddresses(d.data)
            // Auto-fill default address
            const def = d.data.find((a) => a.isDefault) ?? d.data[0]
            reset({
              recipientName:  def.name,
              phone:          def.phone,
              address:        def.address,
              subdistrict:    def.subdistrict ?? '',
              district:       def.district  ?? '',
              province:       def.province,
              postalCode:     def.postal    ?? '',
              shippingMethod: 'SPX',
              paymentMethod:  'PromptPay',
            })
          }
        })
        .catch(() => {})
    }
  }, [session, reset])

  async function validateCoupon() {
    if (!couponCode.trim()) return
    setCouponLoading(true)
    setCouponError('')
    setCouponResult(null)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal: total(),
          // Send the cart so the server can scope category-restricted coupons.
          items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        }),
      })
      if (!res.ok) {
        setCouponError('เกิดข้อผิดพลาด กรุณาลองใหม่')
        return
      }
      const data = await res.json()
      if (data.valid) {
        setCouponResult({ discount: data.discount, freeShipping: data.freeShipping, type: data.coupon.type, value: data.coupon.value })
        toast.success('ใช้คูปองสำเร็จ!')
      } else {
        setCouponError(data.error || 'คูปองไม่ถูกต้อง')
      }
    } catch {
      setCouponError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setCouponLoading(false)
    }
  }

  // ── Loading states ────────────────────────────────────────
  if (!mounted || status === 'loading') {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--ink-3)', fontSize: '.9rem' }}>กำลังโหลด…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <p style={{ color: 'var(--ink-2)', fontSize: '.9rem' }}>กรุณาเข้าสู่ระบบก่อนสั่งซื้อ</p>
        <Link href="/login?callbackUrl=/checkout" style={{
          display: 'inline-block', padding: '10px 28px',
          background: 'var(--sienna)', color: '#fff',
          borderRadius: 'var(--r)', fontWeight: 600, fontSize: '.85rem',
        }}>
          เข้าสู่ระบบ
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', opacity: .3 }}>🛒</div>
        <p style={{ color: 'var(--ink-2)', fontSize: '.9rem' }}>ตะกร้าสินค้าว่างอยู่</p>
        <Link href="/" style={{
          display: 'inline-block', padding: '10px 28px',
          background: 'var(--ink)', color: 'var(--paper)',
          borderRadius: 'var(--r)', fontWeight: 600, fontSize: '.85rem',
        }}>
          เลือกสินค้า
        </Link>
      </div>
    )
  }

  async function onSubmit(data: Form) {
    // Safety net for the card ceiling: the option is disabled when over the limit,
    // but re-check here in case the cart changed after card was selected.
    if (payment === 'Credit Card' && grandTotal > CARD_MAX_TOTAL) {
      toast.error(`รับชำระด้วยบัตรเครดิตได้ไม่เกิน ฿${CARD_MAX_TOTAL.toLocaleString()} (ยอดของคุณ ฿${grandTotal.toLocaleString()}) กรุณาเลือกโอนเงิน / PromptPay`)
      setPayment('PromptPay')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          shippingMethod: shipping,
          paymentMethod: payment,
          couponCode: couponResult ? couponCode.trim() : undefined,
          pointsToUse: pointsToUse,
          items: items.map((i) => ({
            productId:    i.id,
            quantity:     i.quantity,
            payFullPrice: i.payFullPrice ?? false,
          })),
        }),
      })
      if (!res.ok) {
        let errMsg = 'สั่งซื้อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
        try {
          const d = await res.json()
          if (d?.error) errMsg = d.error
          else if (d?.details) errMsg = 'ข้อมูลไม่ครบถ้วน กรุณาตรวจสอบอีกครั้ง'
        } catch { /* ignore parse error */ }
        toast.error(errMsg)
        return
      }
      const orderData = await res.json()
      const orderNumber = orderData?.data?.orderNumber ?? orderData?.orderNumber
      if (saveAddress) {
        fetch('/api/user/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label:       'ที่อยู่จัดส่ง',
            name:        data.recipientName,
            phone:       data.phone,
            address:     data.address,
            subdistrict: data.subdistrict,
            district:    data.district,
            province:    data.province,
            postal:      data.postalCode,
          }),
        }).catch(() => {})
      }
      clearCart()
      toast.success('สั่งซื้อสำเร็จแล้ว! 🎉')
      router.push(`/orders/${orderNumber}/payment`)
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const subtotal = total()                  // deposit-adjusted total
  const cartRemainingBalance = remainingTotal() // ส่วนที่ยังไม่จ่าย (preorder balance)
  const couponDiscount = couponResult?.discount ?? 0
  const pointsDiscount = pointsToUse
  // Free shipping when a FREE_SHIPPING coupon applies OR the product total after coupon +
  // points discounts reaches the threshold. Evaluated on the FULL product value (deposit +
  // balance) to mirror the server — so a high-value preorder still qualifies.
  const isDeposit = cartRemainingBalance > 0
  const fullProductNet = subtotal + cartRemainingBalance - couponDiscount - pointsDiscount
  const freeShipping = !!couponResult?.freeShipping || fullProductNet >= FREE_SHIPPING_THRESHOLD
  const methodFee = freeShipping ? 0 : (SHIPPING_FEE[shipping] ?? 60)
  // Deposit orders: shipping isn't charged with the deposit — it's collected with the
  // balance. Non-deposit orders pay it now.
  const shippingFee = isDeposit ? 0 : methodFee
  const balanceShippingFee = isDeposit ? methodFee : 0
  // Credit-card surcharge (+5% on net payable). Mirrors the server — see CARD_SURCHARGE_RATE
  // in src/app/api/orders/route.ts. Points are earned on the pre-surcharge amount.
  const payableBeforeCard = Math.max(0, subtotal + shippingFee - couponDiscount - pointsDiscount)
  const cardSurcharge = payment === 'Credit Card' ? Math.round(payableBeforeCard * 0.05 * 100) / 100 : 0
  const grandTotal = payableBeforeCard + cardSurcharge
  const pointsToEarn = Math.floor(payableBeforeCard / 100)
  // Credit card has a hard ceiling (manual payment-link flow). Gate the option by
  // the amount that WOULD be charged if paying by card (payable + 5%). Server re-checks.
  const projectedCardTotal = payableBeforeCard + Math.round(payableBeforeCard * 0.05 * 100) / 100
  const cardAllowed = projectedCardTotal <= CARD_MAX_TOTAL
  // How much more (after discounts) the customer needs to spend to unlock free shipping
  const freeShipRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - fullProductNet)

  return (
    <div style={S.page}>
      {/* Title */}
      <div className="eyebrow" style={{ marginBottom: 6 }}>Checkout</div>
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: '1.8rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 32 }}>
        ยืนยันคำสั่งซื้อ
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: Form ── */}
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Shipping Info */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '.88rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid var(--divider)' }}>
              <span>📦 ข้อมูลจัดส่ง</span>
              {savedAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAddressPicker(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px',
                    background: 'var(--sienna-bg)',
                    color: 'var(--sienna)',
                    border: '1.5px solid var(--sienna)',
                    borderRadius: 'var(--r)',
                    fontSize: '.72rem', fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📋 เลือกที่อยู่ที่บันทึกไว้
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>ชื่อ-นามสกุลผู้รับ</label>
                <input {...register('recipientName')} style={S.input} placeholder="ชื่อเต็ม" />
                {errors.recipientName && <p style={S.error}>{errors.recipientName.message}</p>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>เบอร์โทรศัพท์</label>
                <input {...register('phone')} style={S.input} placeholder="0812345678" />
                {errors.phone && <p style={S.error}>{errors.phone.message}</p>}
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>ที่อยู่ (บ้านเลขที่ ถนน ซอย หมู่)</label>
                <input {...register('address')} style={S.input} placeholder="123 ถนน..." />
                {errors.address && <p style={S.error}>{errors.address.message}</p>}
              </div>

              {/* Cascading จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ (เติมอัตโนมัติ).
                  Values live in RHF via these hidden inputs; the select drives them. */}
              <input type="hidden" {...register('province')} />
              <input type="hidden" {...register('district')} />
              <input type="hidden" {...register('subdistrict')} />
              <input type="hidden" {...register('postalCode')} />
              <ThaiAddressSelect
                value={addrParts}
                onChange={(v) => {
                  setValue('province',    v.province,    { shouldValidate: true })
                  setValue('district',    v.district,    { shouldValidate: true })
                  setValue('subdistrict', v.subdistrict, { shouldValidate: true })
                  setValue('postalCode',  v.postalCode,  { shouldValidate: true })
                }}
                inputStyle={S.input}
                labelStyle={S.label}
              />

            </div>
            {(errors.province || errors.district || errors.subdistrict || errors.postalCode) && (
              <p style={S.error}>
                {errors.province?.message || errors.district?.message || errors.subdistrict?.message || errors.postalCode?.message}
              </p>
            )}

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              cursor: 'pointer',
              fontSize: '.8rem',
              color: 'var(--ink-2)',
              fontWeight: 600,
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                style={{ accentColor: 'var(--sienna)', width: 15, height: 15, cursor: 'pointer' }}
              />
              💾 บันทึกที่อยู่นี้สำหรับครั้งต่อไป
            </label>

          </div>

          {/* Shipping Method */}
          <div style={S.card}>
            <div style={S.sectionTitle}>🚚 วิธีจัดส่ง</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {[
                { id: 'Store Pickup',  label: '🏪 Store Pickup', fee: 'ฟรี' },
                { id: 'SPX',           label: '🚀 SPX',          fee: '฿40' },
              ].map(({ id, label, fee }) => (
                <button key={id} type="button" onClick={() => setShipping(id)} style={{
                  ...S.radioCard(shipping === id),
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '10px 8px', textAlign: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: '.8rem' }}>{label}</span>
                  <span style={{ fontSize: '.72rem', opacity: .75 }}>{fee}</span>
                </button>
              ))}
            </div>
          </div>


          {/* Payment Method */}
          <div style={S.card}>
            <div style={S.sectionTitle}>💳 วิธีชำระเงิน</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { id: 'PromptPay',   label: '🏦 โอน / PromptPay', note: 'ไม่มีค่าบริการ' },
                { id: 'Credit Card', label: '💳 บัตรเครดิต',       note: '+5% ค่าบริการ' },
              ].map(({ id, label, note }) => {
                const disabled = id === 'Credit Card' && !cardAllowed
                return (
                  <button key={id} type="button" disabled={disabled}
                    onClick={() => { if (!disabled) setPayment(id) }} style={{
                    ...S.radioCard(payment === id),
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '12px 8px', gap: 4,
                    opacity: disabled ? .45 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}>
                    <span style={{ fontSize: '.84rem' }}>{label}</span>
                    <span style={{ fontSize: '.72rem', opacity: .8 }}>{disabled ? `เกิน ฿${CARD_MAX_TOTAL.toLocaleString()}` : note}</span>
                  </button>
                )
              })}
            </div>
            {!cardAllowed && (
              <p style={{ fontSize: '.74rem', color: '#92610a', background: '#fff3cd', border: '1px solid #ffe08a', borderRadius: 'var(--r)', padding: '8px 12px', marginTop: 12, lineHeight: 1.5 }}>
                ⚠️ รับชำระด้วยบัตรเครดิตได้<strong>ไม่เกิน ฿{CARD_MAX_TOTAL.toLocaleString()}</strong> — ยอดของคุณเกินกำหนด กรุณาเลือกโอนเงิน / PromptPay
              </p>
            )}
            {payment === 'Credit Card' && cardAllowed && (
              <p style={{ fontSize: '.74rem', color: '#92610a', background: '#fff3cd', border: '1px solid #ffe08a', borderRadius: 'var(--r)', padding: '8px 12px', marginTop: 12, lineHeight: 1.5 }}>
                💬 หลังสั่งซื้อ กรุณา<strong>ทักเพจ</strong>เพื่อรับลิงก์ชำระผ่านบัตรเครดิต (มีค่าบริการ +5% รวมในยอดแล้ว)
              </p>
            )}
          </div>

          {/* Note */}
          <div style={S.card}>
            <label style={S.label}>หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              {...register('note')}
              style={{ ...S.input, height: 80, resize: 'none' }}
              placeholder="ข้อความพิเศษ เช่น เวลาจัดส่ง..."
            />
          </div>

          {/* Coupon */}
          <div style={S.card}>
            <div style={S.sectionTitle}>🎟️ คูปองส่วนลด</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                style={{
                  ...S.input,
                  flex: 1,
                  border: couponResult
                    ? '1.5px solid #28a745'
                    : couponError
                    ? '1.5px solid #dc3545'
                    : '1.5px solid var(--divider)',
                }}
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  if (couponResult) { setCouponResult(null) }
                  if (couponError) { setCouponError('') }
                }}
                placeholder="รหัสคูปอง"
                disabled={!!couponResult}
              />
              {couponResult ? (
                <button
                  type="button"
                  onClick={() => { setCouponResult(null); setCouponCode(''); setCouponError('') }}
                  style={{
                    padding: '9px 16px',
                    background: 'var(--paper-2)',
                    border: '1.5px solid var(--divider)',
                    borderRadius: 'var(--r)',
                    color: 'var(--ink-2)',
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ยกเลิก
                </button>
              ) : (
                <button
                  type="button"
                  onClick={validateCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  style={{
                    padding: '9px 16px',
                    background: 'var(--sienna)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r)',
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: couponLoading || !couponCode.trim() ? .5 : 1,
                  }}
                >
                  {couponLoading ? 'กำลังตรวจสอบ…' : 'ใช้คูปอง'}
                </button>
              )}
            </div>
            {couponResult && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 'var(--r)', fontSize: '.8rem', color: '#155724', fontWeight: 600 }}>
                {couponResult.freeShipping
                  ? '✓ ฟรีค่าจัดส่ง!'
                  : `✓ ส่วนลด ฿${couponResult.discount.toLocaleString()}`}
              </div>
            )}
            {couponError && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 'var(--r)', fontSize: '.8rem', color: '#721c24', fontWeight: 600 }}>
                {couponError}
              </div>
            )}
          </div>

          {/* Points */}
          <div style={S.card}>
            <div style={S.sectionTitle}>⭐ แต้มสะสม</div>
            <div style={{ fontSize: '.82rem', color: 'var(--ink-2)', marginBottom: 12 }}>
              แต้มของคุณ: <strong style={{ color: 'var(--sienna)' }}>{userPoints.toLocaleString()} แต้ม</strong>
              <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>(1 แต้ม = ฿1)</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="number"
                min={0}
                max={Math.min(userPoints, subtotal)}
                value={pointsToUse}
                onChange={(e) => {
                  const val = Math.min(Number(e.target.value), userPoints, subtotal)
                  setPointsToUse(Math.max(0, Math.floor(val)))
                }}
                style={{ ...S.input, width: 140 }}
                placeholder="0"
              />
              <button
                type="button"
                onClick={() => setPointsToUse(Math.min(userPoints, Math.floor(subtotal)))}
                style={{
                  padding: '9px 14px',
                  background: 'var(--sienna-bg)',
                  color: 'var(--sienna)',
                  border: '1.5px solid var(--sienna)',
                  borderRadius: 'var(--r)',
                  fontSize: '.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ใช้ทั้งหมด
              </button>
              {pointsToUse > 0 && (
                <span style={{ fontSize: '.8rem', color: '#28a745', fontWeight: 600 }}>
                  ลด ฿{pointsToUse.toLocaleString()}
                </span>
              )}
            </div>
            {userPoints === 0 && (
              <p style={{ fontSize: '.75rem', color: 'var(--ink-3)', marginTop: 8 }}>คุณยังไม่มีแต้มสะสม</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{ ...S.submitBtn, opacity: loading ? .7 : 1 }}
          >
            {loading
              ? 'กำลังดำเนินการ…'
              : `สั่งซื้อ · ฿${grandTotal.toLocaleString()}`}
          </button>

        </form>

        {/* ── RIGHT: Order Summary ── */}
        <div style={{ ...S.card, position: 'sticky', top: 24 }}>
          <div style={S.sectionTitle}>🛒 สรุปคำสั่งซื้อ</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem', width: 32, textAlign: 'center', flexShrink: 0 }}>
                  {item.emoji || '🃏'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: '.7rem', color: 'var(--ink-3)' }}>
                    {item.condition} · จำนวน {item.quantity}
                  </p>
                  {!!item.maxPerOrder && (
                    <p style={{ fontSize: '.65rem', color: 'var(--sienna)', fontWeight: 600, marginTop: 2 }}>
                      สูงสุด {item.maxPerOrder} ชิ้น/ออเดอร์
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {item.isPreorder && item.depositPercent ? (
                    <>
                      <div style={{ fontFamily: "'Lora', serif", fontSize: '.9rem', fontWeight: 600, color: 'var(--sienna)' }}>
                        ฿{(Math.round(item.price * item.depositPercent / 100 * 100) / 100 * item.quantity).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '.65rem', color: 'var(--ink-3)', textDecoration: 'line-through' }}>
                        ฿{(item.price * item.quantity).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '.65rem', color: '#7c5cff', fontWeight: 600 }}>
                        มัดจำ {item.depositPercent}%
                      </div>
                    </>
                  ) : (
                    <span style={{ fontFamily: "'Lora', serif", fontSize: '.9rem', fontWeight: 600, color: 'var(--sienna)' }}>
                      ฿{(item.price * item.quantity).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--divider)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--ink-2)' }}>
              <span>ยอดสินค้า</span>
              <span>฿{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--ink-2)' }}>
              <span>ค่าจัดส่ง ({shipping})</span>
              {isDeposit ? (
                <span style={{ color: 'var(--ink-3)', fontSize: '.78rem' }}>
                  {balanceShippingFee > 0 ? 'คิดตอนชำระส่วนที่เหลือ' : 'ฟรี'}
                </span>
              ) : freeShipping ? (
                <span style={{ color: '#28a745', fontWeight: 600 }}>ฟรี!</span>
              ) : (
                <span>฿{shippingFee.toLocaleString()}</span>
              )}
            </div>
            {/* Free-shipping nudge — only when not yet qualifying and shipping isn't already free.
                For deposit orders shipping is deferred, so the nudge below the balance note covers it. */}
            {!isDeposit && !freeShipping && shippingFee > 0 && freeShipRemaining > 0 && (
              <div style={{ fontSize: '.72rem', color: 'var(--sienna)', background: 'var(--sienna-bg)', borderRadius: 'var(--r)', padding: '6px 10px' }}>
                🚚 ซื้อเพิ่มอีก ฿{freeShipRemaining.toLocaleString()} (หลังหักส่วนลด) รับส่งฟรี!
              </div>
            )}
            {couponDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#28a745', fontWeight: 600 }}>
                <span>ส่วนลดคูปอง</span>
                <span>-฿{couponDiscount.toLocaleString()}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: '#28a745', fontWeight: 600 }}>
                <span>ส่วนลดแต้มสะสม</span>
                <span>-฿{pointsDiscount.toLocaleString()}</span>
              </div>
            )}
            {cardSurcharge > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--ink-2)' }}>
                <span>ค่าบริการบัตรเครดิต (5%)</span>
                <span>+฿{cardSurcharge.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--divider)', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontSize: '.9rem', color: 'var(--ink)', fontWeight: 700 }}>
                {cartRemainingBalance > 0 ? 'ยอดชำระ (มัดจำ)' : 'ยอดชำระ'}
              </span>
              <span style={{ fontFamily: "'Lora', serif", fontSize: '1.4rem', fontWeight: 700, color: 'var(--sienna)' }}>
                ฿{grandTotal.toLocaleString()}
              </span>
            </div>
            {cartRemainingBalance > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.8rem', padding: '8px 12px', background: '#f3f0ff', borderRadius: 'var(--r)', border: '1px solid #d4c8ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#5b3fe0', fontWeight: 600 }}>💜 ยอดค้างชำระ (จ่ายเมื่อของมาถึง)</span>
                  <span style={{ color: '#5b3fe0', fontWeight: 700, fontFamily: "'Lora', serif" }}>
                    ฿{(cartRemainingBalance + balanceShippingFee).toLocaleString()}
                  </span>
                </div>
                {balanceShippingFee > 0 && (
                  <div style={{ fontSize: '.72rem', color: '#7a6e9e' }}>
                    (ยอดสินค้า ฿{cartRemainingBalance.toLocaleString()} + ค่าจัดส่ง ฿{balanceShippingFee.toLocaleString()})
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: '.72rem', color: 'var(--ink-3)', textAlign: 'right' }}>
              ได้รับแต้ม: <strong style={{ color: 'var(--sienna)' }}>{pointsToEarn} แต้ม</strong>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: '.72rem', color: 'var(--ink-3)', lineHeight: 1.6 }}>
            <div>📦 จัดส่ง: <strong style={{ color: 'var(--ink-2)' }}>{shipping}</strong></div>
            <div>💳 ชำระ: <strong style={{ color: 'var(--ink-2)' }}>{payment}</strong></div>
          </div>
        </div>

      </div>

      {/* ── Address Picker Modal ── */}
      {showAddressPicker && (
        <div
          onClick={() => setShowAddressPicker(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 'var(--r-lg)',
              padding: '24px',
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Lora', serif", fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
                📋 เลือกที่อยู่จัดส่ง
              </h2>
              <button
                type="button"
                onClick={() => setShowAddressPicker(false)}
                style={{
                  width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--divider)',
                  borderRadius: '50%',
                  fontSize: '.9rem',
                  cursor: 'pointer',
                  color: 'var(--ink-2)',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Address list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => applyAddress(addr)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    background: addr.isDefault ? 'var(--sienna-bg)' : '#fafaf9',
                    border: `1.5px solid ${addr.isDefault ? 'var(--sienna)' : 'var(--divider)'}`,
                    borderRadius: 'var(--r-lg)',
                    cursor: 'pointer',
                    transition: 'border-color .15s, background .15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!addr.isDefault) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--sienna)'
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--sienna-bg)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!addr.isDefault) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--divider)'
                      ;(e.currentTarget as HTMLButtonElement).style.background = '#fafaf9'
                    }
                  }}
                >
                  {/* Label row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <span style={{
                      fontSize: '.65rem', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99,
                      background: addr.isDefault ? 'var(--sienna)' : 'var(--paper-2)',
                      color: addr.isDefault ? '#fff' : 'var(--ink-2)',
                      border: addr.isDefault ? 'none' : '1px solid var(--divider)',
                    }}>
                      {addr.isDefault ? '⭐ ค่าเริ่มต้น' : addr.label}
                    </span>
                    {addr.isDefault && (
                      <span style={{ fontSize: '.65rem', color: 'var(--ink-3)' }}>{addr.label}</span>
                    )}
                  </div>
                  {/* Name & phone */}
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--ink)', marginBottom: 3 }}>
                    {addr.name}
                    <span style={{ fontWeight: 500, color: 'var(--ink-3)', marginLeft: 8, fontSize: '.78rem' }}>
                      {addr.phone}
                    </span>
                  </div>
                  {/* Full address */}
                  <div style={{ fontSize: '.78rem', color: 'var(--ink-2)', lineHeight: 1.5 }}>
                    {addr.address}
                    {addr.subdistrict ? ` ${addr.subdistrict}` : ''}
                    {addr.district ? ` ${addr.district}` : ''}
                    {` ${addr.province}`}
                    {addr.postal ? ` ${addr.postal}` : ''}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer link */}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Link
                href="/account"
                style={{ fontSize: '.75rem', color: 'var(--sienna)', textDecoration: 'none', fontWeight: 600 }}
                onClick={() => setShowAddressPicker(false)}
              >
                จัดการที่อยู่ →
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
