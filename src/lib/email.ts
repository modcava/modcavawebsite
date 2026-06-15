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
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${name || 'คุณ'},<br/>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ</p>
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

export async function sendShippedEmail(opts: {
  to: string
  name: string
  orderNumber: string
  shippingMethod: string
  trackingNumber?: string | null
}) {
  const { sendEmailViaGmail } = await import('@/lib/gmail')

  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  const trackingLine = opts.trackingNumber
    ? `<p style="color:#6b5e4e;margin:0;">เลขพัสดุ: <strong style="color:#2a2218;">${opts.trackingNumber}</strong></p>`
    : ''

  await sendEmailViaGmail({
    to:      opts.to,
    subject: `[Modcava] จัดส่งแล้ว — ออเดอร์ #${opts.orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">📦 พัสดุของคุณถูกจัดส่งแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${opts.name || 'คุณ'},<br/>ออเดอร์ของคุณได้รับการจัดส่งเรียบร้อยแล้ว</p>
        <div style="background:#fff;border:1px solid #e5ddd4;border-radius:8px;padding:16px 20px;margin-bottom:20px;display:flex;flex-direction:column;gap:8px;">
          <p style="color:#6b5e4e;margin:0;">หมายเลขออเดอร์: <strong style="color:#2a2218;">#${opts.orderNumber}</strong></p>
          <p style="color:#6b5e4e;margin:0;">ขนส่ง: <strong style="color:#2a2218;">${opts.shippingMethod}</strong></p>
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
  const { sendEmailViaGmail } = await import('@/lib/gmail')
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  await sendEmailViaGmail({
    to:      opts.to,
    subject: `[${appName}] สินค้ากลับมาแล้ว — ${opts.productName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">🎉 สินค้าที่คุณรอ พร้อมจำหน่ายแล้ว!</h2>
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${opts.name || 'คุณ'},<br/><strong style="color:#2a2218;">${opts.productName}</strong> พร้อมจำหน่ายแล้ว — รีบสั่งก่อนของจะหมด!</p>
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
  const { sendEmailViaGmail } = await import('@/lib/gmail')
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'

  await sendEmailViaGmail({
    to:      opts.to,
    subject: `[${appName}] ออเดอร์ #${opts.orderNumber} ถูกยกเลิก`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#faf7f2;border-radius:12px;">
        <h2 style="font-family:serif;color:#2a2218;margin-bottom:8px;">ออเดอร์ถูกยกเลิกอัตโนมัติ</h2>
        <p style="color:#6b5e4e;margin-bottom:16px;">สวัสดี ${opts.name || 'คุณ'},<br/>ออเดอร์ <strong style="color:#2a2218;">#${opts.orderNumber}</strong> ถูกยกเลิกเนื่องจากไม่ได้แนบสลิปการโอนเงินภายใน 48 ชั่วโมง</p>
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
        <p style="color:#6b5e4e;margin-bottom:20px;">สวัสดี ${name || 'คุณ'},<br/>กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลและเริ่มใช้งานบัญชี</p>
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
