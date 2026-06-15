import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import { sendVerificationEmail } from '@/lib/email'

const schema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: NextRequest) {
  // Rate limit: 5 sign-ups per IP per hour (anti-spam / anti-fake account)
  const rl = enforceRateLimit(req, {
    key: 'register',
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: 'สมัครสมาชิกบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
  })
  if (rl) return rl

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // ── Email verification token ───────────────────────────
    // 24-hour expiry. Stored on user row; cleared once verified.
    const verificationToken  = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        verificationToken,
        verificationTokenExpiry: verificationExpiry,
        // emailVerified = null by default → blocks credentials login until verified
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    // Send verification email (best-effort: don't fail registration if SMTP is down)
    const appUrl    = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`
    try {
      await sendVerificationEmail(email, name, verifyUrl)
    } catch (err) {
      console.error('[register] verification email failed:', err)
      // continue — user can request resend from login page
    }

    return NextResponse.json(
      { data: user, message: 'สมัครสมาชิกสำเร็จ — กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี' },
      { status: 201 },
    )
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
