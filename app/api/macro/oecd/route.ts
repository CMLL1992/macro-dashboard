/**
 * OECD macro endpoint
 * GET /api/macro/oecd?dataset=MEI&filter=USA.CPI.TOT.IDX2015.M
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchOECDSeries } from '@/lib/datasources/oecd'

const DEFAULT_DATASET = 'MEI'
const DEFAULT_FILTER = 'USA.CPI.TOT.IDX2015.M'
const REVALIDATE_HOURS = 6

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const dataset = searchParams.get('dataset') || DEFAULT_DATASET
  const filter = searchParams.get('filter') || DEFAULT_FILTER
  const startPeriod = searchParams.get('startPeriod') || undefined
  const endPeriod = searchParams.get('endPeriod') || undefined

  // Validation: dataset must be alphanumeric with dots/dashes
  if (!/^[A-Z0-9._-]+$/i.test(dataset)) {
    return NextResponse.json(
      { error: 'Invalid dataset code. Must be alphanumeric with dots, dashes, or underscores' },
      { status: 400 }
    )
  }

  try {
    const series = await fetchOECDSeries({
      dataset,
      filter,
      startPeriod,
      endPeriod,
    })

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'OECD',
      url: request.url,
      durationMs,
      points: series.data.length,
      status: 'success',
    }))

    return NextResponse.json(series, {
      headers: {
        'Cache-Control': `s-maxage=${REVALIDATE_HOURS * 3600}`,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(JSON.stringify({
      source: 'OECD',
      url: request.url,
      durationMs,
      status: 'error',
      error: errorMessage,
    }))

    return NextResponse.json(
      { error: 'External service error', message: errorMessage },
      { status: 503 }
    )
  }
}
