import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addressSchema = z.object({
  label:    z.string().min(1).max(50).optional(),
  name:     z.string().min(1).max(100).optional(),
  phone:    z.string().min(1).max(20).optional(),
  address:  z.string().min(1).max(500).optional(),
  subdistrict: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  province: z.string().min(1).max(100).optional(),
  postal:   z.string().max(10).optional(),
  isDefault: z.boolean().optional(),
})

async function getOwned(userId: string, id: string) {
  return prisma.address.findFirst({ where: { id, userId } })
}

// PUT — แก้ไขที่อยู่
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getOwned(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = addressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { isDefault, ...data } = parsed.data

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data:  { isDefault: false },
    })
  }

  const updated = await prisma.address.update({
    where: { id: params.id },
    data:  { ...data, ...(isDefault !== undefined ? { isDefault } : {}) },
  })

  return NextResponse.json({ data: updated })
}

// DELETE — ลบที่อยู่
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getOwned(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.address.delete({ where: { id: params.id } })

  // ถ้าที่อยู่ที่ลบเป็น default ให้ตั้งอันล่าสุดเป็น default แทน
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where:   { userId: session.user.id },
      orderBy: { createdAt: 'asc' },
    })
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
  }

  return NextResponse.json({ ok: true })
}

// PATCH — ตั้งเป็นที่อยู่หลัก
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await getOwned(session.user.id, params.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.address.updateMany({
    where: { userId: session.user.id },
    data:  { isDefault: false },
  })
  const updated = await prisma.address.update({
    where: { id: params.id },
    data:  { isDefault: true },
  })

  return NextResponse.json({ data: updated })
}
