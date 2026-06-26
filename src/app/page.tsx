import { Suspense } from 'react'
import { ShopClient } from './shop-client'
import { prisma } from '@/lib/prisma'
import type { ProductWithCategory } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'MOCAVA — TCG & Hobby Store' }

export default async function ShopPage() {
  // Fetch the full catalog plus the best-selling product ids (by total quantity
  // ordered). The groupBy is cheap and lets us build a "Best Sellers" shelf
  // without a second product query — we resolve ids against `products` below.
  const [productsRaw, topAgg] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, price: { gt: 0 } },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
      take: 2000, // safety cap — replace with server-side pagination when inventory exceeds this
    }),
    prisma.orderItem
      .groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 12,
      })
      .catch(() => [] as { productId: string }[]),
  ])

  // Serialize Decimal to number for client components
  const products: ProductWithCategory[] = productsRaw.map((p) => ({
    ...p,
    price: p.price as unknown as ProductWithCategory['price'],
  }))

  // Best sellers: map the ranked ids onto in-stock catalog products, preserving
  // sales rank. Products that are hidden / out of stock simply drop out.
  const byId = new Map(products.map((p) => [p.id, p]))
  const bestSellers = topAgg
    .map((t) => byId.get(t.productId))
    .filter((p): p is ProductWithCategory => !!p && p.stock > 0)
    .slice(0, 10)

  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--ink-3)' }}>
        Loading…
      </div>
    }>
      <ShopClient initialProducts={products} bestSellers={bestSellers} />
    </Suspense>
  )
}
