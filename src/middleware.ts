import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Admin routes — require ADMIN role
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (token?.role !== 'ADMIN') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        return NextResponse.redirect(new URL('/login?error=forbidden', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Public routes — always allow
        if (
          pathname === '/' ||
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
          pathname.startsWith('/slips')
        ) return true
        // Protected routes — require auth
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
