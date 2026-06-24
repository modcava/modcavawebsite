import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOAuth2Client, saveToken } from '@/lib/gmail'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function page(body: string) {
  return new NextResponse(
    `<html><body style="font-family:sans-serif;padding:40px">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  )
}

// GET /api/admin/gmail-callback — Google redirect กลับมาพร้อม code
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return page(`
      <h2 style="color:#dc2626">Authorization ล้มเหลว</h2>
      <p>${esc(error ?? 'ไม่ได้รับ code จาก Google')}</p>
      <a href="/admin/send-email">กลับหน้าส่งเมล</a>`)
  }

  try {
    const auth = getOAuth2Client()
    const { tokens } = await auth.getToken(code)
    saveToken(tokens)

    return page(`
      <h2 style="color:#16a34a">✓ เชื่อมต่อ Gmail สำเร็จ!</h2>
      <p>Refresh token ถูกบันทึกแล้ว สามารถส่งเมลได้เลย</p>
      <a href="/admin/send-email" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">
        ไปหน้าส่งเมล →
      </a>`)
  } catch (e) {
    console.error('[gmail-callback]', e)
    return page(`
      <h2 style="color:#dc2626">เกิดข้อผิดพลาด</h2>
      <pre>${esc(String(e))}</pre>
      <a href="/admin/send-email">กลับหน้าส่งเมล</a>`)
  }
}
