'use client'
import { useEffect, useState, useMemo, forwardRef } from 'react'
import { useForm, type UseFormRegister, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { ProductWithCategory } from '@/types'
import { LocalImageUploader } from './LocalImageUploader'
import { RB_DOMAINS, MAX_DOMAINS, parseDomains, serializeDomains } from '@/lib/domains'

// ── Zod schema (mirrors API) ────────────────────────────────
const schema = z.object({
  // Core
  name:        z.string().min(1, 'Required'),
  nameTh:      z.string().optional(),
  description: z.string().optional(),
  price:       z.coerce.number().positive('Must be > 0'),
  cost:        z.union([z.coerce.number().nonnegative(), z.literal('')]).optional(),
  stock:       z.coerce.number().int().min(0),
  condition:   z.enum(['NM','LP','MP','HP','DMG','SEALED']),
  emoji:       z.string().optional(),
  imageUrl:    z.string().optional(),
  categoryId:  z.string().min(1, 'Required'),
  isNew:       z.boolean().default(false),
  isActive:    z.boolean().default(true),
  isPreorder:  z.boolean().default(false),
  // Common extras
  sku:         z.string().optional(),
  language:    z.string().optional(),
  notes:       z.string().optional(),
  // Card-like
  setName:         z.string().optional(),
  setCode:         z.string().optional(),
  collectorNumber: z.string().optional(),
  rarity:          z.string().optional(),
  cardType:        z.string().optional(),
  colors:          z.string().optional(),
  formats:         z.string().optional(),
  foil:            z.boolean().optional(),
  // RB
  chapter:   z.string().optional(),
  domain:    z.string().optional(),
  rbRarity:  z.string().optional(),
  rbType:    z.string().optional(),
  altArt:    z.boolean().optional(),
  // Sealed
  productType: z.string().optional(),
  sealedCat:   z.string().optional(),
  rbSealedCat: z.string().optional(),
  // Paints
  brand:       z.string().optional(),
  paintCat:    z.string().optional(),
  colorCode:   z.string().optional(),
  colorFamily: z.string().optional(),
  size:        z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
  finish:      z.string().optional(),
  // Airbrush
  airbrushCat:    z.string().optional(),
  nozzle:         z.string().optional(),
  feedType:       z.string().optional(),
  compatibleWith: z.string().optional(),
  // Purchase limits
  maxPerOrder:    z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
  maxPerCustomer: z.union([z.coerce.number().int().nonnegative(), z.literal('')]).optional(),
  // Scheduled release (datetime-local string; '' = available now)
  releaseAt:      z.string().optional(),
})
type Form = z.infer<typeof schema>

interface Props {
  product: ProductWithCategory | null
  onClose: () => void
  onSaved: () => void
}

// ── Option lists (from Excel) ────────────────────────────────
const MTG_RARITIES = ['Common','Uncommon','Rare','Mythic Rare','Special','Land','Token','Promo']
const MTG_COLORS   = ['W','U','B','R','G','C','Multicolor']
const MTG_TYPES    = ['Creature','Instant','Sorcery','Enchantment','Artifact','Planeswalker','Land','Battle']
const MTG_SEALED_TYPES = ['Booster Box','Draft Booster','Collector Booster','Bundle','Commander Deck','Starter Kit','Prerelease Kit','Secret Lair']
const RB_RARITIES  = ['Common','Uncommon','Rare','Epic','Legendary']
const RB_TYPES     = ['Champion','Ally','Spell','Rune','Domain','Legend']
const RB_SEALED_TYPES = ['Booster Box','Booster Pack','Starter Deck','Bundle']
const PAINT_CATS   = ['Scalecolor Individuals','Metal N\' Alchemy Singles','Inktensity Individuals','Primer','Effect Color','Set','Diorama']
const COLOR_FAMILY = ['Neutral','Red','Orange','Yellow','Green','Blue','Purple','Brown','Black','White','Metal','Mixed']
const FINISHES     = ['Matte','Satin','Gloss','Metallic','Ink','Primer','Effect','Texture']
const AIRBRUSH_CATS= ['Airbrush','Compressor','Spare Part','Cleaner','Medium','Accessory']
const LANGUAGES    = ['EN','TH','JP','CN','KR','DE','FR','ES','IT']
const CONDITIONS   = ['NM','LP','MP','HP','DMG','SEALED']

// Map category slug → which dynamic section to show
function sectionForSlug(slug: string): 'mtg-single' | 'mtg-sealed' | 'rb-single' | 'rb-sealed' | 'paint' | 'airbrush' | 'none' {
  if (slug === 'mtg-single') return 'mtg-single'
  if (slug === 'mtg-sealed') return 'mtg-sealed'
  if (slug === 'rb-single')  return 'rb-single'
  if (slug === 'rb-sealed')  return 'rb-sealed'
  if (slug === 'paint')      return 'paint'
  if (slug === 'model-tools' || slug === 'airbrush') return 'airbrush'
  return 'none'
}

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const isEdit = !!product

  const { data: catData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => { const r = await fetch('/api/categories'); return r.json() },
  })
  const categories: { id: string; name: string; slug: string; emoji?: string }[] = catData?.data ?? []

  // Existing custom values already used by products — merged into the combobox
  // suggestions so admins reuse them instead of creating typo'd duplicates.
  const { data: paintCatData } = useQuery({
    queryKey: ['distinct', 'paintCat'],
    queryFn: async () => { const r = await fetch('/api/admin/products?distinct=paintCat'); return r.json() },
  })
  const { data: airbrushCatData } = useQuery({
    queryKey: ['distinct', 'airbrushCat'],
    queryFn: async () => { const r = await fetch('/api/admin/products?distinct=airbrushCat'); return r.json() },
  })
  // Dedupe predefined + existing values, preserving order.
  const paintCatOptions    = Array.from(new Set([...PAINT_CATS, ...((paintCatData?.data as string[]) ?? [])]))
  const airbrushCatOptions = Array.from(new Set([...AIRBRUSH_CATS, ...((airbrushCatData?.data as string[]) ?? [])]))

  // Parse JSON-stringified colors/formats back to comma string for input
  const colorsInit  = product?.colors ? safeJoin(product.colors)  : ''
  const formatsInit = product?.formats ? safeJoin(product.formats) : ''

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: product ? {
      name:            product.name,
      nameTh:          product.nameTh || '',
      description:     product.description || '',
      price:           toNum(product.price),
      cost:            product.cost != null ? toNum(product.cost) : '',
      stock:           product.stock,
      condition:       product.condition,
      emoji:           product.emoji || '',
      imageUrl:        product.imageUrl || '',
      categoryId:      product.categoryId,
      isNew:           product.isNew,
      isPreorder:      product.isPreorder ?? false,
      isActive:        product.isActive,
      sku:             product.sku || '',
      language:        product.language || 'EN',
      notes:           product.notes || '',
      setName:         product.setName || '',
      setCode:         product.setCode || '',
      collectorNumber: product.collectorNumber || '',
      rarity:          product.rarity || '',
      cardType:        product.cardType || '',
      colors:          colorsInit,
      formats:         formatsInit,
      foil:            product.foil ?? false,
      chapter:         product.chapter || '',
      domain:          product.domain || '',
      rbRarity:        product.rbRarity || '',
      rbType:          product.rbType || '',
      altArt:          product.altArt ?? false,
      productType:     product.productType || '',
      sealedCat:       product.sealedCat || '',
      rbSealedCat:     product.rbSealedCat || '',
      brand:           product.brand || '',
      paintCat:        product.paintCat || '',
      colorCode:       product.colorCode || '',
      colorFamily:     product.colorFamily || '',
      size:            product.size ?? '',
      finish:          product.finish || '',
      airbrushCat:     product.airbrushCat || '',
      nozzle:          product.nozzle || '',
      feedType:        product.feedType || '',
      compatibleWith:  product.compatibleWith || '',
      maxPerOrder:     product.maxPerOrder ?? '',
      maxPerCustomer:  product.maxPerCustomer ?? '',
      releaseAt:       toLocalInput(product.releaseAt),
    } : {
      condition: 'NM', isNew: false, isActive: true, isPreorder: false, stock: 0, language: 'EN',
      foil: false, altArt: false,
    },
  })

  // categories โหลด async — พอมาถึงให้ set categoryId ใหม่ เพื่อให้ category dropdown แสดงถูกต้อง
  useEffect(() => {
    if (product && categories.length > 0) {
      setValue('categoryId', product.categoryId)
    }
  }, [categories, product, setValue])

  const categoryId = watch('categoryId')
  const currentSlug = useMemo(() => {
    // For an existing product whose category hasn't changed, use the slug we already have
    // so the section shows instantly without waiting for the categories API response.
    if (product && categoryId === product.categoryId && product.category?.slug) return product.category.slug
    return categories.find((c) => c.id === categoryId)?.slug ?? ''
  }, [categories, categoryId, product])
  const section = sectionForSlug(currentSlug)

  // Auto-set condition to SEALED for sealed categories
  useEffect(() => {
    if (section === 'mtg-sealed' || section === 'rb-sealed') {
      setValue('condition', 'SEALED')
    }
  }, [section, setValue])

  async function onSubmit(data: Form) {
    setLoading(true)
    // Convert colors/formats comma-string → JSON array string
    const payload = {
      ...data,
      colors:         data.colors  ? JSON.stringify(data.colors.split(',').map((s) => s.trim()).filter(Boolean))  : undefined,
      formats:        data.formats ? JSON.stringify(data.formats.split(',').map((s) => s.trim()).filter(Boolean)) : undefined,
      cost:           data.cost === '' ? undefined : data.cost,
      size:           data.size === '' ? undefined : data.size,
      maxPerOrder:    data.maxPerOrder === '' ? undefined : data.maxPerOrder,
      maxPerCustomer: data.maxPerCustomer === '' ? undefined : data.maxPerCustomer,
    }
    const body = isEdit ? { id: product.id, ...payload } : payload
    const res = await fetch('/api/admin/products', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err?.error || 'Save failed')
    } else {
      toast.success(isEdit ? 'Product updated' : 'Product created')
      onSaved()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#eff6ff] border border-blue-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-blue-200 sticky top-0 bg-[#eff6ff] z-10">
          <h2 className="font-display font-bold text-warm-100">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded border border-warm-600 text-warm-400 hover:text-amber hover:border-amber transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit, (errs) => toast.error(`Validation: ${Object.keys(errs).join(', ')}`))} className="p-5 space-y-5">

          {/* ── 1. Category (drives the rest) ─────────────── */}
          <Group title="Category">
            <div className="col-span-2">
              <select {...register('categoryId')} className="input">
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji ? `${c.emoji} ` : ''}{c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <Err msg={errors.categoryId.message} />}
            </div>
          </Group>

          {/* ── 2. Basic info ──────────────────────────────── */}
          <Group title="Basic Info">
            <Field label="Name (EN) *" span={2}>
              <input {...register('name')} className="input" placeholder="Product name" />
              {errors.name && <Err msg={errors.name.message} />}
            </Field>
            <Field label="Name (TH)" span={2}>
              <input {...register('nameTh')} className="input" placeholder="ชื่อภาษาไทย" />
            </Field>
            <Field label="Image URL" span={2}>
              <div className="flex gap-2 items-center">
                <input {...register('imageUrl')} className="input flex-1" placeholder="https://… (optional)" />
                <LocalImageUploader onSelect={(url) => setValue('imageUrl', url)} />
              </div>
              <Hint text="JPG, PNG, WebP, GIF — ขนาดไม่เกิน 5 MB" />
            </Field>
            <Field label="Emoji">
              <input {...register('emoji')} className="input" placeholder="🃏" />
            </Field>
            <Field label="Language">
              <select {...register('language')} className="input">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </Group>

          {/* ── 3. Pricing & Stock ────────────────────────── */}
          <Group title="Pricing & Stock">
            <Field label="Sell Price (฿) *">
              <input type="number" step="0.01" {...register('price')} className="input" />
              {errors.price && <Err msg={errors.price.message} />}
            </Field>
            <Field label="Cost (฿)">
              <input type="number" step="0.01" {...register('cost')} className="input" placeholder="optional" />
            </Field>
            <Field label="Stock (Qty) *">
              <input type="number" {...register('stock')} className="input" />
            </Field>
            <Field label="Condition">
              <select {...register('condition')} className="input">
                {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="จำกัดต่อออเดอร์ (ชิ้น)">
              <input type="number" min="0" {...register('maxPerOrder')} className="input" placeholder="ไม่จำกัด" />
              <Hint text="เว้นว่างหรือ 0 = ไม่จำกัด" />
            </Field>
            <Field label="จำกัดต่อลูกค้า (ชิ้น)">
              <input type="number" min="0" {...register('maxPerCustomer')} className="input" placeholder="ไม่จำกัด" />
              <Hint text="เว้นว่างหรือ 0 = ไม่จำกัด · นับรวมทุกออเดอร์ตลอดกาล" />
            </Field>
          </Group>

          {/* ── 4. Category-specific section ──────────────── */}
          {section === 'mtg-single' && (
            <Group title="MTG Singles Details">
              <Field label="Set / Edition" span={2}>
                <input {...register('setName')} className="input" placeholder="e.g. Modern Horizons 2" />
              </Field>
              <Field label="Set Code">
                <input {...register('setCode')} className="input" placeholder="MH2" />
              </Field>
              <Field label="Collector #">
                <input {...register('collectorNumber')} className="input" placeholder="149" />
              </Field>
              <Field label="Rarity">
                <SelectOrEmpty {...register('rarity')} options={MTG_RARITIES} />
              </Field>
              <Field label="Card Type">
                <SelectOrEmpty {...register('cardType')} options={MTG_TYPES} />
              </Field>
              <Field label="Colors (comma-separated)" span={2}>
                <input {...register('colors')} className="input" placeholder="W, U, B (W/U/B/R/G/C)" />
                <Hint text={`Use: ${MTG_COLORS.join(', ')}`} />
              </Field>
              <Field label="Formats (comma-separated)" span={2}>
                <input {...register('formats')} className="input" placeholder="Modern, Legacy, Commander" />
              </Field>
              <Field label="Foil" span={2}>
                <Toggle reg={register('foil')} label="Foil version" />
              </Field>
            </Group>
          )}

          {section === 'mtg-sealed' && (
            <Group title="MTG Sealed Details">
              <Field label="Set / Edition" span={2}>
                <input {...register('setName')} className="input" placeholder="e.g. Duskmourn" />
              </Field>
              <Field label="Set Code">
                <input {...register('setCode')} className="input" placeholder="DSK" />
              </Field>
              <Field label="SKU">
                <input {...register('sku')} className="input" placeholder="DSK-BBX-EN" />
              </Field>
              <Field label="Product Type" span={2}>
                <SelectOrEmpty {...register('sealedCat')} options={MTG_SEALED_TYPES} />
              </Field>
            </Group>
          )}

          {section === 'rb-single' && (
            <Group title="Riftbound Singles Details">
              <Field label="Chapter / Set" span={2}>
                <input {...register('chapter')} className="input" placeholder="Chapter 1: Awakening" />
              </Field>
              <Field label="Collector #">
                <input {...register('collectorNumber')} className="input" placeholder="001" />
              </Field>
              <Field label="Type">
                <SelectOrEmpty {...register('rbType')} options={RB_TYPES} />
              </Field>
              <Field label="Rarity">
                <SelectOrEmpty {...register('rbRarity')} options={RB_RARITIES} />
              </Field>
              <Field label="Domain — เลือกได้หลาย domain (1–6)" span={2}>
                <div className="flex flex-wrap gap-2">
                  {RB_DOMAINS.map((d) => {
                    const selected = parseDomains(watch('domain') || '')
                    const checked = selected.includes(d)
                    const disabled = !checked && selected.length >= MAX_DOMAINS
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const cur = parseDomains(watch('domain') || '')
                          let next: string[]
                          if (cur.includes(d)) next = cur.filter((x) => x !== d)
                          else if (cur.length >= MAX_DOMAINS) return
                          else next = [...cur, d]
                          setValue('domain', serializeDomains(next))
                        }}
                        className={
                          'px-3 py-1.5 rounded text-xs font-semibold border transition-colors ' +
                          (checked
                            ? 'bg-blue-600 text-white border-blue-600'
                            : disabled
                              ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                              : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400')
                        }
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Alt Art / Foil" span={2}>
                <div className="flex gap-4">
                  <Toggle reg={register('foil')}   label="Foil" />
                  <Toggle reg={register('altArt')} label="Alt Art" />
                </div>
              </Field>
            </Group>
          )}

          {section === 'rb-sealed' && (
            <Group title="Riftbound Sealed Details">
              <Field label="Chapter / Set" span={2}>
                <input {...register('chapter')} className="input" placeholder="Chapter 1: Awakening" />
              </Field>
              <Field label="Product Type">
                <SelectOrEmpty {...register('rbSealedCat')} options={RB_SEALED_TYPES} />
              </Field>
              <Field label="SKU">
                <input {...register('sku')} className="input" placeholder="RB-C1-BBX" />
              </Field>
            </Group>
          )}

          {section === 'paint' && (
            <Group title="Paint Details">
              <Field label="Brand">
                <input {...register('brand')} className="input" placeholder="Scale75" />
              </Field>
              <Field label="Category">
                <ComboInput {...register('paintCat')} options={paintCatOptions} />
                <Hint text="เลือกจากรายการ หรือพิมพ์หมวดใหม่ — ค่าใหม่จะกลายเป็นตัวกรองในหน้าร้านอัตโนมัติ" />
              </Field>
              <Field label="Color Code">
                <input {...register('colorCode')} className="input" placeholder="SC-006" />
              </Field>
              <Field label="Color Family">
                <SelectOrEmpty {...register('colorFamily')} options={COLOR_FAMILY} />
              </Field>
              <Field label="Size (ml)">
                <input type="number" {...register('size')} className="input" placeholder="17" />
              </Field>
              <Field label="Finish / Type">
                <SelectOrEmpty {...register('finish')} options={FINISHES} />
              </Field>
            </Group>
          )}

          {section === 'airbrush' && (
            <Group title="Airbrush / Tool Details">
              <Field label="Brand">
                <input {...register('brand')} className="input" placeholder="Harder & Steenbeck" />
              </Field>
              <Field label="Category">
                <ComboInput {...register('airbrushCat')} options={airbrushCatOptions} />
                <Hint text="เลือกจากรายการ หรือพิมพ์หมวดใหม่ — ค่าใหม่จะกลายเป็นตัวกรองในหน้าร้านอัตโนมัติ" />
              </Field>
              <Field label="Nozzle (mm)">
                <input {...register('nozzle')} className="input" placeholder="0.2 / 0.4" />
              </Field>
              <Field label="Feed Type">
                <input {...register('feedType')} className="input" placeholder="Gravity / Siphon" />
              </Field>
              <Field label="Compatible With" span={2}>
                <input {...register('compatibleWith')} className="input" placeholder="Universal" />
              </Field>
              <Field label="SKU" span={2}>
                <input {...register('sku')} className="input" placeholder="H&S-INF" />
              </Field>
            </Group>
          )}

          {/* ── 5. Notes & visibility ─────────────────────── */}
          <Group title="Notes & Visibility">
            <Field label="Description / Notes" span={2}>
              <textarea {...register('notes')} className="input h-20 resize-none" placeholder="Optional notes about this product…" />
            </Field>
            <Field label="วางขาย (Release date)" span={2}>
              <input type="datetime-local" {...register('releaseAt')} className="input" />
              <Hint text="เว้นว่าง = ขายทันที · ตั้งเวลาในอนาคต = แสดงแบบ “เร็วๆ นี้” พร้อมนับถอยหลัง (ยังกดซื้อไม่ได้จนถึงเวลา)" />
            </Field>
            <div className="col-span-2 flex flex-wrap gap-4 pt-1">
              <Toggle reg={register('isNew')}    label="Mark as New" />
              <Toggle reg={register('isActive')} label="Active (visible in shop)" />
              <Toggle reg={register('isPreorder')} label="Pre-order (ซื้อได้ก่อน · ส่งเมื่อของเข้า)" />
            </div>
          </Group>

          {/* ── Footer buttons ─────────────────────────────── */}
          <div className="flex gap-3 pt-2 border-t border-blue-200 mt-2 sticky bottom-0 bg-[#eff6ff] -mx-5 px-5 pb-1">
            <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading} className="btn-amber flex-1 justify-center">
              {loading ? 'Saving…' : isEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Small UI helpers ──────────────────────────────────────────
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[10px] font-mono uppercase tracking-wider text-warm-500 mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </section>
  )
}

function Field({ label, span = 1, children }: { label: string; span?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-warm-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-red-400 text-xs mt-1">{msg}</p>
}

function Hint({ text }: { text: string }) {
  return <p className="text-warm-500 text-[11px] mt-1">{text}</p>
}

// Forward-ref-friendly toggle that integrates with react-hook-form's register()
function Toggle({ reg, label }: { reg: ReturnType<UseFormRegister<Form>>; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-warm-300">
      <input type="checkbox" {...reg} className="accent-amber w-4 h-4" />
      <span>{label}</span>
    </label>
  )
}

// Select with an "any" / empty fallback option.
// MUST use forwardRef so react-hook-form's register() ref reaches the underlying
// <select>. Without it the ref is swallowed by the function component, so RHF can
// neither display the existing value (shows "— Select —") nor read the selection
// on submit (edits silently don't save).
const SelectOrEmpty = forwardRef<
  HTMLSelectElement,
  { options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>
>(function SelectOrEmpty({ options, ...rest }, ref) {
  return (
    <select {...rest} ref={ref} className="input">
      <option value="">— Select —</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
})

// Editable combobox: pick a suggested value OR type a brand-new one (via <datalist>).
// New values flow straight into the field and become shop filter options on save.
// forwardRef for the same RHF reason as SelectOrEmpty above.
let comboSeq = 0
const ComboInput = forwardRef<
  HTMLInputElement,
  { options: string[] } & React.InputHTMLAttributes<HTMLInputElement>
>(function ComboInput({ options, ...rest }, ref) {
  const listId = useMemo(() => `combo-${++comboSeq}`, [])
  return (
    <>
      <input {...rest} ref={ref} list={listId} className="input" placeholder="เลือกหรือพิมพ์ค่าใหม่…" autoComplete="off" />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </>
  )
})

// ── Utilities ────────────────────────────────────────────────
// Format a Date/ISO string into the local "YYYY-MM-DDTHH:mm" value a
// <input type="datetime-local"> expects. Returns '' for null/invalid.
function toLocalInput(v: unknown): string {
  if (!v) return ''
  const d = new Date(v as string | number | Date)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber()
  }
  return Number(v)
}

function safeJoin(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.join(', ')
  } catch { /* fallthrough */ }
  return raw
}
