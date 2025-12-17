/**
 * Test endpoint to verify yoy() fix
 * GET /api/test/yoy?series_id=CPIAUCSL
 */

import { NextResponse } from 'next/server'
import { getUnifiedDB } from '@/lib/db/unified-db'
import { yoy } from '@/lib/fred'
import type { SeriesPoint } from '@/lib/fred'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const seriesId = searchParams.get('series_id') || 'CPIAUCSL'
  
  try {
    const db = getUnifiedDB()
    
    // Get observations from Turso
    const result = await db.prepare(
      'SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date ASC'
    ).all(seriesId) as Array<{ date: string; value: number }>
    
    if (result.length === 0) {
      return NextResponse.json({
        error: `No observations found for ${seriesId}`,
        seriesId,
        count: 0,
      })
    }
    
    const lastDate = result[result.length - 1]?.date
    const year = lastDate ? parseInt(lastDate.slice(0, 4)) : null
    const month = lastDate ? lastDate.slice(5, 7) : null
    const prevYearDate = year && month ? `${year - 1}-${month}-01` : null
    const prevYearData = prevYearDate 
      ? result.filter(r => r.date.startsWith(`${year! - 1}-${month}`))
      : []
    
    // Convert to SeriesPoint format
    const series: SeriesPoint[] = result.map(r => ({ date: r.date, value: r.value }))
    
    // Test yoy() function
    const yoyResult = yoy(series)
    
    return NextResponse.json({
      seriesId,
      totalObservations: result.length,
      firstDate: result[0]?.date,
      lastDate: result[result.length - 1]?.date,
      lastValue: result[result.length - 1]?.value,
      prevYearDate,
      prevYearDataCount: prevYearData.length,
      prevYearData: prevYearData.slice(0, 3),
      yoyResultsCount: yoyResult.length,
      lastYoY: yoyResult.length > 0 ? {
        date: yoyResult[yoyResult.length - 1]?.date,
        value: yoyResult[yoyResult.length - 1]?.value,
      } : null,
      last3YoY: yoyResult.slice(-3).map(r => ({
        date: r.date,
        value: r.value,
      })),
      debug: {
        last12Months: series.slice(-12).map(p => {
          const yearMonth = p.date.slice(0, 7)
          return {
            originalDate: p.date,
            normalizedMonth: `${yearMonth}-01`,
            value: p.value,
          }
        }),
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      seriesId,
    }, { status: 500 })
  }
}
