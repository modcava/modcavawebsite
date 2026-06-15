import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendResetPasswordEmail } from '@/lib/email'
import { enforceRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

export async function POST(req: Request) {
  // Rate limit by IP — sending reset emails is expensive + can be used to harass users
  const ipLimit = enforceRateLimit(req, {
    key: 'forgot-password:ip',
    limit: 5,
    windowMs: 60 * 60 * 1000, // 5 per hour per IP
    message: 'ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  })
  if (ipLimit) return ipLimit

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 })

  // Rate limit per email — prevent flooding a specific user's inbox.
  // Done AFTER reading the body so we have the email; same limit as IP for safety.
  const emailLimit = enforceRateLimit(req, {
    key: 'forgot-password:email',
    by: email.toLowerCase().trim(),
    limit: 3,
    windowMs: 60 * 60 * 1000, // 3 per email per hour
    message: 'ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  })
  if (emailLimit) return emailLimit

  // ค้นหา user — ถ้าไม่เจอก็ตอบ ok เพื่อไม่บอกว่าอีเมลมีอยู่ในระบบหรือไม่
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })

  if (user && user.password) {
    // สร้าง token
    const token   = crypto.randomBytes(32).toString('hex')
    const expiry  = new Date(Date.now() + 60 * 60 * 1000) // 1 ชั่วโมง

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    })

    const appUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${token}`

    try {
      await sendResetPasswordEmail(user.email, user.name ?? '', resetUrl)
    } catch (err) {
      console.error('[forgot-password] email error:', err)
      return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่หรือติดต่อ admin' }, { status: 500 })
    }
  }

  // ตอบ ok เสมอ (security: ไม่บอกว่าอีเมลมีหรือไม่)
  return NextResponse.json({ ok: true })
}
