/**
 * DBnomics macro endpoint
 * GET /api/macro/dbnomics?provider=FRED&series=GDPC1
 * Note: DBnomics uses format provider/series (no separate dataset parameter)
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchDBnomicsSeries } from '@/lib/datasources/dbnomics'

const DEFAULT_PROVIDER = 'FRED'
const DEFAULT_SERIES = 'GDPC1'
const REVALIDATE_HOURS = 6

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const provider = searchParams.get('provider') || DEFAULT_PROVIDER
  const series = searchParams.get('series') || DEFAULT_SERIES

  // Validation: provider and series must be alphanumeric with dots/dashes
  const alphanumericPattern = /^[A-Z0-9._-]+$/i
  if (!alphanumericPattern.test(provider)) {
    return NextResponse.json(
      { error: 'Invalid provider code. Must be alphanumeric with dots, dashes, or underscores' },
      { status: 400 }
    )
  }
  if (!alphanumericPattern.test(series)) {
    return NextResponse.json(
      { error: 'Invalid series code. Must be alphanumeric with dots, dashes, or underscores' },
      { status: 400 }
    )
  }

  try {
    const seriesData = await fetchDBnomicsSeries({
      provider,
      series,
    })

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'DBNOMICS',
      url: request.url,
      durationMs,
      points: seriesData.data.length,
      status: 'success',
    }))

    return NextResponse.json(seriesData, {
      headers: {
        'Cache-Control': `s-maxage=${REVALIDATE_HOURS * 3600}`,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(JSON.stringify({
      source: 'DBNOMICS',
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
