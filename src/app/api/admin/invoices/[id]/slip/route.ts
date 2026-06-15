import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// POST /api/admin/invoices/[id]/slip — upload payment slip
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, select: { id: true, invoiceNumber: true } })
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('slip') as File | null
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type))
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)' }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 5MB' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const filename = `inv-${invoice.invoiceNumber}-${Date.now()}.${ext}`
  const slipsDir = path.join(process.cwd(), 'public', 'slips')
  await mkdir(slipsDir, { recursive: true })
  await writeFile(path.join(slipsDir, filename), Buffer.from(await file.arrayBuffer()))

  const slipUrl = `/slips/${filename}`
  await prisma.invoice.update({ where: { id: params.id }, data: { slipUrl } })

  return NextResponse.json({ slipUrl })
}

// DELETE /api/admin/invoices/[id]/slip — remove slip
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  await prisma.invoice.update({ where: { id: params.id }, data: { slipUrl: null } })
  return NextResponse.json({ success: true })
}
