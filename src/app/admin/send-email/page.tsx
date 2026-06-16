'use client'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Mail, Send, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SendEmailPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [to,         setTo]         = useState('')
  const [subject,    setSubject]    = useState('')
  const [message,    setMessage]    = useState('')
  const [sending,    setSending]    = useState(false)
  const [lastSent,   setLastSent]   = useState<string | null>(null)

  // ตรวจสอบสถานะ authorize
  useEffect(() => {
    fetch('/api/admin/send-email')
      .then((r) => r.json())
      .then((j) => setAuthorized(j.authorized ?? false))
      .catch(() => setAuthorized(false))
  }, [])

  async function handleSend() {
    if (!to.trim())      { toast.error('กรุณาระบุ Email ผู้รับ'); return }
    if (!subject.trim()) { toast.error('กรุณาระบุ Subject'); return }
    if (!message.trim()) { toast.error('กรุณาพิมพ์ข้อความ'); return }

    setSending(true)
    try {
      const res = await fetch('/api/admin/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to: to.trim(), subject: subject.trim(), message: message.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'ส่งเมลไม่สำเร็จ')
      toast.success('ส่งเมลสำเร็จ!')
      setLastSent(to.trim())
      setTo('')
      setSubject('')
      setMessage('')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'ส่งเมลไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <div className="eyebrow mb-1">Admin</div>
        <h1 className="font-display font-bold text-2xl text-warm-50 flex items-center gap-2">
          <Mail size={22} className="text-blue-600" /> ส่งอีเมล
        </h1>
      </div>

      {/* Auth status */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border mb-6 text-sm',
        authorized === null  && 'bg-slate-50 border-slate-200 text-slate-500',
        authorized === true  && 'bg-green-50 border-green-200 text-green-700',
        authorized === false && 'bg-amber-50 border-amber-200 text-amber-700',
      )}>
        {authorized === null && (
          <><div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
          <span>กำลังตรวจสอบระบบอีเมล…</span></>
        )}
        {authorized === true && (
          <><CheckCircle2 size={18} className="shrink-0" />
          <span className="font-semibold">ระบบอีเมลพร้อมใช้งาน</span>
          <span className="text-green-500">— ส่งเมลได้เลย</span></>
        )}
        {authorized === false && (
          <><AlertCircle size={18} className="shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">ยังไม่ได้ตั้งค่า SMTP</span>
            <span className="ml-1">— ตรวจสอบ SMTP_USER / SMTP_PASS ใน .env แล้ว restart แอป</span>
          </div></>
        )}
      </div>

      {/* Form */}
      <div className="card p-6 space-y-5">
        {/* To */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            ส่งถึง (Email)
          </label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="customer@email.com"
            className="input w-full"
            disabled={sending}
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            หัวข้อ (Subject)
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="เช่น อัปเดตคำสั่งซื้อของคุณ"
            className="input w-full"
            disabled={sending}
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            ข้อความ
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`สวัสดีคุณ [ชื่อลูกค้า],\n\nคำสั่งซื้อของคุณได้รับการยืนยันแล้ว...\n\nขอบคุณที่ใช้บริการ`}
            rows={8}
            className="input w-full resize-y font-mono text-sm"
            disabled={sending}
          />
          <p className="text-[11px] text-slate-400 mt-1">รองรับการขึ้นบรรทัดใหม่ — จะแสดงเป็น HTML email</p>
        </div>

        {/* Preview */}
        {message && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">ตัวอย่าง</div>
            <div
              className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm text-slate-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}
            />
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSend}
            disabled={sending || authorized === false || authorized === null}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all',
              sending || authorized === false || authorized === null
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
            )}
          >
            {sending
              ? <><div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-white animate-spin" /> กำลังส่ง…</>
              : <><Send size={14} /> ส่งเมล</>
            }
          </button>

          {authorized === false && (
            <span className="text-xs text-amber-600">ยังส่งไม่ได้ — ตรวจสอบการตั้งค่า SMTP</span>
          )}
        </div>

        {/* Last sent */}
        {lastSent && (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
            <CheckCircle2 size={14} />
            ส่งเมลไปยัง <strong>{lastSent}</strong> สำเร็จแล้ว
          </div>
        )}
      </div>
    </div>
  )
}
