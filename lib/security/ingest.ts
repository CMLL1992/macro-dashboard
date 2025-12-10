/**
 * Ingest authentication
 * Validates X-INGEST-KEY header for production endpoints
 * 
 * INGEST_KEY is REQUIRED for production. In development, CRON_TOKEN can be used as fallback.
 */

import { NextRequest } from 'next/server'

const INGEST_KEY = process.env.INGEST_KEY || process.env.X_INGEST_KEY || ''
const CRON_TOKEN = process.env.CRON_TOKEN || ''

// Log status on module load
if (typeof window === 'undefined') {
  const isLoaded = Boolean(INGEST_KEY && INGEST_KEY.trim() !== '')
  console.log(`[security] INGEST_KEY loaded: ${isLoaded}`)
  
  if (!isLoaded) {
    console.warn('[security] ⚠️  Warning: INGEST_KEY is missing. All ingest endpoints will reject requests.')
    if (process.env.NODE_ENV === 'production') {
      console.error('[security] ❌ ERROR: INGEST_KEY is REQUIRED in production!')
    }
  }
}

/**
 * Check if INGEST_KEY is configured
 */
export function isIngestKeyConfigured(): boolean {
  return Boolean(INGEST_KEY && INGEST_KEY.trim() !== '')
}

/**
 * Validate ingest key from request header
 */
export function validateIngestKey(request: NextRequest): boolean {
  const providedKey = request.headers.get('X-INGEST-KEY')
  
  if (!providedKey) {
    console.warn('[ingest] Missing X-INGEST-KEY header')
    return false
  }

  // In desarrollo, aceptar también CRON_TOKEN como fallback
  if (
    process.env.NODE_ENV !== 'production' &&
    CRON_TOKEN &&
    providedKey === CRON_TOKEN
  ) {
    return true
  }

  if (isIngestKeyConfigured() && providedKey !== INGEST_KEY) {
    console.warn('[ingest] Invalid X-INGEST-KEY provided')
    return false
  }

  return true
}

/**
 * Get ingest key validation result with error message
 */
export function validateIngestKeyWithError(request: NextRequest): { valid: boolean; error?: string } {
  const providedKey = request.headers.get('X-INGEST-KEY')
  
  if (!providedKey) {
    return { valid: false, error: 'Missing X-INGEST-KEY header' }
  }

  // En desarrollo, aceptar también CRON_TOKEN como fallback
  if (
    process.env.NODE_ENV !== 'production' &&
    CRON_TOKEN &&
    providedKey === CRON_TOKEN
  ) {
    return { valid: true }
  }

  if (isIngestKeyConfigured() && providedKey !== INGEST_KEY) {
    return { valid: false, error: 'Invalid X-INGEST-KEY' }
  }

  return { valid: true }
}

