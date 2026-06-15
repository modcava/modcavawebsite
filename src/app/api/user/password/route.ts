import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 5 password-change attempts per hour per user (anti brute-force currentPassword)
  const rl = enforceRateLimit(req, {
    key: 'user:password',
    by: session.user.id,
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: 'เปลี่ยนรหัสผ่านบ่อยเกินไป กรุณารอสักครู่',
  })
  if (rl) return rl

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { password: true },
  })

  if (!user?.password) {
    return NextResponse.json({ error: 'บัญชีนี้ไม่มีรหัสผ่าน (เข้าสู่ระบบด้วย Google)' }, { status: 400 })
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { password: hashed },
  })

  return NextResponse.json({ success: true })
}
