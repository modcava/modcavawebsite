// Riftbound card data source.
//
// Riot does NOT publish an official card API. The official card gallery at
// https://riftbound.leagueoflegends.com/en-us/card-gallery/ is a Next.js page
// whose data is available as JSON at:
//   /_next/data/{BUILD_ID}/en-us/card-gallery.json
// No auth required, but the BUILD_ID changes every time Riot redeploys the
// site, so we scrape it from the gallery HTML first (it appears in the
// _buildManifest.js script path).
//
// This module fetches + normalizes that data server-side (the client can't —
// CORS + ~9MB payload) and caches the result in memory. Card data, images and
// trademarks are property of Riot Games; we use them only to list products,
// the same way MTG shops use Scryfall data.

const GALLERY_PAGE = 'https://riftbound.leagueoflegends.com/en-us/card-gallery/'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

// Compact card shape sent to the import UI.
export interface RiftboundCard {
  id:              string   // Riot's unique id, e.g. "ogn-001-298"
  name:            string
  setName:         string   // "Origins"
  setCode:         string   // "OGN"
  collectorNumber: string   // "1"
  publicCode:      string   // "OGN-001/298"
  type:            string   // "Unit" | "Spell" | "Legend" | "Gear" | "Battlefield" | "Rune"
  rarity:          string   // "Common" | "Uncommon" | "Rare" | "Epic" | "Showcase" | ...
  domains:         string[] // ["Chaos"] or ["Fury","Order"] or ["Colorless"]
  energy:          string | null
  imageUrl:        string | null
  orientation:     string | null // "portrait" | "landscape"
}

// Rarity → default THB price (a starting point; admin edits after import).
// Riftbound has no public price feed (unlike Scryfall's USD), so we seed by rarity.
const PRICE_BY_RARITY: Record<string, number> = {
  common:    15,
  uncommon:  25,
  rare:      35,
  epic:      45,
  showcase:  70,
  legendary: 150,
}
export function rbDefaultPrice(rarity: string | null | undefined): number {
  return PRICE_BY_RARITY[(rarity ?? '').toLowerCase()] ?? 20
}

// ── Build-ID detection ──────────────────────────────────────────────────────

async function fetchBuildId(): Promise<string> {
  const res = await fetch(GALLERY_PAGE, {
    headers: { 'User-Agent': UA },
    // Next.js fetch cache: revalidate hourly at the framework level too.
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`gallery page HTTP ${res.status}`)
  const html = await res.text()
  // The build id appears as /_next/static/{BUILD_ID}/_buildManifest.js
  let m = html.match(/\/_next\/static\/([^/"]+)\/_buildManifest\.js/)
  if (m) return m[1]
  // Fallback: the inlined Next.js data blob carries "buildId":"..."
  m = html.match(/"buildId":"([^"]+)"/)
  if (m) return m[1]
  throw new Error('could not detect Next.js build id from gallery page')
}

// ── Normalization ─────────────────────────────────────────────────────────────

// The raw card shape is deeply wrapped (every field is { label, value|values }).
// We pull only what we need and tolerate missing branches (Legends/Battlefields
// don't carry every field).
interface RawCard {
  id?: string
  collectorNumber?: number | string
  name?: string
  publicCode?: string
  orientation?: string
  set?:      { value?: { id?: string; label?: string } }
  cardType?: { type?: { id?: string; label?: string }[] }
  rarity?:   { value?: { id?: string; label?: string } }
  domain?:   { values?: { id?: string; label?: string }[] }
  cardImage?: { url?: string }
  energy?:   { value?: { id?: number | string; label?: string } }
}

function normalizeCard(raw: RawCard): RiftboundCard | null {
  if (!raw?.name || !raw?.set?.value?.id) return null
  const domains = (raw.domain?.values ?? [])
    .map((d) => d.label)
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
  return {
    id:              raw.id ?? `${raw.set.value.id}-${raw.collectorNumber}`,
    name:            raw.name,
    setName:         raw.set.value.label ?? raw.set.value.id,
    setCode:         raw.set.value.id,
    collectorNumber: String(raw.collectorNumber ?? ''),
    publicCode:      raw.publicCode ?? '',
    type:            raw.cardType?.type?.[0]?.label ?? '',
    rarity:          raw.rarity?.value?.label ?? '',
    domains,
    energy:          raw.energy?.value?.label != null ? String(raw.energy.value.label) : null,
    imageUrl:        raw.cardImage?.url ?? null,
    orientation:     raw.orientation ?? null,
  }
}

async function fetchAllCards(): Promise<{ cards: RiftboundCard[]; buildId: string }> {
  const buildId = await fetchBuildId()
  const url = `https://riftbound.leagueoflegends.com/_next/data/${buildId}/en-us/card-gallery.json`
  const res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`card-gallery.json HTTP ${res.status}`)
  const data = await res.json()
  const blades: { type?: string; cards?: { items?: RawCard[] } }[] =
    data?.pageProps?.page?.blades ?? []
  const gallery = blades.find((b) => b.type === 'riftboundCardGallery')
  const items: RawCard[] = gallery?.cards?.items ?? []
  const cards = items
    .map(normalizeCard)
    .filter((c): c is RiftboundCard => c !== null)
    // Stable order: set, then collector number numeric.
    .sort((a, b) =>
      a.setCode === b.setCode
        ? (Number(a.collectorNumber) || 0) - (Number(b.collectorNumber) || 0)
        : a.setCode.localeCompare(b.setCode))
  return { cards, buildId }
}

// ── In-memory cache (survives hot reload via globalThis) ────────────────────

interface RbCache { cards: RiftboundCard[]; buildId: string; fetchedAt: number }
const g = globalThis as unknown as { __rbCache?: RbCache }

export interface RbCardsResult {
  cards:     RiftboundCard[]
  buildId:   string
  fetchedAt: number
  cached:    boolean
  sets:      { code: string; name: string; count: number }[]
}

export async function getRiftboundCards(force = false): Promise<RbCardsResult> {
  const now = Date.now()
  const fresh = g.__rbCache && now - g.__rbCache.fetchedAt < CACHE_TTL_MS
  let cached = true
  if (force || !fresh) {
    const { cards, buildId } = await fetchAllCards()
    g.__rbCache = { cards, buildId, fetchedAt: now }
    cached = false
  }
  const c = g.__rbCache!
  // Derive the set list for the UI dropdown.
  const setMap = new Map<string, { code: string; name: string; count: number }>()
  for (const card of c.cards) {
    const e = setMap.get(card.setCode)
    if (e) e.count++
    else setMap.set(card.setCode, { code: card.setCode, name: card.setName, count: 1 })
  }
  return {
    cards:     c.cards,
    buildId:   c.buildId,
    fetchedAt: c.fetchedAt,
    cached,
    sets:      Array.from(setMap.values()).sort((a, b) => b.count - a.count),
  }
}

// A smaller thumbnail via Sanity's image CDN transform params (the gallery
// images live on cmsassets.rgpub.io/sanity/images/...). Falls back gracefully
// if the host ignores the params — it just serves the full image.
export function rbThumb(url: string | null): string | null {
  if (!url) return null
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=120&q=70&auto=format`
}
