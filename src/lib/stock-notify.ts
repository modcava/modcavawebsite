import { prisma } from './prisma'
import { sendBackInStockEmail } from './email'

// Notify everyone subscribed to a back-in-stock / release alert for one product,
// then clear ONLY the subscriptions that were emailed successfully — so a
// transient SMTP failure doesn't silently consume a subscription (it can retry
// on the next run). Returns how many alerts were actually sent.
export async function notifyBackInStock(productId: string, productName: string): Promise<number> {
  const subs = await prisma.stockNotification.findMany({
    where: { productId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (subs.length === 0) return 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const doneIds: string[] = []
  let sent = 0

  for (const sub of subs) {
    const to = sub.email || sub.user.email
    if (!to) { doneIds.push(sub.id); continue } // no address ever → drop it
    try {
      await sendBackInStockEmail({ to, name: sub.user.name ?? '', productName, productUrl: `${appUrl}/` })
      doneIds.push(sub.id)
      sent++
    } catch (e) {
      console.error('[stock-notify] failed to email', to, e)
      // keep this subscription so a later run can retry
    }
  }

  if (doneIds.length > 0) {
    await prisma.stockNotification.deleteMany({ where: { id: { in: doneIds } } })
  }
  return sent
}

// Sweep every product that is now purchasable (active, in stock, and past its
// scheduled release) AND still has subscribers, then notify them. This covers
// the time-based "coming soon" release (releaseAt passing) — no admin edit
// fires for that, so the PUT-route trigger alone never sends those alerts.
export async function sweepReleasedSubscriptions(): Promise<{ products: number; sent: number }> {
  const now = new Date()
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      stock: { gt: 0 },
      OR: [{ releaseAt: null }, { releaseAt: { lte: now } }],
      stockNotifications: { some: {} },
    },
    select: { id: true, name: true },
  })

  let sent = 0
  for (const p of products) sent += await notifyBackInStock(p.id, p.name)
  return { products: products.length, sent }
}
