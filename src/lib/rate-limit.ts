import { NextResponse } from 'next/server'

// ──────────────────────────────────────────────────────────────
// In-memory sliding-window rate limiter
//
// State is per-process; resets on restart and is NOT shared across
// instances. Fine for single-server deployments. For multi-instance
// production, swap the storage layer with Redis / Upstash.
// ──────────────────────────────────────────────────────────────

type Bucket = { timestamps: number[] }
const buckets = new Map<string, Bucket>()

// Periodic cleanup — drop idle buckets to bound memory.
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes
const MAX_BUCKET_AGE   = 60 * 60 * 1000 // 1 hour

if (typeof setInterval !== 'undefined') {
  const handle = setInterval(() => {
    const cutoff = Date.now() - MAX_BUCKET_AGE
    // Array.from() — tsconfig target doesn't allow direct Map iteration
    for (const [key, bucket] of Array.from(buckets.entries())) {
      const last = bucket.timestamps[bucket.timestamps.length - 1]
      if (last == null || last < cutoff) buckets.delete(key)
    }
  }, CLEANUP_INTERVAL)
  // Don't prevent Node.js from exiting because of this timer
  handle.unref?.()
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
  limit: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now    = Date.now()
  const cutoff = now - windowMs
  const bucket = buckets.get(key) ?? { timestamps: [] }
  // Drop expired timestamps
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff)

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0]
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
      limit,
    }
  }
  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return {
    ok: true,
    remaining: limit - bucket.timestamps.length,
    retryAfterMs: 0,
    limit,
  }
}

// Extract a stable client identifier from the request.
// Order of preference: x-forwarded-for (first IP) → x-real-ip → 'unknown'
// (works with both NextRequest and standard Request)
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const xri = req.headers.get('x-real-ip')
  if (xri) return xri.trim()
  return 'unknown'
}

interface EnforceOptions {
  /** Unique route identifier (e.g. 'register', 'login'). */
  key: string
  /** Max requests per window. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
  /** Override identity (e.g. userId). Defaults to client IP. */
  by?: string
  /** Public error message (Thai-friendly default). */
  message?: string
}

/**
 * Enforce a rate limit on the current request.
 * Returns a 429 response if the limit is exceeded, otherwise `null`
 * (so the caller can `if (rl) return rl` and continue normally).
 *
 * @example
 * const rl = enforceRateLimit(req, { key: 'register', limit: 5, windowMs: 60 * 60 * 1000 })
 * if (rl) return rl
 */
export function enforceRateLimit(req: Request, opts: EnforceOptions): NextResponse | null {
  const identity = opts.by ?? getClientIp(req)
  const compositeKey = `${opts.key}:${identity}`
  const result = checkRateLimit(compositeKey, opts.limit, opts.windowMs)
  if (result.ok) return null

  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000)
  const minutes = Math.ceil(retryAfterSec / 60)
  const defaultMsg = retryAfterSec >= 60
    ? `คุณส่งคำขอบ่อยเกินไป กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`
    : `คุณส่งคำขอบ่อยเกินไป กรุณารอ ${retryAfterSec} วินาทีแล้วลองใหม่`

  return NextResponse.json(
    { error: opts.message ?? defaultMsg, retryAfter: retryAfterSec },
    {
      status: 429,
      headers: {
        'Retry-After':           String(retryAfterSec),
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': '0',
      },
    },
  )
}
