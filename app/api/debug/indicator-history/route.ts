export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db/schema'

/**
 * Debug endpoint: Verify indicator_history data in production
 * GET /api/debug/indicator-history?key=CPIAUCSL
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')?.toUpperCase()

    const db = getDB()

    if (key) {
      // Single indicator
      const row = db
        .prepare('SELECT * FROM indicator_history WHERE indicator_key = ?')
        .get(key) as any

      return NextResponse.json({
        key,
        found: !!row,
        data: row || null,
      })
    } else {
      // All indicators
      const rows = db
        .prepare('SELECT * FROM indicator_history ORDER BY indicator_key')
        .all() as any[]

      // Sample a few specific indicators
      const samples = ['CPIAUCSL', 'GDPC1', 'T10Y2Y', 'PCEPI', 'CPILFESL']
      const sampleData = samples.map((k) => {
        const row = rows.find((r) => r.indicator_key === k)
        return {
          key: k,
          found: !!row,
          value_current: row?.value_current ?? null,
          value_previous: row?.value_previous ?? null,
          date_current: row?.date_current ?? null,
          date_previous: row?.date_previous ?? null,
        }
      })

      return NextResponse.json({
        total_rows: rows.length,
        samples,
        sample_data: sampleData,
        all_keys: rows.map((r) => r.indicator_key),
      })
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

