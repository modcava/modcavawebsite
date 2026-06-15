import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Condition } from '@prisma/client'
import type React from 'react'
import { randomBytes } from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | string | { toNumber(): number }) {
  const n = typeof price === 'number' ? price
          : typeof price === 'string' ? (parseFloat(price) || 0)
          : price.toNumber()
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function conditionLabel(c: Condition): string {
  const map: Record<Condition, string> = {
    NM: 'Near Mint',
    LP: 'Light Play',
    MP: 'Moderate Play',
    HP: 'Heavy Play',
    DMG: 'Damaged',
    SEALED: 'Sealed',
  }
  return map[c]
}

export function conditionColor(c: Condition): string {
  const map: Record<Condition, string> = {
    NM:     'bg-green-100 text-green-700 border-green-200',
    LP:     'bg-blue-100 text-blue-700 border-blue-200',
    MP:     'bg-yellow-100 text-yellow-700 border-yellow-200',
    HP:     'bg-orange-100 text-orange-700 border-orange-200',
    DMG:    'bg-red-100 text-red-600 border-red-200',
    SEALED: 'bg-violet-100 text-violet-700 border-violet-200',
  }
  return map[c]
}

/** คืน inline style สำหรับ status badge (ใช้กับ CSS variables pages) */
export function statusStyle(status: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    PENDING:   { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' },
    CONFIRMED: { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
    SHIPPED:   { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
    DELIVERED: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
    CANCELLED: { background: '#f9fafb', color: '#9ca3af', border: '1px solid #e5e7eb' },
  }
  return map[status] ?? map.CANCELLED!
}

/** แปลง OrderStatus เป็นภาษาไทย */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING:   'รอดำเนินการ',
    CONFIRMED: 'ยืนยันแล้ว',
    SHIPPED:   'จัดส่งแล้ว',
    DELIVERED: 'ได้รับสินค้าแล้ว',
    CANCELLED: 'ยกเลิก',
  }
  return map[status] ?? status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING:   'bg-yellow-100 text-yellow-700',
    CONFIRMED: 'bg-blue-100 text-blue-700',
    SHIPPED:   'bg-violet-100 text-violet-700',
    DELIVERED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-600',
  }
  return map[status] || 'bg-slate-100 text-slate-500'
}

export function generateOrderNumber(): string {
  const ts   = Date.now().toString(36).toUpperCase()          // timestamp base36
  const rand = randomBytes(3).toString('hex').toUpperCase()   // 6 hex chars (crypto random)
  return `MCV-${ts}-${rand}`
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str
}
