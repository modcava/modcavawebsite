const WEBHOOK_URL = process.env.DISCORD_ORDER_WEBHOOK_URL

type OrderItem = {
  productName: string
  quantity: number
  price: number | { toNumber(): number }
}

type OrderPayload = {
  orderNumber: string
  recipientName: string
  phone: string
  province: string
  shippingMethod: string
  paymentMethod: string
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
    { name: 'ลูกค้า', value: `${order.recipientName}  |  ${order.phone}`, inline: false },
    { name: 'จังหวัด', value: order.province, inline: true },
    { name: 'ขนส่ง', value: order.shippingMethod, inline: true },
    { name: 'ชำระ', value: order.paymentMethod, inline: true },
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
        color: 0x22c55e, // green-500
        fields,
        footer: { text: `ยอดรวม  ฿${total.toLocaleString()}` },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    // Non-critical — log and continue
    console.error('[discord] sendOrderNotification failed:', err)
  }
}
