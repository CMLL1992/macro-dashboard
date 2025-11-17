export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { fetchFredSeries } from '@/lib/fred'
import { getLastIngestAt, getLastWarmupResult } from '@/lib/db/upsert'

export async function GET() {
  try {
    const t = await fetchFredSeries('T10Y2Y', { frequency: 'd' })
    const u = await fetchFredSeries('UNRATE', { frequency: 'm' })
    const g = await fetchFredSeries('GDPC1', { frequency: 'q' })

    // Get last ingest timestamp and warmup result
    const lastIngestAt = getLastIngestAt('warmup')
    const lastWarmupResult = getLastWarmupResult()

    return Response.json({
      t10y2y_last: t.at(-1),
      unrate_last: u.at(-1),
      gdpc1_len: g.length,
      lastIngestAt,
      lastWarmupResult,
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message }), { status: 500 })
  }
}


