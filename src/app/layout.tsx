import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Providers } from './providers'
import { ManaSymbols } from '@/components/shop/ManaSymbols'
import { MessengerButton } from '@/components/layout/MessengerButton'
import { safeJsonLd } from '@/lib/utils'
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://modcava.com'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { template: '%s | Modcava', default: 'Modcava — ร้านการ์ด MTG Riftbound และอุปกรณ์ทาสีโมเดล' },
  description: 'ร้านขายการ์ด MTG, Riftbound, การ์ด TCG, สินค้า Sealed และอุปกรณ์ทาสีโมเดล Citadel, Vallejo ในขอนแก่น สั่งออนไลน์ได้ทั่วประเทศ',
  keywords: [
    'MTG', 'Magic the Gathering', 'Riftbound', 'TCG', 'การ์ด MTG', 'ซื้อการ์ด MTG',
    'ร้านการ์ด', 'ร้านการ์ดขอนแก่น', 'สี Citadel', 'สี Vallejo', 'ทาสีโมเดล',
    'single card', 'sealed MTG', 'อุปกรณ์ทาสี', 'โมเดล', 'Warhammer',
  ],
  openGraph: {
    type: 'website',
    url: APP_URL,
    siteName: 'Modcava',
    title: 'Modcava — ร้านการ์ด MTG Riftbound และอุปกรณ์ทาสีโมเดล',
    description: 'ร้านขายการ์ด MTG, Riftbound, TCG และอุปกรณ์ทาสีโมเดล Citadel, Vallejo ในขอนแก่น',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Modcava' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Modcava — ร้านการ์ด MTG Riftbound และอุปกรณ์ทาสีโมเดล',
    description: 'ร้านขายการ์ด MTG, Riftbound, TCG และอุปกรณ์ทาสีโมเดล Citadel, Vallejo ในขอนแก่น',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Modcava' }],
  },
  alternates: { canonical: APP_URL },
  robots: { index: true, follow: true },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="th" data-lang="en" className={`${inter.variable} ${lora.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'Store',
          name: 'Modcava',
          url: APP_URL,
          logo: `${APP_URL}/logo.png`,
          description: 'ร้านขายการ์ด MTG, Riftbound, TCG และอุปกรณ์ทาสีโมเดล Citadel, Vallejo',
          address: { '@type': 'PostalAddress', addressLocality: 'ขอนแก่น', addressCountry: 'TH' },
          sameAs: ['https://www.facebook.com/Modcavashop'],
        })}} />
      </head>
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
