import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

const schema = z.object({
  name:  z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร').max(100),
  phone: z.string().max(20).optional(),
})

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data:  { name: parsed.data.name, phone: parsed.data.phone ?? null },
    select: { id: true, name: true, phone: true },
  })

  return NextResponse.json({ data: user })
}
