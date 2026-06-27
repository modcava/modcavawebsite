import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   ?? 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Escape ค่าที่ผู้ใช้/แอดมินกรอก (เช่น ชื่อ, ชื่อสินค้า, เลขพัสดุ) ก่อนฝังลง HTML email
 * — กัน HTML injection. ไม่ใช้กับ URL ที่ระบบสร้างเอง หรือ HTML ที่แอดมินตั้งใจส่ง
 * (sendCustomEmail).
 */
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** ส่งอีเมล HTML ตรงๆ ผ่าน SMTP — ใช้ร่วมกันทั้งเมลแจ้งเตือนออเดอร์และเมลที่แอดมินพิมพ์เอง */
export async function sendCustomEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const from    = process.env.SMTP_FROM ?? `"${appName}" <noreply@modcava.com>`
  return transporter.sendMail({ from, to, subject, html })
}

export async function sendResetPasswordEmail(to: string, name: string, resetUrl: string) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const from    = process.env.SMTP_FROM ?? `"${appName}" <noreply@modcava.com>`

  await transporter.sendMail({
    from,
    to,
    subject: `[${appName}] รีเซ็ตรหัสผ่านของคุณ`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">รีเซ็ตรหัสผ่าน</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(name) || 'คุณ'},<br/>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
        <a href="${resetUrl}"
          style="display:inline-block;padding:12px 28px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          รีเซ็ตรหัสผ่าน
        </a>
        <p style="color:#a08060;font-size:13px;margin-top:20px;">
          ลิงก์นี้จะหมดอายุใน <strong>1 ชั่วโมง</strong><br/>
          หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน สามารถเพิกเฉยอีเมลนี้ได้
        </p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName}</p>
      </div>
    `,
  })
}

export async function sendOrderConfirmedEmail(opts: {
  to: string
  name: string
  orderNumber: string
  total: number
  items: { productName: string; quantity: number; price: number }[]
  orderUrl?: string
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  const itemsHtml = opts.items.map((it) => `
    <tr>
      <td style="padding:6px 0;color:#6b5e4e;font-size:14px;">${esc(it.productName)} × ${it.quantity}</td>
      <td style="padding:6px 0;text-align:right;color:#2a2218;font-size:14px;white-space:nowrap;">฿${(it.price * it.quantity).toLocaleString()}</td>
    </tr>`).join('')

  const orderButton = opts.orderUrl
    ? `<a href="${opts.orderUrl}" style="display:inline-block;padding:12px 28px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;margin-top:4px;">ดูรายละเอียดออเดอร์</a>`
    : ''

  await sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] ยืนยันออเดอร์แล้ว — #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">✅ ยืนยันออเดอร์เรียบร้อยแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>เราได้รับและตรวจสอบการชำระเงินของคุณเรียบร้อยแล้ว ออเดอร์กำลังเตรียมจัดส่ง — เราจะแจ้งเลขพัสดุให้ทราบอีกครั้งเมื่อจัดส่งแล้ว</p>
        <div style="background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#6b5e4e;margin:0 0 10px;">หมายเลขออเดอร์: <strong style="color:#2a2218;">#${opts.orderNumber}</strong></p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5ddd4;">
            ${itemsHtml}
          </table>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5ddd4;margin-top:8px;">
            <tr>
              <td style="padding:10px 0 0;color:#2a2218;font-weight:700;">ยอดรวม</td>
              <td style="padding:10px 0 0;text-align:right;color:#8b5a2b;font-weight:700;font-size:16px;white-space:nowrap;">฿${opts.total.toLocaleString()}</td>
            </tr>
          </table>
        </div>
        ${orderButton}
        <p style="color:#a08060;font-size:13px;margin-top:20px;">หากมีคำถามหรือปัญหาใดๆ สามารถติดต่อเราได้ที่ Line OA หรือ Facebook: Modcavashop</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName} · 337/1 ถ.รื่นรมย์ อ.เมือง จ.ขอนแก่น 40000</p>
      </div>
    `,
  })
}

