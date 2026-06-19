import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { rbDefaultPrice, isFoilRarity, type RiftboundCard } from '@/lib/riftbound'
import { serializeDomains } from '@/lib/domains'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// Per-card payload from the import UI. We trust only the fields we map.
type ImportCard = RiftboundCard & { price?: number }

// POST /api/admin/import-rb
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const rbCategory = await prisma.category.findUnique({ where: { slug: 'rb-single' } })
  if (!rbCategory) return NextResponse.json({ error: 'Riftbound Singles category not found' }, { status: 500 })
  const RB_SINGLE_CATEGORY_ID = rbCategory.id

  const body = await req.json()
  const cards: ImportCard[] = body.cards ?? []
  if (!cards.length) return NextResponse.json({ error: 'No cards provided' }, { status: 400 })

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const card of cards) {
    try {
      // Dedup on the physical card identity within Riftbound Singles.
      const existing = await prisma.product.findFirst({
        where: {
          categoryId:      RB_SINGLE_CATEGORY_ID,
          setCode:         card.setCode,
          collectorNumber: card.collectorNumber,
        },
      })
      if (existing) { skipped++; continue }

      // SKU: setCode + collector number, e.g. "OGN1". Unique per physical card.
      const sku = `${card.setCode.toUpperCase()}${card.collectorNumber}`
      const price = typeof card.price === 'number' && card.price > 0
        ? Math.round(card.price)
        : rbDefaultPrice(card.rarity)

      await prisma.product.create({
        data: {
          name:            card.name,
          categoryId:      RB_SINGLE_CATEGORY_ID,
          price,
          stock:           0,
          condition:       'NM',
          language:        'EN',
          sku,
          setName:         card.setName,
          setCode:         card.setCode,
          collectorNumber: card.collectorNumber,
          rbRarity:        card.rarity || null,
          rbType:          card.type || null,
          domain:          serializeDomains(card.domains ?? []) || null,
          imageUrl:        card.imageUrl ?? null,
          notes:           card.energy != null ? `Energy ${card.energy}` : null,
          foil:            isFoilRarity(card.rarity), // Rare+ auto-tagged foil
          altArt:          false,
          isActive:        true,
          isNew:           false,
        },
      })
      imported++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${card.name} (${card.setCode} #${card.collectorNumber}): ${msg}`)
    }
  }

  if (ctx && imported > 0) {
    await logAudit(ctx, {
      action: 'product.import',
      resource: 'product',
      resourceId: null,
      details: { source: 'riftbound-gallery', imported, skipped, errorCount: errors.length },
      req,
    })
  }

  return NextResponse.json({ imported, skipped, errors })
}
