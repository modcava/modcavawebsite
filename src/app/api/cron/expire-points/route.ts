import { NextRequest, NextResponse } from 'next/server'
import { expirePoints } from '@/lib/points'

// หมดอายุแต้มสะสมที่เกิน 12 เดือน — เรียกตามตารางเวลา (cron)
//
//   GET|POST /api/cron/expire-points
//   Authorization: Bearer <CRON_SECRET>   (หรือ ?key=<CRON_SECRET>)
//
// ตั้ง CRON_SECRET ใน .env · ถ้าไม่ตั้งจะปฏิเสธการรัน
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

  const expired = await expirePoints()
  return NextResponse.json({ ok: true, expired })
}

export const GET = handle
export const POST = handle
