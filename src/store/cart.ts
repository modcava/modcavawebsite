'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { CartItem } from '@/types'

// effective cap = min(stock, maxPerOrder, remaining customer quota)
// Defensive defaults: alreadyBought อาจเป็น undefined ถ้า cart มาจาก localStorage schema เก่า
function effectiveCap(item: CartItem): number {
  const bought = item.alreadyBought ?? 0
  const customerRemaining = item.maxPerCustomer
    ? Math.max(0, item.maxPerCustomer - bought)
    : Infinity
  return Math.min(item.stock, item.maxPerOrder || Infinity, customerRemaining)
}

function capReason(item: CartItem, qty: number): string {
  const bought = item.alreadyBought ?? 0
  const customerRemaining = item.maxPerCustomer
    ? Math.max(0, item.maxPerCustomer - bought)
    : Infinity
  if (item.maxPerCustomer && qty > customerRemaining) {
    const remaining = Math.max(0, item.maxPerCustomer - bought)
    return remaining === 0
      ? `จำกัดการซื้อ ${item.maxPerCustomer} ชิ้น/ลูกค้า (ซื้อครบแล้ว)`
      : `จำกัดการซื้อ ${item.maxPerCustomer} ชิ้น/ลูกค้า (เหลือได้อีก ${remaining} ชิ้น)`
  }
  if (item.maxPerOrder && qty > item.maxPerOrder) {
    return `จำกัดการซื้อ ${item.maxPerOrder} ชิ้น/ออเดอร์`
  }
  return `สต็อกมีเพียง ${item.stock} ชิ้น`
}

// Normalize CartItem ที่อาจมาจาก localStorage schema เก่า (ไม่มี maxPerCustomer / alreadyBought)
function normalizeCartItem(item: Partial<CartItem>): CartItem {
  return {
    ...item,
    maxPerOrder:    item.maxPerOrder ?? null,
    maxPerCustomer: item.maxPerCustomer ?? null,
    alreadyBought:  item.alreadyBought ?? 0,
    isPreorder:     item.isPreorder ?? false,
    depositPercent: item.depositPercent ?? null,
    payFullPrice:   item.payFullPrice ?? false,
  } as CartItem
}

// ราคาที่จ่ายจริงต่อหน่วย (มัดจำ % ถ้าเป็น preorder ที่มี depositPercent และยังไม่ได้เลือกจ่ายเต็ม)
function effectiveUnitPrice(item: CartItem): number {
  if (item.isPreorder && item.depositPercent && !item.payFullPrice) {
    return Math.round(item.price * item.depositPercent / 100 * 100) / 100
  }
  return item.price
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  clearCart: () => void
  total: () => number
  depositTotal: () => number        // ยอดที่จ่ายจริง (มัดจำสำหรับ preorder)
  remainingTotal: () => number      // ยอดค้างชำระ (ส่วนที่ยังไม่จ่าย)
  count: () => number
  syncProducts: (updates: Array<{
    id: string
    stock: number
    maxPerOrder: number | null
    maxPerCustomer: number | null
    alreadyBought: number
    isPreorder: boolean
    depositPercent: number | null
  }>) => void
  setPayFullPrice: (id: string, payFull: boolean) => void
  validateLimits: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.id === item.id)
        if (existing) {
          const cap = effectiveCap(existing)
          if (existing.quantity >= cap) {
            toast.warning(`"${existing.name}" ${capReason(existing, existing.quantity)}`)
            return
          }
          set((state) => ({
            items: state.items.map((i) =>
              i.id === item.id ? { ...i, quantity: Math.min(i.quantity + 1, cap) } : i
            ),
          }))
          return
        }
        set((state) => ({ items: [...state.items, { ...item, quantity: 1 }] }))
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) => {
        if (qty <= 0) {
          set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
          return
        }
        const item = get().items.find((i) => i.id === id)
        if (!item) return
        const cap = effectiveCap(item)
        if (qty > cap) {
          toast.warning(`"${item.name}" ${capReason(item, qty)}`)
          qty = cap
        }
        set((state) => ({
          items: state.items.map((i) => i.id === id ? { ...i, quantity: qty } : i),
        }))
      },

      clearCart: () => set({ items: [] }),

      setPayFullPrice: (id, payFull) =>
        set((state) => ({
          items: state.items.map((i) => i.id === id ? { ...i, payFullPrice: payFull } : i),
        })),

      syncProducts: (updates) => {
        const map = Object.fromEntries(updates.map((u) => [u.id, u]))
        set((state) => ({
          items: state.items.map((item) => {
            const u = map[item.id]
            if (!u) return item
            return {
              ...item,
              stock: u.stock,
              maxPerOrder: u.maxPerOrder,
              maxPerCustomer: u.maxPerCustomer,
              alreadyBought: u.alreadyBought,
              isPreorder: u.isPreorder,
              depositPercent: u.depositPercent,
            }
          }),
        }))
      },

      validateLimits: () => {
        const items = get().items
        type Fix = { name: string; from: number; to: number }
        const fixes: Fix[] = []
        const newItems = items.map((item) => {
          const cap = effectiveCap(item)
          if (item.quantity > cap) {
            fixes.push({ name: item.name, from: item.quantity, to: cap })
            return { ...item, quantity: cap }
          }
          return item
        })
        if (fixes.length === 0) return
        set({ items: newItems })
        const label = fixes.length === 1
          ? `"${fixes[0].name}" ปรับจาก ${fixes[0].from} → ${fixes[0].to} ชิ้น (เกินลิมิต)`
          : `ปรับ ${fixes.length} รายการในตะกร้าที่เกินลิมิต`
        toast.warning(label)
      },

      total: () =>
        get().items.reduce((sum, i) => sum + effectiveUnitPrice(i) * i.quantity, 0),

      depositTotal: () =>
        get().items.reduce((sum, i) => sum + effectiveUnitPrice(i) * i.quantity, 0),

      remainingTotal: () =>
        get().items.reduce((sum, i) => {
          if (!i.isPreorder || !i.depositPercent) return sum
          return sum + (i.price - effectiveUnitPrice(i)) * i.quantity
        }, 0),

      count: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'modcava-cart',
      version: 3,
      skipHydration: true,
      // Backfill fields เมื่อ schema เปลี่ยน — กัน undefined ใน effectiveCap()
      // ทำงานเมื่อ rehydrate จาก modcava-cart key (รวมทั้งกรณี per-user snapshot restore
      // ที่เขียนทับ modcava-cart แล้วเรียก rehydrate() — ดูที่ shop-client.tsx)
      migrate: (persistedState) => {
        const state = persistedState as { items?: Partial<CartItem>[] } | null
        if (state?.items) {
          state.items = state.items.map(normalizeCartItem)
        }
        return state as CartStore
      },
    }
  )
)
