import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuthUrl } from '@/lib/gmail'

// GET /api/admin/gmail-auth — redirect ไป Google เพื่อ authorize
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
