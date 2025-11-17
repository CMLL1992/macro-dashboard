/**
 * Admin token validation for dashboard settings
 */

import { NextRequest } from 'next/server'

const ADMIN_TOKEN = process.env.DASHBOARD_ADMIN_TOKEN || ''

/**
 * Validate admin token from request
 */
export function validateAdminToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.replace('Bearer ', '')
  return token === ADMIN_TOKEN && ADMIN_TOKEN.length > 0
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







