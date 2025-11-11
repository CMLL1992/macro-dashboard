/**
 * World Bank macro endpoint
 * GET /api/macro/worldbank?country=USA&indicator=FP.CPI.TOTL.ZG
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'

const DEFAULT_COUNTRY = 'USA'
const DEFAULT_INDICATOR = 'FP.CPI.TOTL.ZG'
const REVALIDATE_HOURS = 6

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const country = searchParams.get('country') || DEFAULT_COUNTRY
  const indicator = searchParams.get('indicator') || DEFAULT_INDICATOR

  // Validation: country must be ISO3 [A-Z]{3}
  if (!/^[A-Z]{3}$/.test(country)) {
    return NextResponse.json(
      { error: 'Invalid country code. Must be ISO3 format (e.g., USA, GBR, DEU)' },
      { status: 400 }
    )
  }

  // Validation: indicator must be alphanumeric with dots/dashes
  if (!/^[A-Z0-9._-]+$/i.test(indicator)) {
    return NextResponse.json(
      { error: 'Invalid indicator code. Must be alphanumeric with dots, dashes, or underscores' },
      { status: 400 }
    )
  }

  try {
    const series = await fetchWorldBankSeries({
      countryISO3: country,
      indicatorCode: indicator,
    })

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'WORLD_BANK',
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
      source: 'WORLD_BANK',
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
