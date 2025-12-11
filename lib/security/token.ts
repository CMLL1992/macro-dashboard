/**
 * Token-based security for job endpoints
 * Supports Vercel CRON_SECRET (automatically added by Vercel crons),
 * INGEST_KEY, and CRON_TOKEN for backward compatibility
 */

import { NextRequest } from 'next/server'

/**
 * Validate cron token from request
 * In development, allows requests without token if no tokens are configured
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 * Accepts CRON_SECRET (Vercel official), INGEST_KEY, or CRON_TOKEN
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
    // Get authorization header (case-insensitive)
    const auth = request.headers.get('authorization') ?? request.headers.get('Authorization')
    
    // Build valid tokens list
    const validTokens = [
      process.env.CRON_SECRET && `Bearer ${process.env.CRON_SECRET}`,
      process.env.INGEST_KEY && `Bearer ${process.env.INGEST_KEY}`,
      process.env.CRON_TOKEN && `Bearer ${process.env.CRON_TOKEN}`,
    ].filter(Boolean) as string[]

    if (validTokens.length === 0) {
      console.log('[security] Rejecting: In Vercel but no CRON_SECRET, INGEST_KEY, or CRON_TOKEN configured')
      return false
    }

    // Check Authorization header (Vercel crons automatically add Authorization: Bearer ${CRON_SECRET})
    if (auth) {
      // Normalize: ensure Bearer prefix and trim
      const normalized = auth.trim()
      if (validTokens.includes(normalized)) {
        return true
      }
    }
    
    // Try query parameter (fallback for manual triggers)
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    if (queryToken) {
      const fullAuth = `Bearer ${queryToken}`
      if (validTokens.includes(fullAuth)) {
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
