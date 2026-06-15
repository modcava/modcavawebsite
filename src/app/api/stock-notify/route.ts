import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'

const schema = z.object({ productId: z.string().min(1) })

// POST /api/stock-notify — subscribe to a back-in-stock alert for an out-of-stock product.
// Login required so we email a verified address (and can de-dupe per user).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบเพื่อรับการแจ้งเตือน' }, { status: 401 })
  }

  // Light rate limit to prevent spamming subscriptions
  const rl = enforceRateLimit(req, {
    key: 'stock-notify',
    by: session.user.id,
    limit: 30,
    windowMs: 60 * 1000,
  })
  if (rl) return rl

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, stock: true, isActive: true, releaseAt: true },
  })
  if (!product || !product.isActive) {
    return NextResponse.json({ error: 'ไม่พบสินค้านี้' }, { status: 404 })
  }
  // Allow subscribing only when the product isn't purchasable yet — i.e. out of stock
  // OR scheduled for a future release ("coming soon"). Otherwise there's nothing to wait for.
  const comingSoon = product.releaseAt != null && product.releaseAt > new Date()
  if (product.stock > 0 && !comingSoon) {
    return NextResponse.json({ error: 'สินค้านี้มีจำหน่ายอยู่แล้ว', inStock: true }, { status: 409 })
  }

  // Idempotent: re-subscribing is a no-op thanks to the unique (productId, userId)
  await prisma.stockNotification.upsert({
    where:  { productId_userId: { productId: product.id, userId: session.user.id } },
    update: { email: session.user.email ?? '' },
    create: { productId: product.id, userId: session.user.id, email: session.user.email ?? '' },
  })

  return NextResponse.json({ success: true })
}
