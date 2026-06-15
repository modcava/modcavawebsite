import type { Category, Condition, Order, OrderItem, OrderStatus, Product, Role, User } from '@prisma/client'

// ── Re-exports ─────────────────────────────────────────────
export type { Condition, OrderStatus, Role }

// ── Product with relations ─────────────────────────────────
export type ProductWithCategory = Product & {
  category: Category
  // Extended fields added in schema (optional until Prisma client regenerates)
  cost?:            number | { toNumber: () => number } | null
  sku?:             string | null
  language?:        string | null
  notes?:           string | null
  // Card-like
  rarity?:          string | null
  colors?:          string | null
  formats?:         string | null
  cardType?:        string | null
  setCode?:         string | null
  collectorNumber?: string | null
  foil?:            boolean | null
  // Sealed
  sealedCat?:       string | null
  rbSealedCat?:     string | null
  productType?:     string | null
  // Riftbound
  rbRarity?:        string | null
  rbType?:          string | null
  chapter?:         string | null
  domain?:          string | null
  altArt?:          boolean | null
  // Paints
  paintCat?:        string | null
  brand?:           string | null
  colorCode?:       string | null
  colorFamily?:     string | null
  size?:            number | null
  finish?:          string | null
  // Airbrush / tools
  airbrushCat?:     string | null
  nozzle?:          string | null
  feedType?:        string | null
  compatibleWith?:  string | null
  // Purchase limits
  maxPerOrder?:     number | null
  maxPerCustomer?:  number | null
}

// ── Order with relations ───────────────────────────────────
export type OrderWithItems = Order & {
  items: (OrderItem & { product: Product })[]
  user: Pick<User, 'id' | 'name' | 'email'>
}

// ── Cart ───────────────────────────────────────────────────
export interface CartItem {
  id: string
  name: string
  nameTh: string
  price: number
  quantity: number
  stock: number
  maxPerOrder: number | null
  maxPerCustomer: number | null
  alreadyBought: number
  condition: Condition
  setName: string | null
  emoji: string | null
  imageUrl: string | null
  categorySlug: string
}

// ── API Response types ─────────────────────────────────────
export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Session ────────────────────────────────────────────────
export interface SessionUser {
  id: string
  name?: string | null
  email?: string | null
  role: Role
}

// ── Forms ──────────────────────────────────────────────────
export interface CheckoutForm {
  recipientName: string
  phone: string
  address: string
  district: string
  province: string
  postalCode: string
  shippingMethod: string
  paymentMethod: string
  note?: string
}

export interface ProductForm {
  name: string
  nameTh?: string
  description?: string
  price: number
  stock: number
  condition: Condition
  setName?: string
  emoji?: string
  imageUrl?: string
  categoryId: string
  isNew: boolean
  isActive: boolean
}

// ── Admin Stats ────────────────────────────────────────────
export interface AdminStats {
  totalRevenue: number
  totalOrders: number
  totalProducts: number
  totalUsers: number
  recentOrders: OrderWithItems[]
  ordersByStatus: Record<OrderStatus, number>
}
