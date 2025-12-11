/**
 * Verificación de autenticación para cron jobs
 * Compatible con NextRequest y Request estándar
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 * Also accepts INGEST_KEY for Scheduled Functions compatibility
 */

export function assertCronAuth(req: Request | { headers: Headers; url?: string }): void {
  const headers = 'headers' in req ? req.headers : (req as any).headers
  const expectedCronToken = process.env.CRON_TOKEN
  const expectedIngestKey = process.env.INGEST_KEY

  if (!expectedCronToken && !expectedIngestKey) {
    throw new Error('CRON_TOKEN or INGEST_KEY must be configured')
  }

  // Try Authorization header first (Bearer token)
  const authHeader = headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7) // Remove "Bearer "
    // Accept either CRON_TOKEN or INGEST_KEY
    if ((expectedCronToken && token === expectedCronToken) || (expectedIngestKey && token === expectedIngestKey)) {
      return // Valid token in header
    }
  }

  // Try query parameter (Vercel Cron Jobs use ?token=...)
  const url = 'url' in req ? req.url : (req as any).url
  if (url) {
    try {
      const urlObj = new URL(url)
      const queryToken = urlObj.searchParams.get('token')
      if (queryToken) {
        // Accept either CRON_TOKEN or INGEST_KEY
        if ((expectedCronToken && queryToken === expectedCronToken) || (expectedIngestKey && queryToken === expectedIngestKey)) {
          return // Valid token in query parameter
        }
      }
    } catch (e) {
      // URL parsing failed, continue to error
    }
  }

  throw new Error('Missing or invalid CRON_TOKEN/INGEST_KEY (check Authorization header or ?token= query parameter)')
}

