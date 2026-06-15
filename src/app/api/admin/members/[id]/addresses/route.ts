import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const addresses = await prisma.address.findMany({
    where: { userId: params.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ data: addresses })
}
