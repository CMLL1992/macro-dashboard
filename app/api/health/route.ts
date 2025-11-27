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
import { getDashboardData } from '@/lib/dashboard-data'

export async function GET() {
  try {
    const dashboard = await getDashboardData()
    const items = dashboard.indicators ?? []

    const hasData = items.length > 0

    // Calculate counts from dashboard data
    const observationCount = items.length
    const biasCount = dashboard.tacticalRows?.length ?? 0
    const correlationCount = dashboard.correlations?.count ?? 0
    const latestDate = dashboard.latestDataDate ?? null

    return NextResponse.json({
      ready: hasData,
      hasData,
      observationCount,
      biasCount,
      correlationCount,
      latestDate,
      health: {
        hasObservations: observationCount > 0,
        hasBias: biasCount > 0,
        hasCorrelations: correlationCount > 0,
        observationCount,
        biasCount,
        correlationCount,
        latestDate,
      },
    })
  } catch (error) {
    console.error('[api/health] Error', error)
    return NextResponse.json(
      {
        ready: false,
        hasData: false,
        observationCount: 0,
        biasCount: 0,
        correlationCount: 0,
        latestDate: null,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
