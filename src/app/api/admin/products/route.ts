import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { logAudit, diffObjects } from '@/lib/audit'
import { sendBackInStockEmail } from '@/lib/email'
import type { Condition, Prisma } from '@prisma/client'

// Notify everyone subscribed to a back-in-stock alert for this product, then clear them.
// Best-effort: one failed email must not block the others or the product update.
async function notifyBackInStock(productId: string, productName: string) {
  const subs = await prisma.stockNotification.findMany({
    where: { productId },
    include: { user: { select: { name: true, email: true } } },
  })
  if (subs.length === 0) return

  const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  for (const sub of subs) {
    const to = sub.email || sub.user.email
    if (!to) continue
    try {
      await sendBackInStockEmail({ to, name: sub.user.name ?? '', productName, productUrl: `${appUrl}/` })
    } catch (e) {
      console.error('[stock-notify] failed to email', to, e)
    }
  }
  // Clear subscriptions once handled (single-shot alert)
  await prisma.stockNotification.deleteMany({ where: { productId } })
}

interface AdminCtx { userId: string; userEmail: string }
async function getAdminCtx(): Promise<AdminCtx | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') return null
  return { userId: session.user.id, userEmail: session.user.email ?? '' }
}

const optStr = z.string().optional().or(z.literal('')).transform((v) => (v === '' ? undefined : v))
const optInt = z.coerce.number().int().nonnegative().optional().or(z.literal('')).transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
const optNum = z.coerce.number().nonnegative().optional().or(z.literal('')).transform((v) => (v === '' || v === undefined ? undefined : Number(v)))

const productSchema = z.object({
  // ── Core ───────────────────────────────────────────────
  name:        z.string().min(1),
  nameTh:      optStr,
  description: optStr,
  price:       z.coerce.number().positive(),
  cost:        optNum,
  stock:       z.coerce.number().int().min(0),
  condition:   z.enum(['NM','LP','MP','HP','DMG','SEALED']),
  emoji:       optStr,
  imageUrl:    z.union([z.string().min(1), z.literal('')]).optional().transform((v) => (v === '' ? undefined : v)),
  categoryId:  z.string().min(1),
  isNew:       z.boolean().default(false),
  isActive:    z.boolean().default(true),
  isPreorder:  z.boolean().default(false),
  accessoryCat: optStr,
  // ── Common extras ──────────────────────────────────────
  sku:         optStr,
  language:    optStr,
  notes:       optStr,
  // ── Card-like (MTG / RB Singles) ───────────────────────
  setName:         optStr,
  setCode:         optStr,
  collectorNumber: optStr,
  rarity:          optStr,
  cardType:        optStr,
  colors:          optStr,
  formats:         optStr,
  foil:            z.boolean().optional(),
  // ── Riftbound Singles ─────────────────────────────────
  chapter:    optStr,
  domain:     optStr,
  rbRarity:   optStr,
  rbType:     optStr,
  altArt:     z.boolean().optional(),
  // ── Sealed (MTG/RB) ───────────────────────────────────
  productType: optStr,
  sealedCat:   optStr,
  rbSealedCat: optStr,
  // ── Paints ────────────────────────────────────────────
  brand:       optStr,
  paintCat:    optStr,
  colorCode:   optStr,
  colorFamily: optStr,
  size:        optInt,
  finish:      optStr,
  // ── Airbrush ──────────────────────────────────────────
  airbrushCat:    optStr,
  nozzle:         optStr,
  feedType:       optStr,
  compatibleWith: optStr,
  // ── Purchase limits ───────────────────────────────────
  maxPerOrder:    optInt,
  maxPerCustomer: optInt,
  // ── Scheduled release ─────────────────────────────────
  // '' / null → clear (available now); a datetime string → "coming soon" until then.
  // undefined (not sent) → skip (PUT keeps the existing value).
  releaseAt: z.union([z.string(), z.null()]).optional().transform((v, ctx) => {
    if (v === undefined) return undefined
    if (v === null || v === '') return null
    const d = new Date(v)
    if (isNaN(d.getTime())) { ctx.addIssue({ code: 'custom', message: 'Invalid date' }); return z.NEVER }
    return d
  }),
})

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

