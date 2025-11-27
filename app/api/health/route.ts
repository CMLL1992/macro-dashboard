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

export async function GET() {
  try {
    const dashboard = await getMacroDiagnosis()

    const items = dashboard?.items ?? []
    const hasData = Array.isArray(items) && items.length > 0

    // getMacroDiagnosis doesn't return tacticalRows or correlations
    // These would need to come from getDashboardData() if needed
    // For now, we'll use items.length as the main indicator
    const biasCount = 0 // Not available from getMacroDiagnosis
    const correlationCount = 0 // Not available from getMacroDiagnosis

    const latestDate = dashboard?.lastUpdated ?? null

    return NextResponse.json({
      ready: hasData,
      hasData,
      observationCount: items.length,
      biasCount,
      correlationCount,
      latestDate,
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
