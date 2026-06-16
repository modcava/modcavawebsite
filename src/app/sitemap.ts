import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  let products: { id: string; updatedAt: Date }[] = []
  try {
    products = await prisma.product.findMany({
      where: { isActive: true, price: { gt: 0 } },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
  } catch {
    // DB not available at build time — sitemap will include product URLs after deployment
  }

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
