import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { SLIPS_DIR, slipUrlFor } from '@/lib/slips'

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
    select: { id: true, status: true },
  })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  // อัปสลิปได้เฉพาะออเดอร์ที่ยังรอชำระเงิน — กันอัปทับออเดอร์ที่ยืนยัน/ยกเลิก/ส่งแล้ว
  if (order.status !== 'PENDING') {
    return NextResponse.json({ error: 'ออเดอร์นี้ไม่อยู่ในสถานะที่อัปโหลดสลิปได้' }, { status: 400 })
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

  // บันทึกไฟล์
  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  if (!allowedExts.includes(ext)) {
    return NextResponse.json({ error: 'นามสกุลไฟล์ไม่รองรับ' }, { status: 400 })
  }
  const filename = `${orderNumber}-${Date.now()}.${ext}`
  await mkdir(SLIPS_DIR, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(SLIPS_DIR, filename), buffer)

  // เก็บ URL แบบป้องกันสิทธิ์ (เสิร์ฟผ่าน /api/slips/ — ไม่ใช่ static /slips/)
  const slipUrl = slipUrlFor(filename)

  // อัปเดต order
  await prisma.order.update({
    where: { id: order.id },
    data: { slipUrl },
  })

  return NextResponse.json({ slipUrl })
}