// Map filter column key → { Prisma field, match mode }
// 'eq' = exact match (case-insensitive via MySQL collation), 'contains' = LIKE %v%
const FILTER_FIELDS: Record<string, { field: string; mode: 'eq' | 'contains' | 'bool' | 'status' }> = {
  product:        { field: 'name',            mode: 'contains' },
  set:            { field: 'setName',         mode: 'eq' },
  chapter:        { field: 'chapter',         mode: 'contains' },
  collector:      { field: 'collectorNumber', mode: 'contains' },
  rarity:         { field: 'rarity',          mode: 'eq' },
  rbRarity:       { field: 'rbRarity',        mode: 'eq' },
  rbType:         { field: 'rbType',          mode: 'eq' },
  domain:         { field: 'domain',          mode: 'contains' },
  foil:           { field: 'foil',            mode: 'bool' },
  condition:      { field: 'condition',       mode: 'eq' },
  language:       { field: 'language',        mode: 'eq' },
  sku:            { field: 'sku',             mode: 'contains' },
  sealedCat:      { field: 'sealedCat',       mode: 'eq' },
  rbSealedCat:    { field: 'rbSealedCat',     mode: 'eq' },
  brand:          { field: 'brand',           mode: 'eq' },
  paintCat:       { field: 'paintCat',        mode: 'eq' },
  colorCode:      { field: 'colorCode',       mode: 'contains' },
  colorFamily:    { field: 'colorFamily',     mode: 'eq' },
  finish:         { field: 'finish',          mode: 'eq' },
  airbrushCat:    { field: 'airbrushCat',     mode: 'eq' },
  accessoryCat:   { field: 'accessoryCat',    mode: 'eq' },
  nozzle:         { field: 'nozzle',          mode: 'contains' },
  feedType:       { field: 'feedType',        mode: 'eq' },
  compatibleWith: { field: 'compatibleWith',  mode: 'contains' },
  status:         { field: 'isActive',        mode: 'status' },
}

