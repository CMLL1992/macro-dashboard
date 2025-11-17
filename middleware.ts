import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page and API routes without auth check
  if (
    pathname === '/admin/login' || 
    pathname.startsWith('/admin/login/') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next()
  }

  // For other admin routes, check auth cookie
  if (pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('admin_auth')
    
    if (!authCookie || authCookie.value !== 'authenticated') {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/admin/login', request.url)
      // Preserve the original URL as a query parameter for redirect after login
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
  ],
}
