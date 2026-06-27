import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { readFile } from 'fs/promises'
import path from 'path'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SLIPS_DIR, mimeForFile } from '@/lib/slips'

export const dynamic = 'force-dynamic'

// GET /api/slips/<file> — เสิร์ฟสลิปการโอนแบบเช็คสิทธิ์
//   แอดมิน → ดูได้ทุกใบ
//   ลูกค้า  → ดูได้เฉพาะสลิปของออเดอร์ตัวเอง
export async function GET(_req: NextRequest, { params }: { params: { file: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = params.file
  // กัน path traversal — อนุญาตเฉพาะชื่อไฟล์ล้วน (ห้าม / \ .. )
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..') || path.basename(file) !== file) {
    return NextResponse.json({ error: 'Invalid file' }, { status: 400 })
  }

  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    // ลูกค้าทั่วไป: ต้องเป็นเจ้าของออเดอร์ที่อ้างสลิปนี้
    // (ตรงกับสลิปมัดจำ slipUrl หรือสลิปยอดคงเหลือ balanceSlipUrl ก็ได้)
    const ref = `/api/slips/${file}`
    const owned = await prisma.order.findFirst({
      where: { userId: session.user.id, OR: [{ slipUrl: ref }, { balanceSlipUrl: ref }] },
      select: { id: true },
    })
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let data: Buffer
  try {
    data = await readFile(path.join(SLIPS_DIR, file))
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type':        mimeForFile(file),
      'Cache-Control':       'private, no-store',
      'X-Robots-Tag':        'noindex, nofollow',
      'Content-Disposition': `inline; filename="${file}"`,
    },
  })
}
