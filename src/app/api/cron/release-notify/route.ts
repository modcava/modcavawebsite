import { NextRequest, NextResponse } from 'next/server'
import { sweepReleasedSubscriptions } from '@/lib/stock-notify'

// แจ้งเตือนลูกค้าที่กด "แจ้งเตือนเมื่อวางขาย" เมื่อสินค้าถึงเวลาวางจำหน่าย (releaseAt
// ผ่านแล้ว) หรือมีของกลับมา — เรียกตามตารางเวลา (cron) เพราะการวางจำหน่ายตามเวลา
// ไม่มี admin edit มาจุดชนวน trigger ปกติ
//
//   GET|POST /api/cron/release-notify
//   Authorization: Bearer <CRON_SECRET>   (หรือ ?key=<CRON_SECRET>)
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

  const { products, sent } = await sweepReleasedSubscriptions()
  return NextResponse.json({ ok: true, products, sent })
}

export const GET = handle
export const POST = handle
