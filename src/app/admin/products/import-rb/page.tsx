'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Download, Search, CheckSquare, Square, Loader2,
  AlertCircle, ChevronLeft, Swords, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiftboundCard {
  id:              string
  name:            string
  setName:         string
  setCode:         string
  collectorNumber: string
  publicCode:      string
  type:            string
  rarity:          string
  domains:         string[]
  energy:          string | null
  imageUrl:        string | null
  orientation:     string | null
}

interface SetInfo { code: string; name: string; count: number }

interface ImportRow extends RiftboundCard {
  checked: boolean
}

// ── Constants & helpers ─────────────────────────────────────────────────────

// Mirrors PRICE_BY_RARITY in src/lib/riftbound.ts
const PRICE_BY_RARITY: Record<string, number> = {
  common: 15, uncommon: 25, rare: 30, epic: 45, showcase: 70, legendary: 150,
}
function rbPrice(rarity: string): number {
  return PRICE_BY_RARITY[rarity.toLowerCase()] ?? 20
}

// Mirrors isFoilRarity in src/lib/riftbound.ts — rare and above import as foil.
const FOIL_RARITIES = new Set(['rare', 'epic', 'showcase', 'legendary'])
const isFoilRarity = (rarity: string) => FOIL_RARITIES.has(rarity.toLowerCase())

