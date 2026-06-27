import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { SLIPS_DIR, slipUrlFor } from '@/lib/slips'
import { sendBalanceSlipNotification } from '@/lib/discord'

// POST /api/orders/balance-slip — ลูกค้าอัปโหลด "สลิปยอดคงเหลือ" (พรีออเดอร์รอบสอง).
// แยกจาก /api/orders/slip ที่บังคับสถานะ PENDING — อันนี้รับเฉพาะออเดอร์ที่ผ่านมัดจำแล้ว
// (CONFIRMED/SHIPPED) และยังมียอดค้าง เก็บลงคอลัมน์ balanceSlipUrl (ไม่ทับสลิปมัดจำ).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('slip') as File | null
  const orderNumber = formData.get('orderNumber') as string | null

  if (!file || !orderNumber) {
    return NextResponse.json({ error: 'Missing file or orderNumber' }, { status: 400 })
  }

  // ตรวจสอบว่า order เป็นของ user นี้
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.user.id },
    select: {
      id: true, status: true, recipientName: true, phone: true,
      remainingBalance: true, balancePaidAt: true,
    },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // ต้องมียอดคงเหลือค้างอยู่ และยังไม่ปิดยอด
  if (Number(order.remainingBalance) <= 0 || order.balancePaidAt) {
    return NextResponse.json({ error: 'ออเดอร์นี้ไม่มียอดคงเหลือที่ต้องชำระ' }, { status: 400 })
  }
  // ชำระยอดคงเหลือได้หลังมัดจำผ่าน (ยืนยัน/จัดส่งแล้ว) — กันจ่ายยอดคงเหลือก่อนจ่ายมัดจำ
  if (order.status !== 'CONFIRMED' && order.status !== 'SHIPPED') {
    return NextResponse.json({ error: 'ชำระยอดคงเหลือได้หลังยืนยันมัดจำแล้วเท่านั้น' }, { status: 400 })
  }

  // ตรวจสอบชนิดไฟล์
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)' }, { status: 400 })
  }

  // ตรวจสอบขนาดไฟล์ (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' }, { status: 400 })
  }

  // บันทึกไฟล์ — ใส่ -balance- ในชื่อกันชนกับสลิปมัดจำ
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: 'นามสกุลไฟล์ไม่รองรับ' }, { status: 400 })
  }
  const filename = `${orderNumber}-balance-${Date.now()}.${ext}`
  await mkdir(SLIPS_DIR, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(SLIPS_DIR, filename), buffer)

  const balanceSlipUrl = slipUrlFor(filename)

  await prisma.order.update({
    where: { id: order.id },
    data: { balanceSlipUrl },
  })

  // แจ้งเตือน admin ใน Discord — fire-and-forget
  sendBalanceSlipNotification({
    orderNumber,
    recipientName: order.recipientName,
    phone: order.phone,
    remainingBalance: order.remainingBalance,
  }).catch(() => {})

  return NextResponse.json({ balanceSlipUrl })
}
