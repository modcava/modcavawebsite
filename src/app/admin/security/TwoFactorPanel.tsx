'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Shield, ShieldCheck, ShieldOff } from 'lucide-react'

interface Props {
  initialEnabled: boolean
  email: string
}

interface SetupData {
  secret: string
  otpauthUrl: string
  qrUrl: string
}

export function TwoFactorPanel({ initialEnabled, email }: Props) {
  const [enabled,  setEnabled]  = useState(initialEnabled)
  const [setup,    setSetup]    = useState<SetupData | null>(null)
  const [code,     setCode]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showDisable, setShowDisable] = useState(false)

  async function startSetup() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/2fa/setup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'เริ่มตั้งค่าไม่สำเร็จ'); return }
      setSetup(data)
    } finally {
      setLoading(false)
    }
  }

  async function confirmEnable() {
    if (!/^\d{6}$/.test(code)) { toast.error('กรุณากรอกรหัส 6 หลัก'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'ยืนยันไม่สำเร็จ'); return }
      toast.success('เปิดใช้งาน 2FA สำเร็จ')
      setEnabled(true)
      setSetup(null)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  async function confirmDisable() {
    if (!/^\d{6}$/.test(code)) { toast.error('กรุณากรอกรหัส 6 หลัก'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'ปิดไม่สำเร็จ'); return }
      toast.success('ปิดใช้งาน 2FA แล้ว')
      setEnabled(false)
      setShowDisable(false)
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded p-5">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
          {enabled ? <ShieldCheck size={20} /> : <Shield size={20} />}
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800">Two-Factor Authentication (2FA)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {enabled
              ? 'เปิดใช้งานอยู่ — login ครั้งถัดไปจะต้องกรอกรหัส 6 หลักจาก authenticator app'
              : 'ป้องกันบัญชีถูกแฮก แม้รหัสผ่านหลุด — แนะนำให้เปิดสำหรับ admin'}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {enabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>

      {/* ── Setup wizard ── */}
      {!enabled && !setup && (
        <button
          onClick={startSetup}
          disabled={loading}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'กำลังโหลด…' : 'เริ่มตั้งค่า 2FA'}
        </button>
      )}

      {!enabled && setup && (
        <div className="space-y-4 mt-2">
          <ol className="text-xs text-slate-600 space-y-1 list-decimal pl-4">
            <li>เปิดแอป authenticator (Google Authenticator, Authy, 1Password, Bitwarden ฯลฯ)</li>
            <li>สแกน QR หรือพิมพ์รหัสด้านล่างเพื่อเพิ่มบัญชี</li>
            <li>กรอกรหัส 6 หลักที่แอปแสดงเพื่อยืนยัน</li>
          </ol>

          {/* QR + secret */}
          <div className="flex gap-4 items-start p-4 bg-slate-50 rounded border border-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrUrl}
              alt="2FA QR code"
              width={180}
              height={180}
              className="bg-white p-2 rounded border border-slate-200 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1">
                ถ้าสแกนไม่ได้ พิมพ์รหัสนี้ในแอป
              </div>
              <code className="block bg-white border border-slate-300 rounded px-3 py-2 text-[11px] font-mono break-all select-all">
                {setup.secret}
              </code>
              <div className="text-[10px] text-slate-400 mt-1">บัญชี: {email}</div>
            </div>
          </div>

          {/* Verify */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสยืนยัน 6 หลัก</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="flex-1 px-3 py-2 border border-slate-300 rounded text-center font-mono tracking-[.4em] text-lg"
              />
              <button
                onClick={confirmEnable}
                disabled={loading || code.length !== 6}
                className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                ยืนยัน
              </button>
              <button
                onClick={() => { setSetup(null); setCode('') }}
                className="px-3 py-2 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-50"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Disable ── */}
      {enabled && !showDisable && (
        <button
          onClick={() => setShowDisable(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded border border-red-300 text-red-600 text-sm font-semibold hover:bg-red-50"
        >
          <ShieldOff size={14} /> ปิดใช้งาน 2FA
        </button>
      )}

      {enabled && showDisable && (
        <div className="space-y-3 mt-2 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-700">
            ⚠️ กรอกรหัสจาก authenticator app เพื่อยืนยันการปิด 2FA
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="flex-1 px-3 py-2 border border-slate-300 rounded text-center font-mono tracking-[.4em] text-lg bg-white"
            />
            <button
              onClick={confirmDisable}
              disabled={loading || code.length !== 6}
              className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              ปิด 2FA
            </button>
            <button
              onClick={() => { setShowDisable(false); setCode('') }}
              className="px-3 py-2 rounded border border-slate-300 text-slate-600 text-sm hover:bg-white"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
