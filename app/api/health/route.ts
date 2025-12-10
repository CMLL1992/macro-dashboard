/**
 * Health check endpoint
 * Returns the current state of data in the database
 * 
 * Uses the same logic as /api/dashboard to ensure consistency
 * If /api/dashboard has data, /api/health should return ready: true
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export async function GET() {
  try {
    const dashboard = await getMacroDiagnosis()

    const items = dashboard?.items ?? []
    const hasData = Array.isArray(items) && items.length > 0

    // Get actual counts from database
    let biasCount = 0
    let correlationCount = 0
    
    try {
      // All methods are async now, so always use await
      const db = getUnifiedDB()
      const biasResult = await db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number } | undefined
      const corrResult = await db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number } | undefined
      biasCount = biasResult?.c || 0
      correlationCount = corrResult?.c || 0
    } catch (dbError) {
      console.warn('[api/health] Error counting bias/correlations:', dbError)
      // Continue with 0 counts if query fails
    }

    const latestDate = dashboard?.lastUpdated ?? null

    // Database configuration info
    const usingTurso = isUsingTurso()
    const dbConfig = {
      type: usingTurso ? 'Turso' : 'SQLite',
      isProduction: process.env.NODE_ENV === 'production',
      isVercel: !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL),
    }

    return NextResponse.json({
      ready: hasData,
      hasData,
      observationCount: items.length,
      biasCount,
      correlationCount,
      latestDate,
      database: dbConfig,
      health: {
        hasObservations: hasData,
        hasBias: biasCount > 0,
        hasCorrelations: correlationCount > 0,
        observationCount: items.length,
        biasCount,
        correlationCount,
        latestDate,
      },
    })
  } catch (err) {
    console.error('[api/health] Error in health check:', err)
    return NextResponse.json(
      {
        ready: false,
        hasData: false,
        observationCount: 0,
        biasCount: 0,
        correlationCount: 0,
        latestDate: null,
        health: {
          hasObservations: false,
          hasBias: false,
          hasCorrelations: false,
          observationCount: 0,
          biasCount: 0,
          correlationCount: 0,
          latestDate: null,
        },
        error: String(err),
      },
      { status: 200 } // ⚠️ siempre 200, para no bloquear por statusCode
    )
  }
}
