import { PrismaClient, Condition } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Categories ────────────────────────────────────────────
  const [mtgSingle, mtgSealed, rbSingle, rbSealed, paint, modelTools] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'mtg-single' },
      update: { name: 'MTG Singles', nameTh: 'MTG ใบเดี่ยว', emoji: '🔮' },
      create: { name: 'MTG Singles', nameTh: 'MTG ใบเดี่ยว', slug: 'mtg-single', emoji: '🔮' },
    }),
    prisma.category.upsert({
      where: { slug: 'mtg-sealed' },
      update: { name: 'MTG Sealed', nameTh: 'MTG ซีล', emoji: '📦' },
      create: { name: 'MTG Sealed', nameTh: 'MTG ซีล', slug: 'mtg-sealed', emoji: '📦' },
    }),
    prisma.category.upsert({
      where: { slug: 'rb-single' },
      update: { name: 'Riftbound Singles', nameTh: 'Riftbound ใบเดี่ยว', emoji: '⚡' },
      create: { name: 'Riftbound Singles', nameTh: 'Riftbound ใบเดี่ยว', slug: 'rb-single', emoji: '⚡' },
    }),
    prisma.category.upsert({
      where: { slug: 'rb-sealed' },
      update: { name: 'Riftbound Sealed', nameTh: 'Riftbound ซีล', emoji: '🎁' },
      create: { name: 'Riftbound Sealed', nameTh: 'Riftbound ซีล', slug: 'rb-sealed', emoji: '🎁' },
    }),
    prisma.category.upsert({
      where: { slug: 'paint' },
      update: { name: 'Paints', nameTh: 'สี', emoji: '🎨' },
      create: { name: 'Paints', nameTh: 'สี', slug: 'paint', emoji: '🎨' },
    }),
    prisma.category.upsert({
      where: { slug: 'model-tools' },
      update: { name: 'Airbrush', nameTh: 'แอร์บรัช & อุปกรณ์', emoji: '💨' },
      create: { name: 'Airbrush', nameTh: 'แอร์บรัช & อุปกรณ์', slug: 'model-tools', emoji: '💨' },
    }),
    prisma.category.upsert({
      where: { slug: 'card-accessories' },
      update: { name: 'Card Accessories', nameTh: 'อุปกรณ์การ์ดเกม', emoji: '🎴' },
      create: { name: 'Card Accessories', nameTh: 'อุปกรณ์การ์ดเกม', slug: 'card-accessories', emoji: '🎴' },
    }),
  ])
  console.log('✅ Categories seeded')

  // ── Users ─────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'admin@mocava.com' },
    update: {},
    create: {
      email: 'admin@mocava.com',
      name: 'Admin',
      password: await bcrypt.hash('admin1234', 12),
      role: 'ADMIN',
    },
  })
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      name: 'Test Customer',
      password: await bcrypt.hash('password123', 12),
      role: 'CUSTOMER',
    },
  })
  console.log('✅ Users seeded')

  // ── Clear existing products (safe: cascade via order_items) ─
  await prisma.orderItem.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.product.deleteMany({})

  // ── Products (all 35 from PRODUCTS array in index.html) ───
  const products = [
    // ── MTG Singles (id 1–12) ────────────────────────────
    {
      name: 'Ragavan, Nimble Pilferer', nameTh: 'ราวกาวัน นักขโมยขนาดจิ๋ว',
      price: 3200, stock: 2, condition: 'NM' as Condition,
      setName: 'MH2', emoji: '🔮', isNew: true, categoryId: mtgSingle.id,
      rarity: 'Mythic', colors: JSON.stringify(['R']), formats: JSON.stringify(['Modern','Legacy','Commander']), cardType: 'Creature',
    },
    {
      name: 'Force of Will', nameTh: 'ฟอร์ซ ออฟ วิลล์',
      price: 2600, stock: 1, condition: 'LP' as Condition,
      setName: 'Alliances', emoji: '🌀', categoryId: mtgSingle.id,
      rarity: 'Uncommon', colors: JSON.stringify(['U']), formats: JSON.stringify(['Legacy','Commander']), cardType: 'Instant',
    },
    {
      name: 'Snapcaster Mage', nameTh: 'สแนปแคสเตอร์ เมจ',
      price: 1800, stock: 3, condition: 'NM' as Condition,
      setName: 'ISD', emoji: '🔮', categoryId: mtgSingle.id,
      rarity: 'Rare', colors: JSON.stringify(['U']), formats: JSON.stringify(['Modern','Legacy','Commander']), cardType: 'Creature',
    },
    {
      name: 'Wrenn and Six', nameTh: 'เรนน์ แอนด์ ซิกซ์',
      price: 1950, stock: 4, condition: 'NM' as Condition,
      setName: 'MH1', emoji: '🌿', categoryId: mtgSingle.id,
      rarity: 'Mythic', colors: JSON.stringify(['R','G']), formats: JSON.stringify(['Modern','Legacy','Commander']), cardType: 'Planeswalker',
    },
    {
      name: 'Solitude', nameTh: 'โซลิจูด',
      price: 2100, stock: 2, condition: 'NM' as Condition,
      setName: 'MH2', emoji: '☀️', categoryId: mtgSingle.id,
      rarity: 'Mythic', colors: JSON.stringify(['W']), formats: JSON.stringify(['Modern','Legacy','Commander']), cardType: 'Creature',
    },
    {
      name: 'Thoughtseize', nameTh: 'ทอตซีซ',
      price: 450, stock: 8, condition: 'NM' as Condition,
      setName: 'THS', emoji: '🖤', categoryId: mtgSingle.id,
      rarity: 'Rare', colors: JSON.stringify(['B']), formats: JSON.stringify(['Modern','Pioneer','Legacy','Commander']), cardType: 'Sorcery',
    },
    {
      name: 'Lightning Bolt', nameTh: 'ไลท์นิ่ง โบลต์',
      price: 160, stock: 20, condition: 'NM' as Condition,
      setName: 'M11', emoji: '⚡', categoryId: mtgSingle.id,
      rarity: 'Common', colors: JSON.stringify(['R']), formats: JSON.stringify(['Modern','Legacy','Pauper','Commander']), cardType: 'Instant',
    },
    {
      name: 'Counterspell', nameTh: 'เคาน์เตอร์สเปล',
      price: 120, stock: 12, condition: 'NM' as Condition,
      setName: '7ED', emoji: '🌊', categoryId: mtgSingle.id,
      rarity: 'Common', colors: JSON.stringify(['U']), formats: JSON.stringify(['Legacy','Pauper','Commander']), cardType: 'Instant',
    },
    {
      name: 'Fatal Push', nameTh: 'เฟทัล พุช',
      price: 130, stock: 15, condition: 'NM' as Condition,
      setName: 'AER', emoji: '🖤', categoryId: mtgSingle.id,
      rarity: 'Uncommon', colors: JSON.stringify(['B']), formats: JSON.stringify(['Modern','Pioneer','Legacy','Commander']), cardType: 'Instant',
    },
    {
      name: 'Teferi, Time Raveler', nameTh: 'เทเฟอรี่',
      price: 780, stock: 3, condition: 'LP' as Condition,
      setName: 'WAR', emoji: '⏳', categoryId: mtgSingle.id,
      rarity: 'Rare', colors: JSON.stringify(['W','U']), formats: JSON.stringify(['Modern','Pioneer','Commander']), cardType: 'Planeswalker',
    },
    {
      name: 'Omnath, Locus of Creation', nameTh: 'ออมนาธ โลคัส ออฟ ครีเอชัน',
      price: 620, stock: 5, condition: 'NM' as Condition,
      setName: 'ZNR', emoji: '🌈', categoryId: mtgSingle.id,
      rarity: 'Mythic', colors: JSON.stringify(['W','U','R','G']), formats: JSON.stringify(['Modern','Commander']), cardType: 'Creature',
    },
    {
      name: 'Rhystic Study', nameTh: 'ริสติก สตัดดี้',
      price: 890, stock: 1, condition: 'MP' as Condition,
      setName: 'PCY', emoji: '📚', categoryId: mtgSingle.id,
      rarity: 'Common', colors: JSON.stringify(['U']), formats: JSON.stringify(['Commander','Legacy']), cardType: 'Enchantment',
    },
    // ── MTG Sealed (id 13–17) ───────────────────────────
    {
      name: 'Duskmourn Booster Box', nameTh: 'บูสเตอร์บ็อกซ์ ดัสก์มอร์น',
      price: 3500, stock: 6, condition: 'SEALED' as Condition,
      setName: 'DSK', emoji: '📦', isNew: true, categoryId: mtgSealed.id,
      sealedCat: 'Booster Box',
    },
    {
      name: 'Bloomburrow Collector Box', nameTh: 'คอลเลคเตอร์บ็อกซ์ บลูมเบอร์โรว์',
      price: 8900, stock: 3, condition: 'SEALED' as Condition,
      setName: 'BLB', emoji: '🌸', categoryId: mtgSealed.id,
      sealedCat: 'Collector Box',
    },
    {
      name: 'Final Fantasy Commander', nameTh: 'ผจญภัยฟายนัล แฟนตาซี',
      price: 1450, stock: 10, condition: 'SEALED' as Condition,
      setName: 'FF', emoji: '⚔️', isNew: true, categoryId: mtgSealed.id,
      sealedCat: 'Commander Deck',
    },
    {
      name: 'Foundations Draft Booster', nameTh: 'ดราฟต์บูสเตอร์ ฟาวน์เดชัน',
      price: 180, stock: 50, condition: 'SEALED' as Condition,
      setName: 'FDN', emoji: '🃏', categoryId: mtgSealed.id,
      sealedCat: 'Draft Booster',
    },
    {
      name: 'Karlov Manor Bundle', nameTh: 'คาร์ลอฟ บันเดิล',
      price: 1280, stock: 4, condition: 'SEALED' as Condition,
      setName: 'MKM', emoji: '🔍', categoryId: mtgSealed.id,
      sealedCat: 'Bundle',
    },
    // ── Riftbound Singles (id 18–23) ────────────────────
    {
      name: 'Aether Sovereign', nameTh: 'อีเธอร์ โซเวอเรน',
      price: 890, stock: 3, condition: 'NM' as Condition,
      setName: 'RB Core', emoji: '⚡', isNew: true, categoryId: rbSingle.id,
      rbRarity: 'Mythic', rbType: 'Champion',
    },
    {
      name: 'Void Reaper', nameTh: 'วอยด์ รีปเปอร์',
      price: 450, stock: 5, condition: 'NM' as Condition,
      setName: 'RB Core', emoji: '🌑', categoryId: rbSingle.id,
      rbRarity: 'Rare', rbType: 'Ally',
    },
    {
      name: 'Crystal Warden', nameTh: 'คริสตัล วอร์เดน',
      price: 280, stock: 8, condition: 'LP' as Condition,
      setName: 'RB Core', emoji: '💎', categoryId: rbSingle.id,
      rbRarity: 'Uncommon', rbType: 'Ally',
    },
    {
      name: 'Inferno Titan', nameTh: 'อินเฟอร์โน ไทแทน',
      price: 680, stock: 2, condition: 'NM' as Condition,
      setName: 'RB Core', emoji: '🔥', categoryId: rbSingle.id,
      rbRarity: 'Rare', rbType: 'Champion',
    },
    {
      name: 'Shadow Assassin', nameTh: 'แชโดว์ อาซาซิน',
      price: 220, stock: 10, condition: 'NM' as Condition,
      setName: 'RB Core', emoji: '🗡️', categoryId: rbSingle.id,
      rbRarity: 'Common', rbType: 'Ally',
    },
    {
      name: 'Celestial Oracle', nameTh: 'เซเลสเชียล โอราเคิล',
      price: 540, stock: 3, condition: 'NM' as Condition,
      setName: 'RB EX1', emoji: '✨', isNew: true, categoryId: rbSingle.id,
      rbRarity: 'Mythic', rbType: 'Spell',
    },
    // ── Riftbound Sealed (id 24–27) ─────────────────────
    {
      name: 'Riftbound Starter Deck', nameTh: 'สตาร์เตอร์เด็ค ริฟต์บาวด์',
      price: 380, stock: 15, condition: 'SEALED' as Condition,
      setName: 'RB Core', emoji: '🎁', isNew: true, categoryId: rbSealed.id,
      rbSealedCat: 'Starter Deck',
    },
    {
      name: 'Riftbound Booster Pack', nameTh: 'บูสเตอร์แพค ริฟต์บาวด์',
      price: 120, stock: 80, condition: 'SEALED' as Condition,
      setName: 'RB Core', emoji: '📦', categoryId: rbSealed.id,
      rbSealedCat: 'Booster Pack',
    },
    {
      name: 'Riftbound Booster Box', nameTh: 'บูสเตอร์บ็อกซ์ ริฟต์บาวด์',
      price: 2800, stock: 8, condition: 'SEALED' as Condition,
      setName: 'RB Core', emoji: '📦', categoryId: rbSealed.id,
      rbSealedCat: 'Booster Box',
    },
    {
      name: 'Riftbound Expansion 1 Box', nameTh: 'บ็อกซ์ EX1 ริฟต์บาวด์',
      price: 2600, stock: 5, condition: 'SEALED' as Condition,
      setName: 'RB EX1', emoji: '📦', isNew: true, categoryId: rbSealed.id,
      rbSealedCat: 'Booster Box',
    },
    // ── Paints (id 28–31, 34–35) ────────────────────────
    {
      name: 'Citadel Base — Abaddon Black', nameTh: 'ซิทาเดล เบส อาบาดอน แบล็ก',
      price: 185, stock: 20, condition: 'NM' as Condition,
      setName: 'Citadel', emoji: '🎨', categoryId: paint.id,
    },
    {
      name: 'Citadel Layer — Caledor Sky', nameTh: 'ซิทาเดล เลเยอร์ คาเลดอร์',
      price: 185, stock: 18, condition: 'NM' as Condition,
      setName: 'Citadel', emoji: '🎨', categoryId: paint.id,
    },
    {
      name: 'Vallejo Model Color — German Grey', nameTh: 'วาลเลโจ เยอรมัน เกรย์',
      price: 165, stock: 25, condition: 'NM' as Condition,
      setName: 'Vallejo', emoji: '🖌️', categoryId: paint.id,
    },
    {
      name: 'Army Painter Speedpaint 2.0', nameTh: 'อาร์มี เพนเตอร์ สปีดเพนต์',
      price: 210, stock: 14, condition: 'NM' as Condition,
      setName: 'Army Painter', emoji: '⚔️', categoryId: paint.id,
    },
    // ── Model Tools (id 32–33) ───────────────────────────
    {
      name: 'Badger Sotar 20/20 Airbrush', nameTh: 'แบดเจอร์ โซตาร์ แอร์บรัช',
      price: 3800, stock: 4, condition: 'NM' as Condition,
      setName: 'Badger', emoji: '💨', isNew: true, categoryId: modelTools.id,
    },
    {
      name: 'AS-186 Mini Compressor', nameTh: 'คอมเพรสเซอร์ AS-186',
      price: 2900, stock: 3, condition: 'NM' as Condition,
      setName: 'Generic', emoji: '⚙️', categoryId: modelTools.id,
    },
    // ── Paints continued (id 34–35) ─────────────────────
    {
      name: 'Citadel Contrast Set ×6', nameTh: 'คอนทราสต์ เพนต์ เซ็ต',
      price: 1250, stock: 6, condition: 'NM' as Condition,
      setName: 'Citadel', emoji: '🎨', categoryId: paint.id,
    },
    {
      name: 'Grey Seer Primer Spray', nameTh: 'ไพรเมอร์สเปรย์ เกรย์ เซียร์',
      price: 380, stock: 9, condition: 'NM' as Condition,
      setName: 'Citadel', emoji: '🔫', categoryId: paint.id,
    },
  ]

  for (const p of products) {
    await prisma.product.create({ data: p })
  }
  console.log(`✅ ${products.length} products seeded`)
  console.log('\n🎉 Seeding complete!')
  console.log('   Admin:    admin@mocava.com / admin1234')
  console.log('   Customer: customer@example.com / password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
