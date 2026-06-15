import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceRateLimit } from '@/lib/rate-limit'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  // Rate limit: prevent brute-forcing the reset token (32 bytes is huge but cheap defense)
  const rl = enforceRateLimit(req, {
    key: 'reset-password',
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 per hour per IP
    message: 'ลองรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณารอสักครู่',
  })
  if (rl) return rl

  const { token, password } = await req.json()

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วนหรือรหัสผ่านสั้นเกินไป' }, { status: 400 })
  }

  // หา user ที่มี token ตรงกันและยังไม่หมดอายุ — ใช้ Prisma ORM แทน raw SQL
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
    select: { id: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว' }, { status: 400 })
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
  })

  return NextResponse.json({ ok: true })
}
