/**
 * Verificación de autenticación para cron jobs
 * Compatible con NextRequest y Request estándar
 * Supports both Authorization header and query parameter (for Vercel Cron Jobs)
 * Accepts CRON_SECRET (Vercel official), INGEST_KEY, or CRON_TOKEN
 */

export function assertCronAuth(req: Request | { headers: Headers; url?: string }): void {
  const headers = 'headers' in req ? req.headers : (req as any).headers
  
  const CRON_SECRET = process.env.CRON_SECRET
  const INGEST_KEY = process.env.INGEST_KEY
  const CRON_TOKEN = process.env.CRON_TOKEN

  // Build valid tokens list
  const validTokens: string[] = []
  if (CRON_SECRET) validTokens.push(`Bearer ${CRON_SECRET}`)
  if (INGEST_KEY) validTokens.push(`Bearer ${INGEST_KEY}`)
  if (CRON_TOKEN) validTokens.push(`Bearer ${CRON_TOKEN}`)

  if (validTokens.length === 0) {
    throw new Error('CRON_SECRET, INGEST_KEY, or CRON_TOKEN must be configured')
  }

  // Try Authorization header (Vercel crons automatically add Authorization: Bearer ${CRON_SECRET})
  const authHeader = headers.get('authorization') || headers.get('Authorization')
  if (authHeader) {
    // Normalize: remove leading/trailing whitespace and ensure Bearer prefix
    const normalized = authHeader.trim()
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

