import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

// Routes reachable without a session (pages + public API).
function isPublic(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/api/products') ||
    pathname.startsWith('/api/categories') ||
    pathname.startsWith('/api/coupons') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-email') ||
    pathname.startsWith('/slips') ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/uploads/') ||
    pathname.startsWith('/icon/')
  )
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl
    const isApi = pathname.startsWith('/api/')

    // Admin routes — require ADMIN role
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (token?.role !== 'ADMIN') {
        if (isApi) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/login?error=forbidden', req.url))
      }
    }

    // Protected API routes — answer with JSON 401 instead of an HTML redirect to
    // /login (so client `fetch` callers get a parseable error, not a redirect).
    if (isApi && !isPublic(pathname) && !token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Public routes — always allow
        if (isPublic(pathname)) return true
        // Let every API route reach the middleware fn above, which returns JSON
        // errors (401/403) rather than letting withAuth redirect to an HTML page.
        if (pathname.startsWith('/api/')) return true
        // Protected pages — require auth (withAuth redirects to /login if missing)
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|icon|slips|uploads).*)'],
}
