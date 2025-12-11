/**
 * Verificación de autenticación para cron jobs
 * Compatible con NextRequest y Request estándar
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 * Accepts CRON_SECRET (Vercel official), INGEST_KEY, or CRON_TOKEN
 */

export function assertCronAuth(req: Request | { headers: Headers; url?: string }): void {
  const headers = 'headers' in req ? req.headers : (req as any).headers
  
  // Get authorization header (case-insensitive)
  const auth = headers.get('authorization') ?? headers.get('Authorization')
  
  // Build valid tokens list
  const validTokens = [
    process.env.CRON_SECRET && `Bearer ${process.env.CRON_SECRET}`,
    process.env.INGEST_KEY && `Bearer ${process.env.INGEST_KEY}`,
    process.env.CRON_TOKEN && `Bearer ${process.env.CRON_TOKEN}`,
  ].filter(Boolean) as string[]

  if (validTokens.length === 0) {
    throw new Error('CRON_SECRET, INGEST_KEY, or CRON_TOKEN must be configured')
  }

  // Check Authorization header (Vercel crons automatically add Authorization: Bearer ${CRON_SECRET})
  if (auth) {
    // Normalize: ensure Bearer prefix and trim
    const normalized = auth.trim()
    if (validTokens.includes(normalized)) {
      return // Valid token in header
    }
  }

  // Try query parameter (fallback for manual triggers)
  const url = 'url' in req ? req.url : (req as any).url
  if (url) {
    try {
      const urlObj = new URL(url)
      const queryToken = urlObj.searchParams.get('token')
      if (queryToken) {
        const fullAuth = `Bearer ${queryToken}`
        if (validTokens.includes(fullAuth)) {
          return // Valid token in query parameter
        }
      }
    } catch (e) {
      // URL parsing failed, continue to error
    }
  }

  throw new Error('Missing or invalid CRON_SECRET/INGEST_KEY/CRON_TOKEN (check Authorization header or ?token= query parameter)')
}

