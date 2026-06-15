import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Providers } from './providers'
import { ManaSymbols } from '@/components/shop/ManaSymbols'
import { MessengerButton } from '@/components/layout/MessengerButton'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-lora',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: { template: '%s | MOCAVA', default: 'MOCAVA — TCG & Hobby Store' },
  description: 'Premium TCG singles, sealed products and miniature painting supplies. MTG, Riftbound, Citadel, Vallejo.',
  keywords: ['MTG', 'Magic the Gathering', 'Riftbound', 'TCG', 'single cards', 'miniature painting'],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="en" data-lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--paper)', color: 'var(--ink)', minHeight: '100vh' }}>
        <ManaSymbols />
        <Providers session={session}>
          {children}
        </Providers>

        <MessengerButton />
      </body>
    </html>
  )
}
