/** @type {import('next').NextConfig} */

// ── Security headers applied to every response ─────────────────
// References:
//   https://owasp.org/www-project-secure-headers/
//   https://nextjs.org/docs/app/api-reference/next-config-js/headers
const isProd = process.env.NODE_ENV === 'production'

// ── Content-Security-Policy ────────────────────────────────────
// 'unsafe-inline' is required: Next injects inline bootstrap scripts and the app
// uses inline styles + inline JSON-LD (no nonce pipeline yet). The policy still
// adds real value: object-src/base-uri/form-action/frame-ancestors locks, plus a
// connect/img/frame allow-list. Allowances reflect actual usage:
//   • api.scryfall.com   — client-side MTG card import (admin)
//   • *.googleapis.com / accounts.google.com / docs|drive.google.com — Google
//     Drive image picker + OAuth (admin)
// Dev adds 'unsafe-eval' + ws: for Next HMR. If the admin Drive picker ever fails
// in production, add 'unsafe-eval' to script-src.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://apis.google.com https://accounts.google.com https://*.gstatic.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https://api.scryfall.com https://*.googleapis.com https://accounts.google.com${isProd ? '' : ' ws: wss:'}`,
  `frame-src 'self' https://accounts.google.com https://docs.google.com https://drive.google.com`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  // Restrict what the page can load/connect to → defence-in-depth against XSS
  { key: 'Content-Security-Policy', value: csp },

  // Prevent the site from being framed by other origins → blocks clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },

  // Disable MIME-type sniffing — browser must trust the Content-Type we send
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Limit how much referrer info is sent on cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Disable powerful browser features we never use
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()',
  },

  // Let the browser prefetch DNS for outbound links (perf, not security, but standard)
  { key: 'X-DNS-Prefetch-Control', value: 'on' },

  // Force HTTPS for 1 year on production. Skipped in dev so localhost stays usable.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }]
    : []),
]

const nextConfig = {
  images: {
    // Allow-list known image hosts only. (The app renders with plain <img>, so
    // this purely locks down the /_next/image optimizer endpoint — preventing it
    // from being abused as an open image proxy. Add a host here if you start
    // sourcing product images from a new domain.)
    remotePatterns: [
      { protocol: 'https', hostname: 'cards.scryfall.io' },           // MTG cards (Scryfall)
      { protocol: 'https', hostname: 'cmsassets.rgpub.io' },          // Riftbound cards (Riot)
      { protocol: 'https', hostname: 'drive.google.com' },            // Google Drive picker
      { protocol: 'https', hostname: 'drive.usercontent.google.com' },// Drive direct-download redirect
      { protocol: 'https', hostname: '*.googleusercontent.com' },     // Drive image redirect target
    ],
    localPatterns: [
      { pathname: '/uploads/**' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    // Disable client-side router cache for dynamic pages (force-dynamic routes like the shop).
    // Without this, client-side navigation to the shop can serve stale product data for up to
    // 30 seconds after an admin edit, making filters appear broken even after saving new values.
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    return [
      {
        // Apply to every route
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
