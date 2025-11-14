/**
 * Token-based security for job endpoints
 */

import { NextRequest } from 'next/server'

const CRON_TOKEN = process.env.CRON_TOKEN || ''

/**
 * Validate cron token from request
 */
export function validateCronToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === CRON_TOKEN && CRON_TOKEN.length > 0
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







