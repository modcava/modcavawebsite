import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/rate-limit'

// ──────────────────────────────────────────────────────────────
// Audit log — record admin actions for traceability.
//
// Design goals:
//   • Never break the calling flow — errors here are swallowed and logged
//     to console (admin actions must succeed even if audit DB is down).
//   • Cheap to call — one INSERT, no joins, no reads.
//   • Snapshot user email so logs survive user deletion.
// ──────────────────────────────────────────────────────────────

export interface AuditContext {
  userId:    string
  userEmail: string
}

export interface AuditEntry {
  /** Verb-noun action key. Examples: 'product.create', 'order.cancel'. */
  action:     string
  /** Resource type. Examples: 'product', 'order', 'coupon'. */
  resource:   string
  /** Affected entity ID (null for bulk / non-targeted actions). */
  resourceId?: string | null
  /** Arbitrary structured data — e.g. { before, after }. */
  details?:   Record<string, unknown> | null
  /** Optional Request for IP/User-Agent capture. */
  req?:       Request | null
}

export async function logAudit(ctx: AuditContext, entry: AuditEntry): Promise<void> {
  try {
    const ip        = entry.req ? getClientIp(entry.req) : null
    const userAgent = entry.req?.headers.get('user-agent') ?? null

    await prisma.auditLog.create({
      data: {
        userId:     ctx.userId,
        userEmail:  ctx.userEmail,
        action:     entry.action,
        resource:   entry.resource,
        resourceId: entry.resourceId ?? null,
        details:    entry.details ? JSON.stringify(entry.details) : null,
        ip,
        userAgent,
      },
    })
  } catch (err) {
    // Never break the caller — log to stderr instead.
    console.error('[audit] failed to record action', entry.action, err)
  }
}

/**
 * Compute a shallow diff of changed fields between two objects.
 * Useful for `details: diffObjects(before, after)` in update audits.
 * Returns null if nothing changed.
 */
export function diffObjects<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { before: Partial<T>; after: Partial<T> } | null {
  const b: Partial<T> = {}
  const a: Partial<T> = {}
  let changed = false
  for (const key of Object.keys(after) as Array<keyof T>) {
    if (after[key] === undefined) continue
    // Stringify for deep value comparison (handles Decimal, Date, nested)
    const beforeJson = JSON.stringify(before[key] ?? null)
    const afterJson  = JSON.stringify(after[key] ?? null)
    if (beforeJson !== afterJson) {
      b[key] = before[key]
      a[key] = after[key]
      changed = true
    }
  }
  return changed ? { before: b, after: a } : null
}
