export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { fetchFredSeries } from '@/lib/fred'
import { getLastIngestAt, getLastWarmupResult } from '@/lib/db/upsert'
import { isUsingTurso } from '@/lib/db/unified-db'

export async function GET() {
  try {
    const t = await fetchFredSeries('T10Y2Y', { frequency: 'd' })
    const u = await fetchFredSeries('UNRATE', { frequency: 'm' })
    const g = await fetchFredSeries('GDPC1', { frequency: 'q' })

    // Get last ingest timestamp and warmup result
    const lastIngestAt = getLastIngestAt('warmup')
    const lastWarmupResult = getLastWarmupResult()

    // Database configuration info
    const usingTurso = isUsingTurso()
    const dbConfig = {
      type: usingTurso ? 'Turso' : 'SQLite',
      isProduction: process.env.NODE_ENV === 'production',
      isVercel: !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL),
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
    }

    return Response.json({
      t10y2y_last: t.at(-1),
      unrate_last: u.at(-1),
      gdpc1_len: g.length,
      lastIngestAt,
      lastWarmupResult,
      database: dbConfig,
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500 })
  }
}


