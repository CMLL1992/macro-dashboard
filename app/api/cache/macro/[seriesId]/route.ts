/**
 * Cached macro series endpoint
 * GET /api/cache/macro/:seriesId
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMacroSeries } from '@/lib/db/read'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { seriesId: string } }
) {
  const seriesId = decodeURIComponent(params.seriesId)

  try {
    const series = getMacroSeries(seriesId)

    if (!series) {
      return NextResponse.json(
        { error: 'Series not found in cache' },
        { status: 404 }
      )
    }

    return NextResponse.json(series, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Cache read error', message: errorMessage },
      { status: 500 }
    )
  }
}

