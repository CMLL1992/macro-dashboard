/**
 * Debug endpoint: Check USA indicators data in DB
 * GET /api/debug/usa-indicators
 */

import { NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getUnifiedDB()
    
    // Check RSAFS (retail_yoy)
    const rsafsResult = isUsingTurso()
      ? await db.prepare('SELECT COUNT(*) as n, MIN(date) as first, MAX(date) as last FROM macro_observations WHERE series_id = ?').get('RSAFS') as { n: number; first: string | null; last: string | null } | null
      : await db.prepare('SELECT COUNT(*) as n, MIN(date) as first, MAX(date) as last FROM macro_observations WHERE series_id = ?').get('RSAFS') as { n: number; first: string | null; last: string | null } | undefined
    
    // Check USPMI (pmi_mfg)
    const uspmiResult = isUsingTurso()
      ? await db.prepare('SELECT COUNT(*) as n, MIN(date) as first, MAX(date) as last FROM macro_observations WHERE series_id = ?').get('USPMI') as { n: number; first: string | null; last: string | null } | null
      : await db.prepare('SELECT COUNT(*) as n, MIN(date) as first, MAX(date) as last FROM macro_observations WHERE series_id = ?').get('USPMI') as { n: number; first: string | null; last: string | null } | undefined
    
    // Get latest values
    const rsafsLatest = isUsingTurso()
      ? await db.prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5').all('RSAFS') as Array<{ date: string; value: number }>
      : await db.prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5').all('RSAFS') as Array<{ date: string; value: number }>
    
    const uspmiLatest = isUsingTurso()
      ? await db.prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5').all('USPMI') as Array<{ date: string; value: number }>
      : await db.prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5').all('USPMI') as Array<{ date: string; value: number }>
    
    return NextResponse.json({
      RSAFS: {
        count: rsafsResult?.n ?? 0,
        firstDate: rsafsResult?.first ?? null,
        lastDate: rsafsResult?.last ?? null,
        latestValues: rsafsLatest,
      },
      USPMI: {
        count: uspmiResult?.n ?? 0,
        firstDate: uspmiResult?.first ?? null,
        lastDate: uspmiResult?.last ?? null,
        latestValues: uspmiLatest,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