// Instant "we received your order" email sent the moment an order is placed
// (before payment). Carries the order summary + payment instructions so the
// customer has a record in their inbox and a direct link to pay / upload a slip.
export async function sendOrderReceivedEmail(opts: {
  to: string
  name: string
  orderNumber: string
  items: { productName: string; quantity: number; price: number }[]
  shippingFee: number
  balanceShippingFee?: number // deposit orders: shipping deferred to the balance payment (0 if none / charged now)
  discount: number
  pointsUsed: number
  surcharge: number
  total: number             // amount payable now
  remainingBalance: number  // preorder balance owed on delivery (0 if none)
  pointsEarned: number
  paymentMethod: string     // 'PromptPay' | 'Credit Card'
  paymentUrl: string
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const isCard  = opts.paymentMethod === 'Credit Card'

  const subtotal = opts.items.reduce((s, it) => s + it.price * it.quantity, 0)

  const itemsHtml = opts.items.map((it) => `
    <tr>
      <td style="padding:6px 0;color:#6b5e4e;font-size:14px;">${esc(it.productName)} × ${it.quantity}</td>
      <td style="padding:6px 0;text-align:right;color:#2a2218;font-size:14px;white-space:nowrap;">฿${(it.price * it.quantity).toLocaleString()}</td>
    </tr>`).join('')

  // Summary rows (only render the ones that apply)
  const row = (label: string, value: string, color = '#6b5e4e') => `
    <tr>
      <td style="padding:4px 0;color:${color};font-size:14px;">${label}</td>
      <td style="padding:4px 0;text-align:right;color:${color};font-size:14px;white-space:nowrap;">${value}</td>
    </tr>`
  const balanceShip = opts.balanceShippingFee ?? 0
  // Deposit orders don't pay shipping with the deposit — it's collected with the balance.
  const shipValue = balanceShip > 0
    ? 'คิดตอนชำระยอดคงเหลือ'
    : (opts.shippingFee > 0 ? `฿${opts.shippingFee.toLocaleString()}` : 'ฟรี')
  const summaryRows = [
    row('ยอดสินค้า', `฿${subtotal.toLocaleString()}`),
    row('ค่าจัดส่ง', shipValue),
    opts.discount  > 0 ? row('ส่วนลดคูปอง', `-฿${opts.discount.toLocaleString()}`, '#2d7a42') : '',
    opts.pointsUsed > 0 ? row('ส่วนลดแต้มสะสม', `-฿${opts.pointsUsed.toLocaleString()}`, '#2d7a42') : '',
    opts.surcharge > 0 ? row('ค่าบริการบัตรเครดิต (5%)', `+฿${opts.surcharge.toLocaleString()}`) : '',
  ].join('')

  const remainingHtml = opts.remainingBalance > 0
    ? `<p style="background:#f3f0ff;border:1px solid #d4c8ff;border-radius:8px;padding:10px 14px;color:#5b3fe0;font-size:13px;margin:0 0 16px;">💜 ยอดค้างชำระ (จ่ายเมื่อของมาถึง): <strong>฿${(opts.remainingBalance + balanceShip).toLocaleString()}</strong>${balanceShip > 0 ? ` <span style="color:#7a6e5e;">(รวมค่าจัดส่ง ฿${balanceShip.toLocaleString()})</span>` : ''}</p>`
    : ''

  const payInstructions = isCard
    ? 'กรุณากดปุ่มด้านล่างเพื่อ <strong>ทักเพจรับลิงก์ชำระผ่านบัตรเครดิต</strong> ภายใน 48 ชั่วโมง'
    : 'กรุณาโอนเงินตามยอดด้านบน แล้ว <strong>แนบสลิปการโอน</strong> ที่ปุ่มด้านล่าง'

  await sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] ได้รับคำสั่งซื้อแล้ว · รอชำระเงิน — #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">🧾 เราได้รับคำสั่งซื้อของคุณแล้ว</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>ขอบคุณสำหรับการสั่งซื้อ! ออเดอร์ของคุณอยู่ในสถานะ <strong style="color:#2a2218;">รอชำระเงิน</strong> — ${payInstructions}</p>
        <div style="background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px 20px;margin-bottom:16px;">
          <p style="color:#6b5e4e;margin:0 0 10px;">หมายเลขออเดอร์: <strong style="color:#2a2218;">#${opts.orderNumber}</strong></p>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5ddd4;">
            ${itemsHtml}
          </table>
          <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5ddd4;margin-top:6px;padding-top:6px;">
            ${summaryRows}
            <tr>
              <td style="padding:10px 0 0;color:#2a2218;font-weight:700;border-top:1px solid #e5ddd4;">ยอดชำระ</td>
              <td style="padding:10px 0 0;text-align:right;color:#8b5a2b;font-weight:700;font-size:16px;white-space:nowrap;border-top:1px solid #e5ddd4;">฿${opts.total.toLocaleString()}</td>
            </tr>
          </table>
        </div>
        ${remainingHtml}
        <div style="background:#fff8e6;border:1px solid #ffe08a;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
          <p style="color:#92610a;font-size:13px;margin:0;">⏰ กรุณาชำระเงินภายใน <strong>48 ชั่วโมง</strong> มิฉะนั้นออเดอร์จะถูกยกเลิกอัตโนมัติ (แต้ม/คูปองที่ใช้จะถูกคืนให้)</p>
        </div>
        <a href="${opts.paymentUrl}"
          style="display:inline-block;padding:13px 32px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          ${isCard ? '💳 ชำระผ่านบัตรเครดิต' : '💳 ชำระเงิน & แนบสลิป'}
        </a>
        <p style="color:#a08060;font-size:13px;margin-top:20px;">คุณจะได้รับ <strong>${opts.pointsEarned.toLocaleString()} แต้ม</strong> เมื่อชำระเงินสำเร็จ · มีคำถามทักได้ที่ Line OA หรือ Facebook: Modcavashop</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName} · 337/1 ถ.รื่นรมย์ อ.เมือง จ.ขอนแก่น 40000</p>
      </div>
    `,
  })
}

// (a) แจ้งลูกค้าว่าสินค้าพรีออเดอร์มาถึง / ถึงรอบเก็บยอดคงเหลือแล้ว — แอดมินกด "แจ้งของมาถึง"
export async function sendBalanceDueEmail(opts: {
  to: string
  name: string
  orderNumber: string
  remainingBalance: number
  depositPaid: number       // ยอดมัดจำที่จ่ายไปแล้ว (Order.total)
  shippingFee?: number      // ค่าจัดส่งที่เลื่อนมาเก็บรอบนี้ (0 ถ้าฟรี/เก็บไปแล้ว)
  paymentUrl: string        // .../orders/{n}/payment?type=balance
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const shippingFee = opts.shippingFee ?? 0
  const balanceDue = opts.remainingBalance + shippingFee
  // Deposit orders defer shipping to this balance payment — show the breakdown when it applies.
  const breakdownRows = shippingFee > 0
    ? `<tr><td style="padding:4px 0;color:#6b5e4e;font-size:14px;">ยอดคงเหลือสินค้า</td><td style="padding:4px 0;text-align:right;color:#6b5e4e;font-size:14px;white-space:nowrap;">฿${opts.remainingBalance.toLocaleString()}</td></tr>
            <tr><td style="padding:4px 0;color:#6b5e4e;font-size:14px;">ค่าจัดส่ง</td><td style="padding:4px 0;text-align:right;color:#6b5e4e;font-size:14px;white-space:nowrap;">฿${shippingFee.toLocaleString()}</td></tr>`
    : ''
  // คืน result ของ SMTP (มี messageId) เพื่อให้ผู้เรียก await + รู้ผลจริงได้
  // (ใช้ระบบเดียวกับ api/admin/send-email)
  return sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] 📦 สินค้าพรีออเดอร์มาถึงแล้ว · ชำระยอดคงเหลือ — #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">📦 สินค้าพรีออเดอร์มาถึงแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>สินค้าพรีออเดอร์ในออเดอร์ <strong style="color:#2a2218;">#${opts.orderNumber}</strong> มาถึงแล้ว 🎉 เหลือเพียงชำระ<strong>ยอดคงเหลือ</strong>เพื่อให้เราจัดส่งให้คุณ</p>
        <div style="background:#f3f0ff;border:1px solid #d4c8ff;border-radius:8px;padding:16px 20px;margin-bottom:18px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:4px 0;color:#6b5e4e;font-size:14px;">มัดจำที่ชำระแล้ว</td><td style="padding:4px 0;text-align:right;color:#6b5e4e;font-size:14px;white-space:nowrap;">฿${opts.depositPaid.toLocaleString()}</td></tr>
            ${breakdownRows}
            <tr><td style="padding:8px 0 0;color:#5b3fe0;font-weight:700;border-top:1px solid #d4c8ff;">ยอดคงเหลือที่ต้องชำระ</td><td style="padding:8px 0 0;text-align:right;color:#5b3fe0;font-weight:700;font-size:18px;white-space:nowrap;border-top:1px solid #d4c8ff;">฿${balanceDue.toLocaleString()}</td></tr>
          </table>
        </div>
        <a href="${opts.paymentUrl}"
          style="display:inline-block;padding:13px 32px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          💰 ชำระยอดคงเหลือ &amp; แนบสลิป
        </a>
        <p style="color:#a08060;font-size:13px;margin-top:20px;">ชำระแล้วเราจะจัดส่งสินค้าให้ทันที · มีคำถามทักได้ที่ Line OA หรือ Facebook: Modcavashop</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName} · 337/1 ถ.รื่นรมย์ อ.เมือง จ.ขอนแก่น 40000</p>
      </div>
    `,
  })
}