// Map a sort column key (from the admin table) → a real Prisma scalar field.
// Sort must happen server-side BEFORE pagination, otherwise we'd only reorder
// the current 50-row page and rows on other pages (e.g. all the stock=0 cards
// after a bulk import) would never surface. Computed columns (domain, altFoil)
// have no single DB field, so they're omitted and fall back to createdAt.
const SORT_FIELDS: Record<string, string> = {
  product:        'name',
  set:            'setName',
  chapter:        'chapter',
  collector:      'collectorNumber',
  rarity:         'rarity',
  rbRarity:       'rbRarity',
  rbType:         'rbType',
  foil:           'foil',
  condition:      'condition',
  language:       'language',
  sku:            'sku',
  sealedCat:      'sealedCat',
  rbSealedCat:    'rbSealedCat',
  brand:          'brand',
  paintCat:       'paintCat',
  colorCode:      'colorCode',
  colorFamily:    'colorFamily',
  finish:         'finish',
  size:           'size',
  airbrushCat:    'airbrushCat',
  accessoryCat:   'accessoryCat',
  nozzle:         'nozzle',
  feedType:       'feedType',
  compatibleWith: 'compatibleWith',
  price:          'price',
  stock:          'stock',
  limitOrder:     'maxPerOrder',
  limitCustomer:  'maxPerCustomer',
  status:         'isActive',
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const page     = Math.max(1, Number(searchParams.get('page') || 1))
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || 50)))
  const distinct = searchParams.get('distinct') || ''
  const sortKey  = searchParams.get('sort') || ''
  const sortDir: Prisma.SortOrder = searchParams.get('dir') === 'desc' ? 'desc' : 'asc'

  // Resolve sort → orderBy. Always append `id` as a final tiebreaker so that
  // when the sort key has many ties (e.g. hundreds of stock=0 rows) pagination
  // is deterministic and never skips or duplicates rows across pages.
  const sortField = SORT_FIELDS[sortKey]
  const orderBy: Prisma.ProductOrderByWithRelationInput[] = sortField
    ? [{ [sortField]: sortDir } as Prisma.ProductOrderByWithRelationInput, { id: 'asc' }]
    : [{ createdAt: 'desc' }]

  // Parse per-column filters from `f_<key>=<value>` params
  const filterClauses: Record<string, unknown> = {}
  for (const [k, v] of Array.from(searchParams.entries())) {
    if (!k.startsWith('f_') || !v.trim()) continue
    const key = k.slice(2)

    // Special case: altFoil spans two DB fields (foil + altArt)
    if (key === 'altFoil') {
      const lower = v.toLowerCase()
      if (lower === 'foil')          filterClauses['foil'] = true
      else if (lower === 'alt')      filterClauses['altArt'] = true
      else if (lower === 'foil/alt') { filterClauses['foil'] = true; filterClauses['altArt'] = true }
      continue
    }

    const def = FILTER_FIELDS[key]
    if (!def) continue
    if (def.mode === 'contains')      filterClauses[def.field] = { contains: v }
    else if (def.mode === 'eq')       filterClauses[def.field] = v
    else if (def.mode === 'bool')     filterClauses[def.field] = (v.toLowerCase() === 'foil' || v.toLowerCase() === 'true')
    else if (def.mode === 'status')   filterClauses[def.field] = (v.toLowerCase() === 'active')
  }

  const where = {
    ...(search && {
      OR: [
        { name:  { contains: search } },
        { nameTh:{ contains: search } },
        { sku:   { contains: search } },
      ],
    }),
    ...(category && { category: { slug: category } }),
    ...filterClauses,
  }

  // Return distinct values for a single field (e.g. ?distinct=setName or ?distinct=paintCat).
  // Allowlisted so the field name can't be used to probe arbitrary columns.
  const DISTINCT_FIELDS = ['setName', 'paintCat', 'airbrushCat', 'colorFamily', 'finish', 'brand'] as const
  if (distinct && (DISTINCT_FIELDS as readonly string[]).includes(distinct)) {
    const field = distinct as (typeof DISTINCT_FIELDS)[number]
    const rows = await prisma.product.findMany({
      where: { ...where, [field]: { not: null } },
      select: { [field]: true },
      distinct: [field],
      orderBy: { [field]: 'asc' },
    })
    return NextResponse.json({ data: rows.map((r) => (r as unknown as Record<string, string | null>)[field]).filter(Boolean) })
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({ data: products, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const ctx = await getAdminCtx()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: { ...parsed.data, condition: parsed.data.condition as Condition },
    include: { category: true },
  })

  await logAudit(ctx, {
    action: 'product.create',
    resource: 'product',
    resourceId: product.id,
    details: { name: product.name, price: product.price, stock: product.stock },
    req,
  })

  revalidatePath('/')
  return NextResponse.json({ data: product }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const ctx = await getAdminCtx()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const parsed = productSchema.partial().safeParse(rest)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // Snapshot before-state for the audit diff (fetch only the keys we're updating)
  const before = await prisma.product.findUnique({ where: { id } })

  const product = await prisma.product.update({
    where: { id },
    data: parsed.data as object,
    include: { category: true },
  })

  if (before) {
    const diff = diffObjects(before as unknown as Record<string, unknown>, parsed.data as Record<string, unknown>)
    if (diff) {
      await logAudit(ctx, {
        action: 'product.update',
        resource: 'product',
        resourceId: product.id,
        details: { name: product.name, ...diff },
        req,
      })
    }
  }

  // Availability alert: if this update made the product purchasable when it wasn't
  // before — either restocked (0 → >0) OR released (future releaseAt → cleared/past) —
  // email everyone who subscribed. Fire-and-forget so the response isn't blocked.
  const now = new Date()
  const purchasable = (p: { stock: number; releaseAt: Date | null }) =>
    p.stock > 0 && (!p.releaseAt || p.releaseAt <= now)
  if (before && !purchasable(before) && purchasable(product)) {
    notifyBackInStock(product.id, product.name).catch((e) => console.error('[stock-notify]', e))
  }

  revalidatePath('/')
  return NextResponse.json({ data: product })
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const ctx = await getAdminCtx()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Snapshot name for audit (so the log is readable even after delete)
  const target = await prisma.product.findUnique({ where: { id }, select: { name: true } })

  // Try hard delete first; fall back to soft delete if the product is referenced
  // by an OrderItem (FK constraint error P2003).
  try {
    await prisma.product.delete({ where: { id } })
    await logAudit(ctx, {
      action: 'product.delete',
      resource: 'product',
      resourceId: id,
      details: { name: target?.name, mode: 'hard' },
      req,
    })
    return NextResponse.json({ message: 'Product deleted', mode: 'hard' })
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2003' || code === 'P2014') {
      // Has orders referencing it → soft delete
      await prisma.product.update({ where: { id }, data: { isActive: false } })
      await logAudit(ctx, {
        action: 'product.deactivate',
        resource: 'product',
        resourceId: id,
        details: { name: target?.name, mode: 'soft', reason: 'has orders' },
        req,
      })
      return NextResponse.json({ message: 'Product deactivated (has orders)', mode: 'soft' })
    }
    return NextResponse.json({ error: 'Delete failed', detail: String(e) }, { status: 500 })
  }
}
