'use client'
import { useRef, useState } from 'react'

interface Props {
  onSelect: (url: string) => void
  disabled?: boolean
}

export function LocalImageUploader({ onSelect, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || 'Upload failed')
      onSelect(json.url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || loading}
        title="อัปโหลดรูปภาพเข้า server"
        className="shrink-0 h-9 px-3 rounded border border-blue-300 bg-white text-warm-400 text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
      >
        {loading
          ? <span className="inline-block animate-spin leading-none">⏳</span>
          : '📁 Upload'}
      </button>
    </>
  )
}
