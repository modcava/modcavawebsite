import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyTOTP } from '@/lib/totp'
import { logAudit } from '@/lib/audit'
import { enforceRateLimit } from '@/lib/rate-limit'

// POST /api/admin/2fa/disable  { code: "123456" }
// Require a valid TOTP code before disabling, so a stolen session
// alone cannot turn off 2FA.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rl = enforceRateLimit(req, {
    key: '2fa:disable',
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

  if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
    return NextResponse.json({ error: '2FA ยังไม่ได้เปิดใช้งาน' }, { status: 400 })
  }
  if (!verifyTOTP(user.twoFactorSecret, code.trim())) {
    return NextResponse.json({ error: 'รหัสไม่ถูกต้อง' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { twoFactorEnabled: false, twoFactorSecret: null },
  })

  await logAudit(
    { userId: session.user.id, userEmail: user.email },
    { action: 'user.2fa.disable', resource: 'user', resourceId: session.user.id, req },
  )

  return NextResponse.json({ success: true })
}
