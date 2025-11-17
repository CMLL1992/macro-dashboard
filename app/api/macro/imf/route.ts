/**
 * IMF macro endpoint
 * GET /api/macro/imf?flow=IFS&key=PCPIPCH.USA.A&freq=A
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import type { Frequency } from '@/lib/types/macro'

const DEFAULT_FLOW = 'IFS'
const DEFAULT_KEY = 'PCPIPCH.USA.A'
const DEFAULT_FREQ: Frequency = 'A'
const REVALIDATE_HOURS = 6

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const flow = searchParams.get('flow') || DEFAULT_FLOW
  const key = searchParams.get('key') || DEFAULT_KEY
  const freqParam = searchParams.get('freq') || DEFAULT_FREQ
  const freq = freqParam as Frequency

  // Validation: freq must be valid Frequency
  if (!['A', 'Q', 'M', 'W', 'D'].includes(freq)) {
    return NextResponse.json(
      { error: 'Invalid frequency. Must be one of: A, Q, M, W, D' },
      { status: 400 }
    )
  }

  try {
    const series = await fetchIMFSeries({
      flow,
      key,
      freq,
    })

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'IMF',
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
      source: 'IMF',
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
