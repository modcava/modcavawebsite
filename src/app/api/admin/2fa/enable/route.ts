import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTOTP } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import { enforceRateLimit } from '@/lib/rate-limit'

// POST /api/admin/2fa/enable  { code: "123456" }
// Verifies a TOTP code against the pending secret created by /setup.
// On success: flips twoFactorEnabled to true. The secret is preserved.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Anti brute-force: small window + rate limit
  const rl = enforceRateLimit(req, {
    key: '2fa:enable',
    by: session.user.id,
    limit: 10,
    windowMs: 60 * 1000,
    message: 'ลองยืนยันรหัสบ่อยเกินไป กรุณารอสักครู่',
  })
  if (rl) return rl

  const { code } = (await req.json()) as { code?: string }
  if (!code) return NextResponse.json({ error: 'กรุณากรอกรหัส 6 หลัก' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { twoFactorSecret: true, twoFactorEnabled: true, email: true },
  })

  if (!user?.twoFactorSecret) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า 2FA — กรุณากดเริ่มตั้งค่าใหม่' }, { status: 400 })
  }
  if (user.twoFactorEnabled) {
    return NextResponse.json({ error: '2FA ถูกเปิดใช้งานอยู่แล้ว' }, { status: 400 })
  }
  if (!verifyTOTP(user.twoFactorSecret, code.trim())) {
    return NextResponse.json({ error: 'รหัสไม่ถูกต้อง กรุณาลองใหม่' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { twoFactorEnabled: true },
  })

  await logAudit(
    { userId: session.user.id, userEmail: user.email },
    { action: 'user.2fa.enable', resource: 'user', resourceId: session.user.id, req },
  )

  return NextResponse.json({ success: true })
}