// (c) ยืนยันรับยอดคงเหลือครบแล้ว — แอดมินกด "ยืนยันรับยอดคงเหลือ"
export async function sendBalancePaidEmail(opts: {
  to: string
  name: string
  orderNumber: string
  amount: number            // ยอดคงเหลือที่เพิ่งรับครบ
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  await sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] ✅ ชำระครบแล้ว · กำลังจัดเตรียมจัดส่ง — #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">✅ ชำระยอดครบเรียบร้อยแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>เราได้รับ<strong>ยอดคงเหลือ ฿${opts.amount.toLocaleString()}</strong> ของออเดอร์ <strong style="color:#2a2218;">#${opts.orderNumber}</strong> ครบถ้วนแล้ว ออเดอร์นี้ชำระเต็มจำนวนเรียบร้อย 🎉</p>
        <div style="background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
          <p style="color:#2d7a42;margin:0;font-weight:600;">📦 กำลังแพ็คและจัดเตรียมจัดส่ง — เราจะแจ้งเลขพัสดุให้ทราบอีกครั้งเมื่อจัดส่งแล้ว</p>
        </div>
        <p style="color:#a08060;font-size:13px;margin-top:4px;">ขอบคุณที่อุดหนุนครับ · มีคำถามทักได้ที่ Line OA หรือ Facebook: Modcavashop</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName} · 337/1 ถ.รื่นรมย์ อ.เมือง จ.ขอนแก่น 40000</p>
      </div>
    `,
  })
}

export async function sendShippedEmail(opts: {
  to: string
  name: string
  orderNumber: string
  shippingMethod: string
  trackingNumber?: string | null
}) {

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  const trackingLine = opts.trackingNumber
    ? `<p style="color:#6b5e4e;margin:0;">เลขพัสดุ: <strong style="color:#2a2218;">${esc(opts.trackingNumber)}</strong></p>`
    : ''

  await sendCustomEmail({
    to:      opts.to,
    subject: `[Modcava] จัดส่งแล้ว — ออเดอร์ #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">📦 พัสดุของคุณถูกจัดส่งแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>ออเดอร์ของคุณได้รับการจัดส่งเรียบร้อยแล้ว</p>
        <div style="background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;flex-direction:column;gap:8px;">
          <p style="color:#6b5e4e;margin:0;">หมายเลขออเดอร์: <strong style="color:#2a2218;">#${opts.orderNumber}</strong></p>
          <p style="color:#6b5e4e;margin:0;">ขนส่ง: <strong style="color:#2a2218;">${esc(opts.shippingMethod)}</strong></p>
          ${trackingLine}
        </div>
        <p style="color:#a08060;font-size:13px;">หากมีคำถามหรือปัญหาใดๆ สามารถติดต่อเราได้ที่ Line OA หรือ Facebook: Modcavashop</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName} · 337/1 ถ.รื่นรมย์ อ.เมือง จ.ขอนแก่น 40000</p>
      </div>
    `,
  })
}

export async function sendBackInStockEmail(opts: {
  to: string
  name: string
  productName: string
  productUrl: string
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  await sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] สินค้ากลับมาแล้ว — ${esc(opts.productName)}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">🎉 สินค้าที่คุณรอ พร้อมจำหน่ายแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/><strong style="color:#2a2218;">${esc(opts.productName)}</strong> พร้อมจำหน่ายแล้ว — รีบสั่งก่อนของจะหมด!</p>
        <a href="${opts.productUrl}"
          style="display:inline-block;padding:12px 28px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          ดูสินค้า
        </a>
        <p style="color:#a08060;font-size:13px;margin-top:20px;">สินค้ามีจำนวนจำกัด อาจหมดได้อีกครั้ง</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName}</p>
      </div>
    `,
  })
}

