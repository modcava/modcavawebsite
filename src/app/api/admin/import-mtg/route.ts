import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const MTG_SINGLE_CATEGORY_ID = 'cmp9flcjn00006r8azfshgrx7'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

interface ScryfallCard {
  id: string
  name: string
  set: string
  set_name: string
  collector_number: string
  rarity: string
  colors?: string[]
  color_identity?: string[]
  type_line?: string
  foil: boolean
  nonfoil: boolean
  image_uris?: { normal?: string; small?: string; large?: string }
  card_faces?: { image_uris?: { normal?: string; small?: string } }[]
  lang?: string
  prices?: { usd?: string | null; usd_foil?: string | null }
  layout?: string
}

function getImageUrl(card: ScryfallCard): string | null {
  if (card.image_uris?.normal) return card.image_uris.normal
  if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal
  return null
}

function capitalizeRarity(r: string): string {
  const map: Record<string, string> = {
    common: 'Common', uncommon: 'Uncommon', rare: 'Rare',
    mythic: 'Mythic', special: 'Special', bonus: 'Bonus',
  }
  return map[r.toLowerCase()] ?? r
}

// คำนวณราคาไทย (บาท) จาก USD + rarity ของ Scryfall
function calcPrice(card: ScryfallCard & { importFoil?: boolean }): number {
  const foil   = !!card.importFoil
  const usdStr = foil ? card.prices?.usd_foil : card.prices?.usd
  const usd    = usdStr ? parseFloat(usdStr) : null
  const r      = card.rarity.toLowerCase()

  if (r === 'common') {
    if (usd === null || usd < 0.50) return 10
    if (usd < 1.00)                 return 15
    return Math.round(usd * 20)
  }
  if (r === 'uncommon') {
    if (usd === null || usd < 1.00) return 20
    return Math.round(usd * 25)
  }
  // rare, mythic, special, bonus — ใช้สูตร R/M
  if (usd === null || usd < 1.00) return 30
  return Math.round(usd * 32)
}

// POST /api/admin/import-mtg
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const body = await req.json()
  const cards: (ScryfallCard & { importFoil?: boolean })[] = body.cards ?? []

  if (!cards.length) return NextResponse.json({ error: 'No cards provided' }, { status: 400 })

  let imported = 0
  let skipped  = 0
  const errors: string[] = []

  for (const card of cards) {
    try {
      // Build a unique-ish key: name + setCode + collectorNumber + foil
      const foil = !!card.importFoil
      const existing = await prisma.product.findFirst({
        where: {
          categoryId:      MTG_SINGLE_CATEGORY_ID,
          name:            card.name,
          setCode:         card.set,
          collectorNumber: card.collector_number,
          foil,
        },
      })

      if (existing) { skipped++; continue }

      const colors = card.colors?.length ? JSON.stringify(card.colors) : null

      // Build SKU from Code: "LTR #141" → "LTR141"  (foil variant: "LTR141F")
      const sku = `${card.set.toUpperCase()}${card.collector_number}${foil ? 'F' : ''}`

      await prisma.product.create({
        data: {
          name:            card.name,
          categoryId:      MTG_SINGLE_CATEGORY_ID,
          price:           calcPrice(card),
          stock:           0,
          condition:       'NM',
          language:        (card.lang ?? 'en').toUpperCase() === 'EN' ? 'EN' : (card.lang ?? 'en').toUpperCase(),
          sku,
          setName:         card.set_name,
          setCode:         card.set,
          collectorNumber: card.collector_number,
          rarity:          capitalizeRarity(card.rarity),
          colors,
          cardType:        card.type_line ?? null,
          imageUrl:        getImageUrl(card),
          foil,
          isActive:        true,
          isNew:           false,
        },
      })
      imported++
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${card.name} (${card.set} #${card.collector_number}): ${msg}`)
    }
  }

  // Audit the bulk import — only when something actually landed in the DB
  if (ctx && imported > 0) {
    await logAudit(ctx, {
      action: 'product.import',
      resource: 'product',
      resourceId: null, // bulk action — no single target
      details: { source: 'scryfall', imported, skipped, errorCount: errors.length },
      req,
    })
  }

  return NextResponse.json({ imported, skipped, errors })
}
