'use client'
import { useState } from 'react'
import { toast } from 'sonner'

type Member = {
  id: string
  name: string | null
  email: string
  role: string
  points: number
  createdAt: Date | string
  _count: { orders: number }
}

export function MembersTable({ initialUsers }: { initialUsers: Member[] }) {
  const [users, setUsers] = useState<Member[]>(initialUsers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  function startEdit(user: Member) {
    setEditingId(user.id)
    setEditValue(String(user.points))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValue('')
  }

  async function savePoints(userId: string) {
    const newPoints = parseInt(editValue, 10)
    if (isNaN(newPoints) || newPoints < 0) {
      toast.error('แต้มต้องเป็นตัวเลขไม่ติดลบ')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, points: newPoints }),
      })
      if (!res.ok) throw new Error('failed')
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, points: newPoints } : u))
      toast.success('แก้ไขแต้มสำเร็จ')
      cancelEdit()
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--divider)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--divider)', background: 'var(--paper-2)' }}>
            {['ชื่อ', 'อีเมล', 'Role', 'แต้มสะสม', 'ออเดอร์', 'สมัครเมื่อ'].map((h) => (
              <th key={h} style={{
                padding: '10px 18px',
                textAlign: h === 'ชื่อ' || h === 'อีเมล' ? 'left' : 'center',
                fontWeight: 600, color: 'var(--ink-3)',
                fontSize: '.7rem', letterSpacing: '.08em', textTransform: 'uppercase',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => {
            const initials = user.name
              ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
              : '?'
            const dateStr = new Date(user.createdAt).toLocaleDateString('th-TH', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
            const isEditing = editingId === user.id

            return (
              <tr key={user.id} style={{
                borderBottom: i < users.length - 1 ? '1px solid var(--divider)' : 'none',
                background: isEditing ? 'rgba(59,130,246,.08)' : undefined,
                transition: 'background .12s',
              }}>
                {/* Name */}
                <td style={{ padding: '12px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: user.role === 'ADMIN' ? '#3b82f6' : 'var(--paper-3)',
                      color: user.role === 'ADMIN' ? '#fff' : 'var(--ink-3)',
                      fontSize: '.65rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{user.name ?? '—'}</span>
                  </div>
                </td>

                {/* Email */}
                <td style={{ padding: '12px 18px', color: 'var(--ink-2)' }}>{user.email}</td>

                {/* Role */}
                <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px',
                    borderRadius: 99, fontSize: '.68rem', fontWeight: 700,
                    background: user.role === 'ADMIN' ? 'rgba(59,130,246,.08)' : 'var(--paper-3)',
                    color: user.role === 'ADMIN' ? '#3b82f6' : 'var(--ink-3)',
                    border: `1px solid ${user.role === 'ADMIN' ? '#3b82f6' : 'var(--divider)'}`,
                  }}>
                    {user.role}
                  </span>
                </td>

                {/* Points — editable */}
                <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') savePoints(user.id)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                        autoFocus
                        style={{
                          width: 90, padding: '5px 8px',
                          border: '1.5px solid #3b82f6',
                          borderRadius: 'var(--r)', fontSize: '.82rem',
                          fontFamily: "'Lora', serif", fontWeight: 700,
                          color: 'var(--ink)', outline: 'none',
                          background: '#fff', textAlign: 'right',
                        }}
                      />
                      <button
                        onClick={() => savePoints(user.id)}
                        disabled={saving}
                        style={{
                          padding: '5px 10px', background: '#3b82f6', color: '#fff',
                          border: 'none', borderRadius: 'var(--r)',
                          fontSize: '.72rem', fontWeight: 700, cursor: 'pointer',
                          opacity: saving ? .6 : 1,
                        }}
                      >
                        {saving ? '…' : '✓'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{
                          padding: '5px 8px', background: 'none', color: 'var(--ink-3)',
                          border: '1px solid var(--divider)', borderRadius: 'var(--r)',
                          fontSize: '.72rem', cursor: 'pointer',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <span style={{
                        fontFamily: "'Lora', serif", fontWeight: 600,
                        color: user.points > 0 ? '#3b82f6' : 'var(--ink-3)',
                        minWidth: 60, textAlign: 'right', display: 'inline-block',
                      }}>
                        {user.points > 0 ? `⭐ ${user.points.toLocaleString()}` : '—'}
                      </span>
                      <button
                        onClick={() => startEdit(user)}
                        title="แก้ไขแต้ม"
                        style={{
                          padding: '3px 7px', background: 'var(--paper-2)',
                          border: '1px solid var(--divider)', borderRadius: 'var(--r)',
                          fontSize: '.65rem', color: 'var(--ink-3)',
                          cursor: 'pointer', transition: 'all .15s',
                          lineHeight: 1,
                        }}
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </td>

                {/* Orders */}
                <td style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--ink-2)', fontWeight: 600 }}>
                  {user._count.orders > 0 ? user._count.orders : '—'}
                </td>

                {/* Date */}
                <td style={{ padding: '12px 18px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '.78rem' }}>
                  {dateStr}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {users.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: '.85rem' }}>
          ยังไม่มีสมาชิก
        </div>
      )}
    </div>
  )
}
