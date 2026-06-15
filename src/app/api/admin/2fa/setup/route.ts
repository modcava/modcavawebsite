import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSecret, otpauthUrl, qrImageUrl } from '@/lib/totp'

// POST /api/admin/2fa/setup
// Generates a new TOTP secret and stores it on the user row (but leaves
// twoFactorEnabled=false). User must then call /enable with a valid code
// to finalize the setup. If a previous unconfirmed secret exists, it is
// overwritten — only one in-flight setup at a time.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Don't overwrite an already-confirmed secret — user must disable first
  const current = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { twoFactorEnabled: true, email: true },
  })
  if (current?.twoFactorEnabled) {
    return NextResponse.json(
      { error: '2FA ถูกเปิดใช้งานอยู่แล้ว กรุณาปิดก่อนแล้วเปิดใหม่' },
      { status: 400 },
    )
  }

  const secret = generateSecret()
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { twoFactorSecret: secret, twoFactorEnabled: false },
  })

  const issuer = process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'
  const uri    = otpauthUrl(secret, current?.email ?? session.user.email ?? 'admin', issuer)
  const qr     = qrImageUrl(uri)

  return NextResponse.json({
    secret,          // shown as text for manual entry
    otpauthUrl: uri, // for clients that prefer the URI directly
    qrUrl: qr,       // <img src> for QR scanning
  })
}
