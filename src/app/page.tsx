import { Suspense } from 'react'
import { ShopClient } from './shop-client'
import { prisma } from '@/lib/prisma'
import type { ProductWithCategory } from '@/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'MOCAVA — TCG & Hobby Store' }

export default async function ShopPage() {
  const productsRaw = await prisma.product.findMany({
    where: { isActive: true, price: { gt: 0 } },
    include: { category: true },
    orderBy: { createdAt: 'desc' },
    take: 2000, // safety cap — replace with server-side pagination when inventory exceeds this
  })

  // Serialize Decimal to number for client components
  const products: ProductWithCategory[] = productsRaw.map((p) => ({
    ...p,
    price: p.price as unknown as ProductWithCategory['price'],
  }))

  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--ink-3)' }}>
        Loading…
      </div>
    }>
      <ShopClient initialProducts={products} />
    </Suspense>
  )
}
