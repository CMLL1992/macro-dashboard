/**
 * Pipeline status endpoint
 * GET /api/cache/pipeline/status
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Pipeline status simplificado - solo jobs esenciales
    const jobStatus: Record<string, any> = {
      ingest_macro: { status: 'active', note: 'Job esencial para ingesta de datos macro' },
      compute_bias: { status: 'active', note: 'Job esencial para cálculo de sesgos macro' },
      maintenance: { status: 'active', note: 'Job opcional para mantenimiento de BD' },
    }

    return NextResponse.json({ jobs: jobStatus }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Status read error', message: errorMessage },
      { status: 500 }
    )
  }
}

