import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addressSchema = z.object({
  label:    z.string().min(1).max(50).default('บ้าน'),
  name:     z.string().min(1).max(100),
  phone:    z.string().min(1).max(20),
  address:  z.string().min(1).max(500),
  subdistrict: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  province: z.string().min(1).max(100),
  postal:   z.string().max(10).optional(),
  isDefault: z.boolean().optional(),
})

async function getSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return session
}

// GET — ดึงที่อยู่ทั้งหมด
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ data: addresses })
}

// POST — สร้างที่อยู่ใหม่
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = addressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { isDefault, ...data } = parsed.data

  // ถ้าตั้งเป็น default ให้ถอด default ของเก่าออกก่อน
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data:  { isDefault: false },
    })
  }

  // ถ้าเป็นที่อยู่แรก ให้ตั้งเป็น default อัตโนมัติ
  const count = await prisma.address.count({ where: { userId: session.user.id } })
  const shouldBeDefault = isDefault || count === 0

  const address = await prisma.address.create({
    data: { ...data, isDefault: shouldBeDefault, userId: session.user.id },
  })

  return NextResponse.json({ data: address }, { status: 201 })
}
