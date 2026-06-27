const WEBHOOK_URL = process.env.DISCORD_ORDER_WEBHOOK_URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL

type OrderItem = {
  productName: string
  quantity: number
  price: number | { toNumber(): number }
}

type OrderPayload = {
  orderNumber: string
  recipientName: string | null
  phone: string | null
  province: string | null
  shippingMethod: string | null
  paymentMethod: string | null
  total: number | { toNumber(): number }
  discount: number | { toNumber(): number }
  shippingFee: number | { toNumber(): number }
  surcharge: number | { toNumber(): number }
  note?: string | null
  items: OrderItem[]
}

export async function sendOrderNotification(order: OrderPayload) {
  if (!WEBHOOK_URL) return

  const toNum = (v: number | { toNumber(): number }) =>
    typeof v === 'object' ? v.toNumber() : Number(v)

  const total = toNum(order.total)
  const discount = toNum(order.discount)
  const shippingFee = toNum(order.shippingFee)
  const surcharge = toNum(order.surcharge)

  const itemLines = order.items
    .map((i) => `• ${i.productName} × ${i.quantity}  (฿${toNum(i.price).toLocaleString()}/ชิ้น)`)
    .join('\n')

  const fields = [
    { name: 'ลูกค้า', value: `${order.recipientName ?? '-'}  |  ${order.phone ?? '-'}`, inline: false },
    { name: 'จังหวัด', value: order.province ?? '-', inline: true },
    { name: 'ขนส่ง', value: order.shippingMethod ?? '-', inline: true },
    { name: 'ชำระ', value: order.paymentMethod ?? '-', inline: true },
    { name: 'สินค้า', value: itemLines || '-', inline: false },
  ]

  if (discount > 0) fields.push({ name: 'ส่วนลด', value: `-฿${discount.toLocaleString()}`, inline: true })
  if (shippingFee > 0) fields.push({ name: 'ค่าส่ง', value: `฿${shippingFee.toLocaleString()}`, inline: true })
  if (surcharge > 0) fields.push({ name: 'ค่าธรรมเนียมบัตร', value: `฿${surcharge.toLocaleString()}`, inline: true })
  if (order.note) fields.push({ name: 'หมายเหตุ', value: order.note, inline: false })

  const payload = {
    embeds: [
      {
        title: `🛒  ออเดอร์ใหม่  #${order.orderNumber}`,
        color: 0x22c55e,
        fields,
        footer: { text: `ยอดรวม  ฿${total.toLocaleString()}` },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[discord] webhook rejected ${res.status}:`, text)
    }
  } catch (err) {
    console.error('[discord] sendOrderNotification failed:', err)
  }
}

type SlipPayload = {
  orderNumber: string
  recipientName: string | null
  phone: string | null
  total: number | { toNumber(): number }
}

// แจ้งเตือน admin เมื่อลูกค้าอัปโหลดสลิปยืนยันการชำระเงิน — ใช้ webhook ช่องเดียวกับออเดอร์ใหม่
export async function sendSlipNotification(slip: SlipPayload) {
  if (!WEBHOOK_URL) return

  const toNum = (v: number | { toNumber(): number }) =>
    typeof v === 'object' ? v.toNumber() : Number(v)

  const total = toNum(slip.total)

  const fields = [
    { name: 'ลูกค้า', value: `${slip.recipientName ?? '-'}  |  ${slip.phone ?? '-'}`, inline: false },
    { name: 'ยอดที่ต้องตรวจ', value: `฿${total.toLocaleString()}`, inline: true },
  ]

  if (APP_URL) {
    fields.push({ name: 'ตรวจสลิป', value: `[เปิดหน้าจัดการออเดอร์](${APP_URL}/admin/orders)`, inline: false })
  }

  const payload = {
    embeds: [
      {
        title: `📸  ลูกค้าส่งสลิปแล้ว  #${slip.orderNumber}`,
        description: 'รอแอดมินตรวจสอบและยืนยันการชำระเงิน',
        color: 0xf59e0b, // amber — รอตรวจสอบ
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[discord] slip webhook rejected ${res.status}:`, text)
    }
  } catch (err) {
    console.error('[discord] sendSlipNotification failed:', err)
  }
}

type BalanceSlipPayload = {
  orderNumber: string
  recipientName: string | null
  phone: string | null
  remainingBalance: number | { toNumber(): number }
}

// แจ้งเตือน admin เมื่อลูกค้าส่งสลิป "ยอดคงเหลือ" (พรีออเดอร์รอบสอง) — ช่อง webhook เดียวกัน
export async function sendBalanceSlipNotification(slip: BalanceSlipPayload) {
  if (!WEBHOOK_URL) return

  const toNum = (v: number | { toNumber(): number }) =>
    typeof v === 'object' ? v.toNumber() : Number(v)

  const remaining = toNum(slip.remainingBalance)

  const fields = [
    { name: 'ลูกค้า', value: `${slip.recipientName ?? '-'}  |  ${slip.phone ?? '-'}`, inline: false },
    { name: 'ยอดคงเหลือที่ต้องตรวจ', value: `฿${remaining.toLocaleString()}`, inline: true },
  ]

  if (APP_URL) {
    fields.push({ name: 'ตรวจสลิป', value: `[เปิดหน้าจัดการออเดอร์](${APP_URL}/admin/orders)`, inline: false })
  }

  const payload = {
    embeds: [
      {
        title: `💰  ลูกค้าส่งสลิปยอดคงเหลือ  #${slip.orderNumber}`,
        description: 'รอแอดมินตรวจสอบและยืนยันยอดคงเหลือ (พรีออเดอร์)',
        color: 0x8b5cf6, // violet — ยอดคงเหลือ
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[discord] balance slip webhook rejected ${res.status}:`, text)
    }
  } catch (err) {
    console.error('[discord] sendBalanceSlipNotification failed:', err)
  }
}
