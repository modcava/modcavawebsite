import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendEmailViaGmail, loadToken } from '@/lib/gmail'
import { logAudit } from '@/lib/audit'

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

// GET — ตรวจสอบว่า authorize แล้วหรือยัง
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const token = loadToken()
  return NextResponse.json({ authorized: !!token?.refresh_token })
}

// POST — ส่งเมล
export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (guard) return guard
  const session = await getServerSession(authOptions)
  const ctx = session?.user
    ? { userId: session.user.id, userEmail: session.user.email ?? '' }
    : null

  const { to, subject, message } = await req.json()

  if (!to || !subject || !message) {
    return NextResponse.json({ error: 'กรุณากรอก to, subject, message' }, { status: 400 })
  }

  // แปลง newline เป็น <br> สำหรับ HTML
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;">
      ${message.replace(/\n/g, '<br/>')}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0"/>
      <p style="color:#9ca3af;font-size:12px;">
        © ${new Date().getFullYear()} ${process.env.NEXT_PUBLIC_APP_NAME ?? 'Modcava'}
      </p>
    </div>
  `

  try {
    const result = await sendEmailViaGmail({ to, subject, html })
    if (ctx) {
      // Log recipient + subject only — never the body (may contain PII)
      await logAudit(ctx, {
        action: 'email.send',
        resource: 'email',
        resourceId: result.id ?? null,
        details: { to, subject },
        req,
      })
    }
    return NextResponse.json({ success: true, messageId: result.id })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'NO_TOKEN') {
      return NextResponse.json(
        { error: 'ยังไม่ได้เชื่อมต่อ Gmail — กด Authorize ก่อน' },
        { status: 401 },
      )
    }
    console.error('[send-email]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'ส่งเมลไม่สำเร็จ' },
      { status: 500 },
    )
  }
}
