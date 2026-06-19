import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRiftboundCards } from '@/lib/riftbound'

// GET /api/admin/import-rb/cards
// Returns the full normalized Riftbound card list (from Riot's public gallery,
// cached server-side). Pass ?refresh=1 to bypass the cache.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const force = new URL(req.url).searchParams.get('refresh') === '1'

  try {
    const { cards, buildId, fetchedAt, cached, sets } = await getRiftboundCards(force)
    return NextResponse.json({ cards, buildId, fetchedAt, cached, sets, total: cards.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: 'ดึงข้อมูลจาก Riftbound gallery ไม่สำเร็จ', detail: msg },
      { status: 502 },
    )
  }
}
