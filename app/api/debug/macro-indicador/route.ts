import { NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getAllLatestFromDBWithPrev } from '@/lib/db/read-macro'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Debug endpoint to compare raw data between local and Vercel
 * Returns raw database data for a specific indicator (GDP YoY)
 */
export async function GET() {
  try {
    const db = getUnifiedDB()
    
    // Get raw data from macro_series and macro_observations for GDPC1
    const seriesId = 'GDPC1'
    
    // Get series metadata
    const metaStmt = db.prepare('SELECT * FROM macro_series WHERE series_id = ?')
    const metaResult = metaStmt.get(seriesId)
    const seriesMeta = metaResult instanceof Promise ? await metaResult : metaResult
    
    // Get latest 10 observations
    const obsStmt = db.prepare(
      'SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date DESC LIMIT 10'
    )
    const obsResult = obsStmt.all(seriesId)
    const observations = (obsResult instanceof Promise ? await obsResult : obsResult) as any[]
    
    // Get processed data using getAllLatestFromDBWithPrev (same function used by dashboard)
    const processedData = await getAllLatestFromDBWithPrev()
    const gdpYoY = processedData.find(item => item.key === 'gdp_yoy')
    const gdpQoQ = processedData.find(item => item.key === 'gdp_qoq')
    
    return NextResponse.json({
      ok: true,
      env: process.env.NODE_ENV || 'development',
      url: process.env.TURSO_DATABASE_URL || null,
      isTurso: isUsingTurso(),
      seriesId,
      raw: {
        seriesMeta,
        observations: observations.reverse(), // Show oldest to newest
        observationCount: observations.length,
      },
      processed: {
        gdp_yoy: gdpYoY ? {
          key: gdpYoY.key,
          label: gdpYoY.label,
          current: {
            value: gdpYoY.value,
            date: gdpYoY.date,
          },
          previous: {
            value: gdpYoY.value_previous,
            date: gdpYoY.date_previous,
          },
          isStale: gdpYoY.isStale,
        } : null,
        gdp_qoq: gdpQoQ ? {
          key: gdpQoQ.key,
          label: gdpQoQ.label,
          current: {
            value: gdpQoQ.value,
            date: gdpQoQ.date,
          },
          previous: {
            value: gdpQoQ.value_previous,
            date: gdpQoQ.date_previous,
          },
          isStale: gdpQoQ.isStale,
        } : null,
      },
    })
  } catch (error) {
    console.error('[debug/macro-indicador] error', error)
    return NextResponse.json(
      { 
        ok: false, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        env: process.env.NODE_ENV || 'development',
        url: process.env.TURSO_DATABASE_URL || null,
        isTurso: isUsingTurso(),
      },
      { status: 500 }
    )
  }
}

