// Coupon helpers shared by the checkout (order creation) and the coupon
// validation preview, so both compute the discount identically.

// A coupon's category restriction is stored as a JSON array of Category ids in
// Coupon.categoryIds. null / '' / [] means "no restriction" (applies to the
// whole cart).
export function parseCategoryIds(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  } catch {
    return []
  }
}

// Subtotal of the line items the coupon may discount. With no restriction this
// is the whole cart; otherwise only items whose category is in the allow-list.
export function eligibleSubtotal(
  items: { categoryId: string; lineTotal: number }[],
  allowedCategoryIds: string[],
): number {
  if (allowedCategoryIds.length === 0) return items.reduce((s, i) => s + i.lineTotal, 0)
  const allow = new Set(allowedCategoryIds)
  return items.filter((i) => allow.has(i.categoryId)).reduce((s, i) => s + i.lineTotal, 0)
}
