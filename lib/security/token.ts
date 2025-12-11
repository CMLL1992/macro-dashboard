/**
 * Token-based security for job endpoints
 */

import { NextRequest } from 'next/server'

const CRON_TOKEN = (process.env.CRON_TOKEN || '').trim()
const INGEST_KEY = (process.env.INGEST_KEY || '').trim()

/**
 * Validate cron token from request
 * In development, allows requests without token if CRON_TOKEN is not set
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 * Also accepts INGEST_KEY for Scheduled Functions compatibility
 */
export function validateCronToken(request: NextRequest): boolean {
  // FORCE ALLOW in development (localhost) - bypass all token checks
  // This ensures local development works without token issues
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  
  if (isLocalhost && !process.env.VERCEL) {
    console.log('[security] Allowing request from localhost (development mode)')
    return true
  }

  // In production (Vercel), require token
  if (process.env.VERCEL) {
    if ((!CRON_TOKEN || CRON_TOKEN.length === 0) && (!INGEST_KEY || INGEST_KEY.length === 0)) {
      console.log('[security] Rejecting: In Vercel but no CRON_TOKEN or INGEST_KEY configured')
      return false
    }
    
    // Try Authorization header first (Bearer token)
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '').trim()
      // Accept either CRON_TOKEN or INGEST_KEY
      if ((CRON_TOKEN && token === CRON_TOKEN) || (INGEST_KEY && token === INGEST_KEY)) {
        return true
      }
    }
    
    // Try query parameter (Vercel Cron Jobs use ?token=...)
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    if (queryToken) {
      // Accept either CRON_TOKEN or INGEST_KEY
      if ((CRON_TOKEN && queryToken === CRON_TOKEN) || (INGEST_KEY && queryToken === INGEST_KEY)) {
        return true
      }
    }
    
    console.log('[security] Rejecting: Token mismatch or missing')
    return false
  }

  // Default: allow in development
  console.log('[security] Allowing request (development mode, not in Vercel)')
  return true
}

/**
 * Middleware response for unauthorized requests
 */
export function unauthorizedResponse() {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
