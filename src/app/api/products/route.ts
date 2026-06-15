import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Condition } from '@prisma/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search    = searchParams.get('search') || ''
  // Support both ?cat= (frontend) and ?category= (legacy)
  const category  = searchParams.get('cat') || searchParams.get('category') || ''
  const condition = searchParams.get('condition') as Condition | null
  const minPrice  = Number(searchParams.get('minPrice') || 0)
  const maxPrice  = Number(searchParams.get('maxPrice') || 9999999)
  const sort      = searchParams.get('sort') || 'createdAt_desc'
  const page      = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize  = Math.min(100, Number(searchParams.get('pageSize') || 48))

  // Filter by specific IDs (for wishlist fetching)
  const ids = searchParams.get('ids') || ''

  // Extended filters
  const rarity    = searchParams.get('rarity') || ''
  const colors    = searchParams.get('colors') || ''
  const format    = searchParams.get('format') || ''
  const cardType  = searchParams.get('cardType') || ''
  const sealedCat = searchParams.get('sealedCat') || ''
  const rbRarity  = searchParams.get('rbRarity') || ''
  const rbType    = searchParams.get('rbType') || ''

  const validSortFields = ['createdAt', 'price', 'name', 'stock']
  const [sortFieldRaw, sortDir] = sort.split('_') as [string, 'asc' | 'desc']
  const sortField = validSortFields.includes(sortFieldRaw) ? sortFieldRaw : 'createdAt'
  const safeSortDir: 'asc' | 'desc' = sortDir === 'asc' ? 'asc' : 'desc'

  const where = {
    isActive: true,
    ...(ids && { id: { in: ids.split(',').filter(Boolean) } }),
    ...(search && {
      OR: [
        { name:   { contains: search } },
        { nameTh: { contains: search } },
        { setName:{ contains: search } },
      ],
    }),
    ...(category && { category: { slug: category } }),
    ...(condition && { condition }),
    price: { gte: minPrice, lte: maxPrice },
    ...(rarity    && { rarity }),
    ...(colors    && { colors: { contains: colors } }),
    ...(format    && { formats: { contains: format } }),
    ...(cardType  && { cardType }),
    ...(sealedCat && { sealedCat }),
    ...(rbRarity  && { rbRarity }),
    ...(rbType    && { rbType }),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { [sortField]: safeSortDir },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({
    data: products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  })
}
