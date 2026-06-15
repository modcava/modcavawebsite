import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addressSchema = z.object({
  savedName:     z.string().max(100).nullable().optional(),
  savedPhone:    z.string().max(20).nullable().optional(),
  savedAddress:  z.string().max(500).nullable().optional(),
  savedDistrict: z.string().max(100).nullable().optional(),
  savedProvince: z.string().max(100).nullable().optional(),
  savedPostal:   z.string().max(10).nullable().optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      savedName: true,
      savedPhone: true,
      savedAddress: true,
      savedDistrict: true,
      savedProvince: true,
      savedPostal: true,
    },
  })

  return NextResponse.json({
    savedName: user?.savedName ?? null,
    savedPhone: user?.savedPhone ?? null,
    savedAddress: user?.savedAddress ?? null,
    savedDistrict: user?.savedDistrict ?? null,
    savedProvince: user?.savedProvince ?? null,
    savedPostal: user?.savedPostal ?? null,
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = addressSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { savedName, savedPhone, savedAddress, savedDistrict, savedProvince, savedPostal } = parsed.data

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      savedName:     savedName     ?? null,
      savedPhone:    savedPhone    ?? null,
      savedAddress:  savedAddress  ?? null,
      savedDistrict: savedDistrict ?? null,
      savedProvince: savedProvince ?? null,
      savedPostal:   savedPostal   ?? null,
    },
    select: {
      savedName: true,
      savedPhone: true,
      savedAddress: true,
      savedDistrict: true,
      savedProvince: true,
      savedPostal: true,
    },
  })

  return NextResponse.json(user)
}
