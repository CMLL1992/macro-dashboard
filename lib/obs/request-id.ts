/**
 * Request ID generation and correlation
 * 
 * Generates unique request IDs for API routes to enable log correlation
 * Usage:
 *   const requestId = generateRequestId()
 *   logger.info('api.request', { requestId, route: '/api/...' })
 */

/**
 * Generate a unique request ID
 * Format: timestamp-random (e.g., "1704067200000-a1b2c3d4")
 */
export function generateRequestId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}`
}

/**
 * Generate a run ID for jobs
 * Format: timestamp-random (same as requestId but semantically different)
 */
export function generateRunId(): string {
  return generateRequestId()
}

/**
 * Extract request ID from request headers (if present)
 * Falls back to generating a new one
 */
export function getOrGenerateRequestId(request?: Request | { headers?: Headers }): string {
  if (request && 'headers' in request && request.headers) {
    const existingId = request.headers.get('x-request-id') || 
                      request.headers.get('x-correlation-id') ||
                      request.headers.get('request-id')
    if (existingId) {
      return existingId
    }
  }
  return generateRequestId()
}