export async function sendOrderCancelledEmail(opts: {
  to: string
  name: string
  orderNumber: string
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  await sendCustomEmail({
    to:      opts.to,
    subject: `[${appName}] ออเดอร์ #${opts.orderNumber} ถูกยกเลิก`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">ออเดอร์ถูกยกเลิกอัตโนมัติ</h2>
        <p style="color:#6b5e4e;margin-bottom:16px;">สวัสดี ${esc(opts.name) || 'คุณ'},<br/>ออเดอร์ <strong style="color:#2a2218;">#${opts.orderNumber}</strong> ถูกยกเลิกเนื่องจากไม่ได้แนบสลิปการโอนเงินภายใน 48 ชั่วโมง</p>
        <p style="color:#6b5e4e;margin:0;">แต้มสะสมและคูปองที่ใช้ (ถ้ามี) ถูกคืนให้เรียบร้อยแล้ว — หากยังต้องการสินค้า สามารถสั่งซื้อใหม่ได้ที่ร้านค้า</p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName}</p>
      </div>
    `,
  })
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const from    = process.env.SMTP_FROM ?? `"${appName}" <noreply@modcava.com>`

  await transporter.sendMail({
    from,
    to,
    subject: `[${appName}] ยืนยันอีเมลของคุณ`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">ยินดีต้อนรับสู่ ${appName}!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${esc(name) || 'คุณ'},<br/>กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มใช้งานบัญชี</p>
        <a href="${verifyUrl}"
          style="display:inline-block;padding:12px 28px;background:#8b5a2b;color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:15px;">
          ยืนยันอีเมล
        </a>
        <p style="color:#a08060;font-size:13px;margin-top:20px;">
          ลิงก์นี้จะหมดอายุใน <strong>24 ชั่วโมง</strong><br/>
          หากคุณไม่ได้สมัครสมาชิก สามารถเพิกเฉยอีเมลนี้ได้
        </p>
        <hr style="border:none;border-top:1px solid #e5ddd4;margin:24px 0;"/>
        <p style="color:#c4b49a;font-size:11px;">© ${new Date().getFullYear()} ${appName}</p>
      </div>
    `,
  })
}
