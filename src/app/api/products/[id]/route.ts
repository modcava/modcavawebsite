import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id, isActive: true },
    include: { category: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data: product })
}
