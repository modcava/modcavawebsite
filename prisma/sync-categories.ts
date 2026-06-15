/**
 * One-off script: upsert the 6 product categories from
 * Mocava_Product_Classification.xlsx — safe to run any time
 * (does NOT touch products, orders, or users).
 *
 * Usage:  npx tsx prisma/sync-categories.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES = [
  { slug: 'mtg-single', name: 'MTG Singles',       nameTh: 'MTG ใบเดี่ยว',         emoji: '🔮' },
  { slug: 'mtg-sealed', name: 'MTG Sealed',        nameTh: 'MTG ซีล',              emoji: '📦' },
  { slug: 'rb-single',  name: 'Riftbound Singles', nameTh: 'Riftbound ใบเดี่ยว',   emoji: '⚡' },
  { slug: 'rb-sealed',  name: 'Riftbound Sealed',  nameTh: 'Riftbound ซีล',        emoji: '🎁' },
  { slug: 'paint',      name: 'Paints',            nameTh: 'สี',                    emoji: '🎨' },
  // Slug kept as "model-tools" for back-compat with existing routes;
  // display name shows "Airbrush" to match the Excel classification.
  { slug: 'model-tools', name: 'Airbrush',          nameTh: 'แอร์บรัช & อุปกรณ์',  emoji: '💨' },
]

async function main() {
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where:  { slug: c.slug },
      update: { name: c.name, nameTh: c.nameTh, emoji: c.emoji },
      create: { slug: c.slug, name: c.name, nameTh: c.nameTh, emoji: c.emoji },
    })
    console.log(`✓ ${row.emoji} ${row.name.padEnd(22)} (${row.slug})`)
  }
  console.log('\n✅ Categories synced — products are untouched.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
