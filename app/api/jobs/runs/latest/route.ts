/**
 * Get latest run status
 * GET /api/jobs/runs/latest?country=ca
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/obs/logger'
import { getLatestRunStatus } from '@/lib/betaRunStore'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const country = searchParams.get('country')?.toLowerCase()
  const job = country ? `ingest/${country}` : 'ingest/all'

  try {
    // Get from global store
    const run = getLatestRunStatus(country)

    if (run) {
      return NextResponse.json({
        success: true,
        run,
      })
    }

    // If not in store, return empty (no recent run)
    return NextResponse.json({
      success: true,
      run: null,
      message: 'No recent run found',
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('api.jobs.runs.latest.failed', {
      country,
      job,
      error: errorMsg,
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}
