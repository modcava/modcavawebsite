import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // Tighter limit than register: this triggers an outbound email per call.
  const ipLimit = enforceRateLimit(req, {
    key: 'resend-verification:ip',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: 'ขออีเมลยืนยันบ่อยเกินไป กรุณารอสักครู่',
  })
  if (ipLimit) return ipLimit

  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 })

  // Per-email limit — prevents flooding a specific user's inbox.
  const emailLimit = enforceRateLimit(req, {
    key: 'resend-verification:email',
    by: email.toLowerCase().trim(),
    limit: 3,
    windowMs: 60 * 60 * 1000,
    message: 'ขออีเมลยืนยันบ่อยเกินไป กรุณารอสักครู่',
  })
  if (emailLimit) return emailLimit

  // Find user — don't reveal existence in the response either way
  const user = await prisma.user.findUnique({
    where:  { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, emailVerified: true },
  })

  // Always return ok to avoid email enumeration
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true })
  }

  // Issue a fresh token (invalidates the previous one)
  const token  = crypto.randomBytes(32).toString('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: user.id },
    data:  { verificationToken: token, verificationTokenExpiry: expiry },
  })

  const appUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const verifyUrl = `${appUrl}/verify-email?token=${token}`

  try {
    await sendVerificationEmail(user.email, user.name ?? '', verifyUrl)
  } catch (err) {
    console.error('[resend-verification] email error:', err)
    return NextResponse.json({ error: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
