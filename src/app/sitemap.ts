import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const products = await prisma.product.findMany({
    where: { isActive: true, price: { gt: 0 } },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...productUrls,
  ]
}
