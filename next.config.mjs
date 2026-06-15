/** @type {import('next').NextConfig} */

// ── Security headers applied to every response ─────────────────
// References:
//   https://owasp.org/www-project-secure-headers/
//   https://nextjs.org/docs/app/api-reference/next-config-js/headers
const securityHeaders = [
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
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
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
