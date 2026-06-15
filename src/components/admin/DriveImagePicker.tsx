'use client'
import { useCallback, useState } from 'react'

const API_KEY   = process.env.NEXT_PUBLIC_GOOGLE_API_KEY   ?? ''
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''
const SCOPE     = 'https://www.googleapis.com/auth/drive.readonly'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi:   any
    google: any
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const el = document.createElement('script')
    el.src     = src
    el.async   = true
    el.onload  = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
}

interface Props {
  onSelect: (url: string) => void
  disabled?: boolean
}

export function DriveImagePicker({ onSelect, disabled }: Props) {
  const [loading, setLoading] = useState(false)

  const openPicker = useCallback(async () => {
    if (!API_KEY || !CLIENT_ID) {
      alert(
        'Google Drive Picker ยังไม่ได้ตั้งค่า\n\n' +
        'กรุณาเพิ่มใน .env.local:\n' +
        'NEXT_PUBLIC_GOOGLE_API_KEY=<Picker API key>\n' +
        'NEXT_PUBLIC_GOOGLE_CLIENT_ID=<OAuth 2.0 Client ID>'
      )
      return
    }

    setLoading(true)
    try {
      // Load Google API script + GSI in parallel
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js'),
        loadScript('https://accounts.google.com/gsi/client'),
      ])

      // Load the Picker module from gapi
      await new Promise<void>((res) => window.gapi.load('picker', { callback: res }))

      // ── Request OAuth token ───────────────────────────────
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope:     SCOPE,
        callback:  (tokenResponse: { access_token?: string; error?: string }) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            setLoading(false)
            return
          }

          // ── Build the Picker ─────────────────────────────
          const view = new window.google.picker.DocsView()
            .setIncludeFolders(false)
            .setMimeTypes('image/jpeg,image/jpg,image/png,image/webp,image/gif')

          const picker = new window.google.picker.PickerBuilder()
            .setOAuthToken(tokenResponse.access_token)
            .setDeveloperKey(API_KEY)
            .addView(view)
            .setCallback((data: { action: string; docs?: Array<{ id: string; name: string }> }) => {
              if (data.action === 'picked' && data.docs?.[0]) {
                const fileId = data.docs[0].id
                // Construct direct-access URL — file must be shared publicly in Drive
                const url = `https://drive.google.com/uc?export=view&id=${fileId}`
                onSelect(url)
              }
              // Reset loading when the picker closes (either pick or cancel)
              if (data.action === 'picked' || data.action === 'cancel') {
                setLoading(false)
              }
            })
            .build()

          picker.setVisible(true)
        },
      })

      // Silently reuse existing token; shows consent screen only on first use
      tokenClient.requestAccessToken({ prompt: '' })
    } catch (err) {
      console.error('[DriveImagePicker]', err)
      setLoading(false)
    }
  }, [onSelect])

  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={disabled || loading}
      title="เลือกรูปภาพจาก Google Drive"
      className="shrink-0 h-9 px-3 rounded border border-blue-300 bg-white text-warm-400 text-xs hover:bg-blue-50 hover:text-blue-600 hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
    >
      {loading
        ? <span className="inline-block animate-spin leading-none">⏳</span>
        : '📁 Drive'}
    </button>
  )
}
