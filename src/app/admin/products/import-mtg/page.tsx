'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Download, Search, CheckSquare, Square, Loader2,
  AlertCircle, ChevronLeft, Sparkles, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScryfallCard {
  id:               string
  name:             string
  set:              string
  set_name:         string
  collector_number: string
  rarity:           string
  colors?:          string[]
  color_identity?:  string[]
  type_line?:       string
  foil:             boolean
  nonfoil:          boolean
  image_uris?:      { normal?: string; small?: string }
  card_faces?:      { image_uris?: { normal?: string; small?: string } }[]
  lang?:            string
  prices?:          { usd?: string | null; usd_foil?: string | null }
}

interface ImportRow extends ScryfallCard {
  /** client-side selection key */
  rowKey:     string
  importFoil: boolean
  checked:    boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// mirrors calcPrice in API route
function calcMtgPrice(row: ImportRow): number {
  const usdStr = row.importFoil ? row.prices?.usd_foil : row.prices?.usd
  const usd    = usdStr ? parseFloat(usdStr) : null
  const r      = row.rarity.toLowerCase()

  if (r === 'common') {
    if (usd === null || usd < 0.50) return 10
    if (usd < 1.00)                 return 15
    return Math.round(usd * 20)
  }
  if (r === 'uncommon') {
    if (usd === null || usd < 1.00) return 20
    return Math.round(usd * 25)
  }
  if (usd === null || usd < 1.00) return 30
  return Math.round(usd * 32)
}

function getThumb(card: ScryfallCard) {
  return card.image_uris?.small
    ?? card.card_faces?.[0]?.image_uris?.small
    ?? null
}

const RARITY_STYLE: Record<string, string> = {
  common:   'bg-slate-100 text-slate-600 border-slate-200',
  uncommon: 'bg-blue-50  text-blue-600  border-blue-200',
  rare:     'bg-amber-50 text-amber-600 border-amber-200',
  mythic:   'bg-orange-50 text-orange-600 border-orange-200',
  special:  'bg-violet-50 text-violet-600 border-violet-200',
}

function RarityBadge({ r }: { r: string }) {
  const lc  = r.toLowerCase()
  const cap = lc.charAt(0).toUpperCase() + lc.slice(1)
  const cls = RARITY_STYLE[lc] ?? 'bg-slate-50 text-slate-500 border-slate-200'
  return (
    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>
      {cap}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportMtgPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [mode,    setMode]    = useState<'name' | 'set'>('name')
  const [query,   setQuery]   = useState('')
  const [rows,    setRows]    = useState<ImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [result, setResult]  = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  // Used to cancel an in-flight search when a new one starts (Bug 5)
  const searchGenRef = useRef(0)

  // ── Search ────────────────────────────────────────────────────────────────

  const doSearch = useCallback(async () => {
    if (!query.trim()) return
    // Bump generation — any previous in-flight loop will see its gen is stale and exit (Bug 5)
    const myGen = ++searchGenRef.current

    setLoading(true)
    setLoadErr('')
    setLoadProgress('')
    setRows([])
    setResult(null)

    try {
      let q = query.trim()
      if (mode === 'set') q = `set:${q}`

      // Fetch first page
      const firstUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&order=set&unique=prints&lang=any`
      const firstRes = await fetch(firstUrl)
      const firstJson = await firstRes.json()

      // Check if this search was superseded by a newer one
      if (searchGenRef.current !== myGen) return

      if (!firstRes.ok || firstJson.object === 'error') {
        setLoadErr(firstJson.details ?? 'ไม่พบข้อมูล')
        return
      }

      // Collect all cards across all pages
      let allCards: ScryfallCard[] = firstJson.data ?? []
      let nextUrl: string | null = firstJson.has_more ? firstJson.next_page : null
      let fetchIncomplete = false // Bug 8: track mid-pagination errors

      if (nextUrl) {
        setLoadProgress(`โหลดแล้ว ${allCards.length} รายการ กำลังโหลดหน้าถัดไป…`)
      }

      // Follow pagination until has_more === false
      while (nextUrl) {
        // Cancelled by a newer search? Stop silently (Bug 5)
        if (searchGenRef.current !== myGen) return

        // Scryfall rate-limit: be polite with a small delay between pages
        await new Promise((r) => setTimeout(r, 100))

        const pageRes = await fetch(nextUrl)
        const pageJson = await pageRes.json()

        // Bug 8: report partial data instead of silently stopping
        if (!pageRes.ok || pageJson.object === 'error') {
          fetchIncomplete = true
          break
        }

        allCards = [...allCards, ...(pageJson.data ?? [])]
        nextUrl = pageJson.has_more ? pageJson.next_page : null

        if (nextUrl) {
          setLoadProgress(`โหลดแล้ว ${allCards.length} รายการ กำลังโหลดหน้าถัดไป…`)
        }
      }

      setLoadProgress('')

      // Bug 8: warn user that data may be incomplete
      if (fetchIncomplete) {
        setLoadErr(`⚠️ โหลดข้อมูลไม่ครบ ได้รับ ${allCards.length} รายการ (เกิดข้อผิดพลาดระหว่างโหลดหน้าถัดไป — ลองค้นหาใหม่)`)
      }

      const newRows: ImportRow[] = []
      for (const c of allCards) {
        // Non-foil version
        if (c.nonfoil) {
          newRows.push({ ...c, rowKey: `${c.id}-nf`, importFoil: false, checked: true })
        }
        // Foil version (separate row)
        if (c.foil) {
          newRows.push({ ...c, rowKey: `${c.id}-f`, importFoil: true, checked: false })
        }
        // If neither flag set, still add as non-foil
        if (!c.nonfoil && !c.foil) {
          newRows.push({ ...c, rowKey: `${c.id}-nf`, importFoil: false, checked: true })
        }
      }

      setRows(newRows)
    } catch {
      if (searchGenRef.current === myGen) {
        setLoadErr('เชื่อมต่อ Scryfall ไม่ได้ ลองใหม่อีกครั้ง')
      }
    } finally {
      if (searchGenRef.current === myGen) {
        setLoading(false)
        setLoadProgress('')
      }
    }
  }, [query, mode])

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleRow = (key: string) =>
    setRows(r => r.map(x => x.rowKey === key ? { ...x, checked: !x.checked } : x))

  const allChecked = rows.length > 0 && rows.every(r => r.checked)
  const someChecked = rows.some(r => r.checked)
  const checkedCount = rows.filter(r => r.checked).length

  const toggleAll = () => {
    const next = !allChecked
    setRows(r => r.map(x => ({ ...x, checked: next })))
  }

  // ── Import ────────────────────────────────────────────────────────────────

  const IMPORT_BATCH_SIZE = 50 // Bug 10: batch to avoid huge payloads / timeouts

  const doImport = async () => {
    const selected = rows.filter(r => r.checked)
    if (!selected.length) { toast.error('ยังไม่ได้เลือกการ์ด'); return }

    setImporting(true)
    setImportProgress('')
    setResult(null)

    let totalImported = 0
    let totalSkipped  = 0
    const allErrors:  string[] = []

    try {
      const batches: typeof selected[] = []
      for (let i = 0; i < selected.length; i += IMPORT_BATCH_SIZE) {
        batches.push(selected.slice(i, i + IMPORT_BATCH_SIZE))
      }

      for (let bi = 0; bi < batches.length; bi++) {
        setImportProgress(`กำลังนำเข้า batch ${bi + 1}/${batches.length}…`)
        const res = await fetch('/api/admin/import-mtg', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ cards: batches[bi] }),
        })
        if (!res.ok) { allErrors.push(`Batch ${bi + 1}: HTTP ${res.status}`); continue }
        const json = await res.json()
        totalImported += json.imported ?? 0
        totalSkipped  += json.skipped  ?? 0
        allErrors.push(...(json.errors ?? []))
      }

      const summary = { imported: totalImported, skipped: totalSkipped, errors: allErrors }
      setResult(summary)

      if (totalImported > 0) {
        toast.success(`นำเข้าสำเร็จ ${totalImported} รายการ`)
        qc.invalidateQueries({ queryKey: ['admin-mtg-set-names'] })
        qc.invalidateQueries({ queryKey: ['admin-products'] })
      } else {
        toast.info('ไม่มีรายการใหม่ (ซ้ำทั้งหมด)')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการนำเข้า')
    } finally {
      setImporting(false)
      setImportProgress('')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-screen-xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="eyebrow mb-1">Admin › Products</div>
          <h1 className="font-display font-bold text-2xl text-warm-50 flex items-center gap-2">
            <Sparkles size={22} className="text-blue-500" />
            Import MTG Single Cards
          </h1>
          <p className="text-xs text-slate-500 mt-1">ดึงข้อมูลการ์ดจาก Scryfall API แล้วเพิ่มเข้าฐานข้อมูล</p>
        </div>
        <button
          onClick={() => router.push('/admin/products')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-600 text-xs font-medium hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          <ChevronLeft size={14} /> กลับ
        </button>
      </div>

      {/* Search Panel */}
      <div className="card p-5 mb-5">
        <div className="flex gap-2 mb-4">
          {(['name', 'set'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-semibold border transition-all',
                mode === m
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600',
              )}>
              {m === 'name' ? '🔍 ค้นหาชื่อการ์ด' : '📦 นำเข้าตาม Set Code'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 max-w-lg">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }}
              placeholder={
                mode === 'name'
                  ? 'เช่น Lightning Bolt, Ragavan, Teferi…'
                  : 'เช่น mkm, ltr, one, woe…'
              }
              className="input pl-8 text-sm w-full"
            />
          </div>
          <button
            onClick={doSearch}
            disabled={loading || !query.trim()}
            className="btn-amber gap-2 disabled:opacity-50"
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <Search size={14} />}
            {loading ? 'กำลังโหลด…' : 'ค้นหา'}
          </button>
          {rows.length > 0 && (
            <button onClick={() => { setRows([]); setQuery(''); setResult(null) }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-500 text-xs hover:border-red-300 hover:text-red-500 transition-colors">
              <RefreshCw size={13} /> ล้าง
            </button>
          )}
        </div>

        {mode === 'set' && (
          <p className="mt-2 text-[11px] text-slate-400">
            ใส่ Set Code 3 ตัวอักษร เช่น <span className="font-mono text-blue-500">ltr</span> (Lord of the Rings),{' '}
            <span className="font-mono text-blue-500">one</span> (Phyrexia), <span className="font-mono text-blue-500">woe</span> (Wilds of Eldraine)
          </p>
        )}

        {loadProgress && (
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
            <Loader2 size={13} className="animate-spin" />
            {loadProgress}
          </div>
        )}
      </div>

      {/* Error */}
      {loadErr && (
        <div className="flex items-center gap-2 text-red-600 text-sm mb-4 p-3 bg-red-50 rounded border border-red-200">
          <AlertCircle size={15} /> {loadErr}
        </div>
      )}

      {/* Result summary */}
      {result && (
        <div className={cn(
          'flex items-start gap-3 p-4 rounded border mb-4 text-sm',
          result.errors.length ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        )}>
          <div className="flex-1">
            <p className="font-semibold text-slate-700">
              ✅ นำเข้าสำเร็จ <span className="text-green-600">{result.imported}</span> รายการ
              {result.skipped > 0 && <>, ข้ามซ้ำ <span className="text-slate-500">{result.skipped}</span> รายการ</>}
            </p>
            {result.errors.length > 0 && (
              <details className="mt-2 text-xs text-red-600">
                <summary className="cursor-pointer font-medium">ผิดพลาด {result.errors.length} รายการ</summary>
                <ul className="mt-1 space-y-0.5 font-mono">
                  {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
          <button onClick={() => router.push('/admin/products')}
            className="btn-amber text-xs whitespace-nowrap">ดูสินค้า</button>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-500 font-mono">
              พบ <span className="text-slate-700 font-semibold">{rows.length}</span> รายการ
              {checkedCount > 0 && (
                <> · เลือกแล้ว <span className="text-blue-600 font-semibold">{checkedCount}</span> รายการ</>
              )}
            </div>
            <button
              onClick={doImport}
              disabled={!someChecked || importing}
              className="btn-amber gap-2 disabled:opacity-50"
            >
              {importing
                ? <Loader2 size={14} className="animate-spin" />
                : <Download size={14} />}
              นำเข้าที่เลือก ({checkedCount})
            </button>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50/70">
                  <th className="px-3 py-3 w-9">
                    <button onClick={toggleAll} className="flex items-center justify-center">
                      {allChecked
                        ? <CheckSquare size={15} className="text-blue-500" />
                        : <Square size={15} className="text-slate-400" />}
                    </button>
                  </th>
                  {['', 'ชื่อการ์ด', 'Set', 'Code', 'Rarity', 'Foil', 'Color', 'ราคา (USD)', 'ราคา THB'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.rowKey}
                    onClick={() => toggleRow(row.rowKey)}
                    className={cn(
                      'cursor-pointer transition-colors',
                      row.checked ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50',
                    )}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-2">
                      {row.checked
                        ? <CheckSquare size={15} className="text-blue-500" />
                        : <Square size={15} className="text-slate-300" />}
                    </td>

                    {/* Thumbnail */}
                    <td className="px-3 py-2 w-12">
                      {getThumb(row) ? (
                        <img
                          src={getThumb(row)!}
                          alt={row.name}
                          className="h-10 w-auto rounded shadow-sm object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-10 w-7 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">?</div>
                      )}
                    </td>

                    {/* Name */}
                    <td className="px-3 py-2">
                      <div className="font-semibold text-xs text-slate-800">{row.name}</div>
                      {row.type_line && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{row.type_line}</div>
                      )}
                    </td>

                    {/* Set name */}
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[160px]">
                      <div className="truncate">{row.set_name}</div>
                    </td>

                    {/* Collector # */}
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-slate-500">
                        {row.set.toUpperCase()} #{row.collector_number}
                      </span>
                    </td>

                    {/* Rarity */}
                    <td className="px-3 py-2">
                      <RarityBadge r={row.rarity} />
                    </td>

                    {/* Foil indicator */}
                    <td className="px-3 py-2">
                      {row.importFoil
                        ? <span className="text-[11px] font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50">✨ Foil</span>
                        : <span className="text-[10px] text-slate-400">—</span>}
                    </td>

                    {/* Colors */}
                    <td className="px-3 py-2">
                      <div className="flex gap-0.5 flex-wrap">
                        {(row.colors ?? row.color_identity ?? []).map((c) => (
                          <ManaIcon key={c} symbol={c} />
                        ))}
                        {(row.colors ?? row.color_identity ?? []).length === 0 && (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>

                    {/* Price USD */}
                    <td className="px-3 py-2 text-xs font-mono text-slate-500">
                      {row.importFoil
                        ? (row.prices?.usd_foil ? `$${row.prices.usd_foil}` : '—')
                        : (row.prices?.usd ? `$${row.prices.usd}` : '—')}
                    </td>

                    {/* Price THB (calculated) */}
                    <td className="px-3 py-2 text-xs font-mono font-semibold text-amber-700">
                      ฿{calcMtgPrice(row).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom import bar */}
          <div className="sticky bottom-4 mt-4 flex justify-end">
            <button
              onClick={doImport}
              disabled={!someChecked || importing}
              className="btn-amber gap-2 shadow-lg disabled:opacity-50 px-5 py-2.5 text-sm"
            >
              {importing
                ? <><Loader2 size={15} className="animate-spin" /> {importProgress || 'กำลังนำเข้า…'}</>
                : <><Download size={15} /> นำเข้า {checkedCount} รายการ</>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Mana color icon ────────────────────────────────────────────────────────────

function ManaIcon({ symbol }: { symbol: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    W: { bg: '#fef9c3', text: '#a16207', label: 'W' },
    U: { bg: '#dbeafe', text: '#1d4ed8', label: 'U' },
    B: { bg: '#1e293b', text: '#cbd5e1', label: 'B' },
    R: { bg: '#fee2e2', text: '#dc2626', label: 'R' },
    G: { bg: '#dcfce7', text: '#15803d', label: 'G' },
    C: { bg: '#f1f5f9', text: '#64748b', label: 'C' },
  }
  const s = map[symbol] ?? { bg: '#f1f5f9', text: '#64748b', label: symbol }
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-extrabold border border-white/60 shadow-sm"
      style={{ background: s.bg, color: s.text }}
      title={s.label}
    >
      {s.label}
    </span>
  )
}
