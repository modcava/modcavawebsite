'use client'
import { useState } from 'react'
import { ProfileEditModal } from './ProfileEditModal'

interface Props {
  name: string
  phone?: string
}

export function ProfileEditButton({ name, phone }: Props) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(name)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 12px',
          border: '1.5px solid var(--divider)',
          borderRadius: 99, background: 'none',
          color: 'var(--ink-2)', fontSize: '.72rem', fontWeight: 600,
          cursor: 'pointer', transition: 'all .18s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--sienna)'
          e.currentTarget.style.color = 'var(--sienna)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--divider)'
          e.currentTarget.style.color = 'var(--ink-2)'
        }}
      >
        ✏️ แก้ไขโปรไฟล์
      </button>

      <ProfileEditModal
        open={open}
        onClose={() => setOpen(false)}
        initialName={displayName}
        initialPhone={phone}
        onSaved={(newName) => setDisplayName(newName)}
      />
    </>
  )
}
