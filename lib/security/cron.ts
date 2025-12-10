/**
 * Verificación de autenticación para cron jobs
 * Compatible con NextRequest y Request estándar
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 */

export function assertCronAuth(req: Request | { headers: Headers; url?: string }): void {
  const headers = 'headers' in req ? req.headers : (req as any).headers
  const expectedToken = process.env.CRON_TOKEN

  if (!expectedToken) {
    throw new Error('CRON_TOKEN not configured')
  }

  // Try Authorization header first (Bearer token)
  const authHeader = headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7) // Remove "Bearer "
    if (token === expectedToken) {
      return // Valid token in header
    }
  }

  // Try query parameter (Vercel Cron Jobs use ?token=...)
  const url = 'url' in req ? req.url : (req as any).url
  if (url) {
    try {
      const urlObj = new URL(url)
      const queryToken = urlObj.searchParams.get('token')
      if (queryToken && queryToken === expectedToken) {
        return // Valid token in query parameter
      }
    } catch (e) {
      // URL parsing failed, continue to error
    }
  }

  throw new Error('Missing or invalid CRON_TOKEN (check Authorization header or ?token= query parameter)')
}

