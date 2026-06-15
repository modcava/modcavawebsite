import { NextRequest, NextResponse } from 'next/server'
import { sweepExpiredUnpaidOrders } from '@/lib/order-maintenance'

// Cancel PENDING orders that never got a payment slip within 48h.
// Call this on a schedule (Windows Task Scheduler / cron / Vercel Cron / uptime pinger).
//
//   GET|POST /api/cron/cancel-unpaid-orders
//   Authorization: Bearer <CRON_SECRET>   (or ?key=<CRON_SECRET>)
//
// Set CRON_SECRET in .env. Without it the endpoint refuses to run.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const header = req.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : ''
  const key = bearer || new URL(req.url).searchParams.get('key') || ''
  if (key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cancelled = await sweepExpiredUnpaidOrders()
  return NextResponse.json({ ok: true, cancelled })
}

export const GET = handle
export const POST = handle