function thumb(url: string | null): string | null {
  if (!url) return null
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=120&q=70&auto=format`
}

const RARITY_STYLE: Record<string, string> = {
  common:    'bg-slate-100 text-slate-600 border-slate-200',
  uncommon:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  rare:      'bg-blue-50 text-blue-600 border-blue-200',
  epic:      'bg-violet-50 text-violet-600 border-violet-200',
  showcase:  'bg-pink-50 text-pink-600 border-pink-200',
  legendary: 'bg-amber-50 text-amber-600 border-amber-200',
}
function RarityBadge({ r }: { r: string }) {
  if (!r) return <span className="text-[10px] text-slate-400">—</span>
  const cls = RARITY_STYLE[r.toLowerCase()] ?? 'bg-slate-50 text-slate-500 border-slate-200'
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded border', cls)}>{r}</span>
}

const DISPLAY_CAP = 600 // safety cap on rendered rows

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportRbPage() {
  const router = useRouter()
  const qc = useQueryClient()

  const [allCards, setAllCards] = useState<RiftboundCard[]>([])
  const [sets,     setSets]     = useState<SetInfo[]>([])
  const [buildId,  setBuildId]  = useState('')
  const [loading,  setLoading]  = useState(true)
  const [loadErr,  setLoadErr]  = useState('')

  // Filters
  const [setCode, setSetCode] = useState('')      // '' = all
  const [query,   setQuery]   = useState('')
  const [typeF,   setTypeF]   = useState('')
  const [rarityF, setRarityF] = useState('')
  const [domainF, setDomainF] = useState('')

  // Selection — keyed by card.id
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  // ── Load card list (once, from server proxy) ────────────────────────────────
  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setLoadErr('')
    try {
      const res = await fetch(`/api/admin/import-rb/cards${refresh ? '?refresh=1' : ''}`)
      const json = await res.json()
      if (!res.ok) { setLoadErr(json.detail ? `${json.error} — ${json.detail}` : (json.error ?? 'โหลดไม่สำเร็จ')); return }
      setAllCards(json.cards ?? [])
      setSets(json.sets ?? [])
      setBuildId(json.buildId ?? '')
      // Default to the largest set so we don't render ~950 rows at once.
      // Functional updater → only fills when nothing is selected yet (refresh keeps choice).
      if (json.sets?.length) setSetCode((prev) => prev || json.sets[0].code)
    } catch {
      setLoadErr('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(false) }, [load])

  // ── Derived filter option lists ─────────────────────────────────────────────
  const typeOptions = useMemo(
    () => Array.from(new Set(allCards.map((c) => c.type).filter(Boolean))).sort(),
    [allCards])
  const rarityOptions = useMemo(
    () => Array.from(new Set(allCards.map((c) => c.rarity).filter(Boolean))).sort(),
    [allCards])
  const domainOptions = useMemo(
    () => Array.from(new Set(allCards.flatMap((c) => c.domains))).sort(),
    [allCards])

  // ── Filtered rows ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allCards.filter((c) => {
      if (setCode && c.setCode !== setCode) return false
      if (typeF && c.type !== typeF) return false
      if (rarityF && c.rarity !== rarityF) return false
      if (domainF && !c.domains.includes(domainF)) return false
      if (q && !c.name.toLowerCase().includes(q) && !c.publicCode.toLowerCase().includes(q)) return false
      return true
    })
  }, [allCards, setCode, query, typeF, rarityF, domainF])

  const shown = filtered.slice(0, DISPLAY_CAP)

  // ── Selection helpers (operate on the visible/filtered set) ──────────────────
  const checkedCount = useMemo(() => filtered.filter((c) => checked[c.id]).length, [filtered, checked])
  const allChecked = filtered.length > 0 && filtered.every((c) => checked[c.id])
  const someChecked = checkedCount > 0

  const toggleRow = (id: string) => setChecked((m) => ({ ...m, [id]: !m[id] }))
  const toggleAll = () => {
    const next = !allChecked
    setChecked((m) => {
      const copy = { ...m }
      for (const c of filtered) copy[c.id] = next
      return copy
    })
  }
  const clearSelection = () => setChecked({})

  // ── Import ────────────────────────────────────────────────────────────────
  const IMPORT_BATCH_SIZE = 50

  const doImport = async () => {
    const selected = filtered.filter((c) => checked[c.id])
    if (!selected.length) { toast.error('ยังไม่ได้เลือกการ์ด'); return }

    setImporting(true)
    setImportProgress('')
    setResult(null)

    let totalImported = 0
    let totalSkipped  = 0
    const allErrors: string[] = []

    try {
      const batches: typeof selected[] = []
      for (let i = 0; i < selected.length; i += IMPORT_BATCH_SIZE)
        batches.push(selected.slice(i, i + IMPORT_BATCH_SIZE))

      for (let bi = 0; bi < batches.length; bi++) {
        setImportProgress(`กำลังนำเข้า batch ${bi + 1}/${batches.length}…`)
        const payload = batches[bi].map((c) => ({ ...c, price: rbPrice(c.rarity) }))
        const res = await fetch('/api/admin/import-rb', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ cards: payload }),
        })
        if (!res.ok) { allErrors.push(`Batch ${bi + 1}: HTTP ${res.status}`); continue }
        const json = await res.json()
        totalImported += json.imported ?? 0
        totalSkipped  += json.skipped  ?? 0
        allErrors.push(...(json.errors ?? []))
      }

      setResult({ imported: totalImported, skipped: totalSkipped, errors: allErrors })
      if (totalImported > 0) {
        toast.success(`นำเข้าสำเร็จ ${totalImported} รายการ`)
        clearSelection()
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
            <Swords size={22} className="text-violet-500" />
            Import Riftbound Singles
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ดึงข้อมูลการ์ดจาก Riftbound Card Gallery (Riot) แล้วเพิ่มเข้าฐานข้อมูล
            {buildId && <span className="ml-2 font-mono text-[10px] text-slate-400">build {buildId}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            disabled={loading}
            title="ดึงข้อมูลใหม่จาก Riot (ข้าม cache)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-600 text-xs font-medium hover:border-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> รีเฟรช
          </button>
          <button
            onClick={() => router.push('/admin/products')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-600 text-xs font-medium hover:border-violet-400 hover:text-violet-600 transition-colors"
          >
            <ChevronLeft size={14} /> กลับ
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <div className="card p-5 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Set */}
          <select
            value={setCode}
            onChange={(e) => setSetCode(e.target.value)}
            className="input text-sm w-auto"
          >
            <option value="">ทุก Set ({allCards.length})</option>
            {sets.map((s) => (
              <option key={s.code} value={s.code}>{s.name} ({s.count})</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อการ์ด หรือ รหัส (เช่น OGN-001)"
              className="input pl-8 text-sm w-full"
            />
          </div>

          {/* Type */}
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="input text-sm w-auto">
            <option value="">ทุก Type</option>
            {typeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Rarity */}
          <select value={rarityF} onChange={(e) => setRarityF(e.target.value)} className="input text-sm w-auto">
            <option value="">ทุก Rarity</option>
            {rarityOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {/* Domain */}
          <select value={domainF} onChange={(e) => setDomainF(e.target.value)} className="input text-sm w-auto">
            <option value="">ทุก Domain</option>
            {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {(typeF || rarityF || domainF || query) && (
            <button
              onClick={() => { setQuery(''); setTypeF(''); setRarityF(''); setDomainF('') }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-500 text-xs hover:border-red-300 hover:text-red-500 transition-colors"
            >
              <RefreshCw size={13} /> ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-violet-600 text-sm mb-4">
          <Loader2 size={15} className="animate-spin" /> กำลังโหลดข้อมูลการ์ดจาก Riftbound…
        </div>
      )}

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
          <button onClick={() => router.push('/admin/products')} className="btn-amber text-xs whitespace-nowrap">ดูสินค้า</button>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-500 font-mono">
              พบ <span className="text-slate-700 font-semibold">{filtered.length}</span> รายการ
              {filtered.length > DISPLAY_CAP && <> (แสดง {DISPLAY_CAP} แรก — กรองเพิ่มเพื่อดูที่เหลือ)</>}
              {checkedCount > 0 && <> · เลือกแล้ว <span className="text-violet-600 font-semibold">{checkedCount}</span> รายการ</>}
            </div>
            <div className="flex gap-2">
              {someChecked && (
                <button onClick={clearSelection}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-slate-200 text-slate-500 text-xs hover:border-red-300 hover:text-red-500 transition-colors">
                  ล้างที่เลือก
                </button>
              )}
              <button onClick={doImport} disabled={!someChecked || importing} className="btn-amber gap-2 disabled:opacity-50">
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                นำเข้าที่เลือก ({checkedCount})
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-violet-50/70">
                  <th className="px-3 py-3 w-9">
                    <button onClick={toggleAll} className="flex items-center justify-center">
                      {allChecked ? <CheckSquare size={15} className="text-violet-500" /> : <Square size={15} className="text-slate-400" />}
                    </button>
                  </th>
                  {['', 'ชื่อการ์ด', 'Set', 'Code', 'Type', 'Rarity', 'Domain', 'ราคา THB'].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((row) => {
                  const isOn = !!checked[row.id]
                  return (
                    <tr key={row.id} onClick={() => toggleRow(row.id)}
                      className={cn('cursor-pointer transition-colors', isOn ? 'bg-violet-50/40 hover:bg-violet-50/60' : 'hover:bg-slate-50')}>
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        {isOn ? <CheckSquare size={15} className="text-violet-500" /> : <Square size={15} className="text-slate-300" />}
                      </td>
                      {/* Thumbnail */}
                      <td className="px-3 py-2 w-12">
                        {thumb(row.imageUrl)
                          ? <img src={thumb(row.imageUrl)!} alt={row.name} className="h-10 w-auto rounded shadow-sm object-contain" loading="lazy" decoding="async" />
                          : <div className="h-10 w-7 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">?</div>}
                      </td>
                      {/* Name */}
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs text-slate-800">{row.name}</div>
                        {row.energy != null && <div className="text-[10px] text-slate-400">Energy {row.energy}</div>}
                      </td>
                      {/* Set */}
                      <td className="px-3 py-2 text-xs text-slate-600 max-w-[140px]"><div className="truncate">{row.setName}</div></td>
                      {/* Code */}
                      <td className="px-3 py-2"><span className="font-mono text-[11px] text-slate-500">{row.publicCode || `${row.setCode} #${row.collectorNumber}`}</span></td>
                      {/* Type */}
                      <td className="px-3 py-2 text-xs text-slate-700">{row.type || '—'}</td>
                      {/* Rarity (+ auto-foil tag for rare and above) */}
                      <td className="px-3 py-2">
                        <RarityBadge r={row.rarity} />
                        {isFoilRarity(row.rarity) && (
                          <span className="ml-1 text-[10px] font-bold text-amber-600" title="จะ import เป็น foil อัตโนมัติ">✨</span>
                        )}
                      </td>
                      {/* Domain */}
                      <td className="px-3 py-2">
                        <div className="flex gap-0.5 flex-wrap">
                          {row.domains.length
                            ? row.domains.map((d) => <span key={d} className="inline-block px-1.5 py-px rounded text-[10px] font-semibold bg-violet-100 text-violet-700">{d}</span>)
                            : <span className="text-[10px] text-slate-400">—</span>}
                        </div>
                      </td>
                      {/* Price */}
                      <td className="px-3 py-2 text-xs font-mono font-semibold text-amber-700">฿{rbPrice(row.rarity).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom import bar */}
          <div className="sticky bottom-4 mt-4 flex justify-end">
            <button onClick={doImport} disabled={!someChecked || importing}
              className="btn-amber gap-2 shadow-lg disabled:opacity-50 px-5 py-2.5 text-sm">
              {importing
                ? <><Loader2 size={15} className="animate-spin" /> {importProgress || 'กำลังนำเข้า…'}</>
                : <><Download size={15} /> นำเข้า {checkedCount} รายการ</>}
            </button>
          </div>
        </>
      )}

      {!loading && !loadErr && filtered.length === 0 && allCards.length > 0 && (
        <div className="text-center text-sm text-slate-400 py-10">ไม่พบการ์ดตามตัวกรอง</div>
      )}
    </div>
  )
}
