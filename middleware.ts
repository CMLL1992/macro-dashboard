/**
 * Middleware for rate limiting and observability
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60 // 60 requests per minute

function getClientId(request: NextRequest): string {
  // Use IP address as client identifier
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown'
  return ip
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(clientId)

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitMap.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return true
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  record.count++
  return true
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Apply rate limiting to /api/macro/* endpoints
  if (pathname.startsWith('/api/macro/')) {
    const clientId = getClientId(request)
    const allowed = checkRateLimit(clientId)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 60 requests per minute.' },
        { status: 429 }
      )
    }
  }

  // Apply rate limiting to ingest endpoints (60 req/min per IP)
  if (pathname === '/api/news/insert' || pathname === '/api/calendar/insert') {
    const clientId = getClientId(request)
    const allowed = checkRateLimit(clientId)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 60 requests per minute per IP.' },
        { status: 429 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/macro/:path*', '/api/news/insert', '/api/calendar/insert'],
}




