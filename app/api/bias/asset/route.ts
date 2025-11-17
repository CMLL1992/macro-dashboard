/**
 * Macro Bias endpoint
 * GET /api/bias/asset?symbol=EURUSD
 */

import { NextRequest, NextResponse } from 'next/server'
import { computeMacroBias } from '@/lib/bias'
import type { AssetMeta } from '@/lib/bias/types'
import universeAssets from '@/config/universe.assets.json'

const REVALIDATE_HOURS = 1

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get('symbol')

  // Validation
  if (!symbol) {
    return NextResponse.json(
      { error: 'Missing required parameter: symbol' },
      { status: 400 }
    )
  }

  // Find asset in universe
  const asset = (universeAssets as AssetMeta[]).find(
    (a) => a.symbol === symbol.toUpperCase()
  )

  if (!asset) {
    return NextResponse.json(
      {
        error: `Symbol ${symbol} not found in universe`,
        available: (universeAssets as AssetMeta[]).map((a) => a.symbol),
      },
      { status: 404 }
    )
  }

  try {
    const bias = await computeMacroBias(asset)

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'BIAS',
      symbol,
      durationMs,
      score: bias.score,
      direction: bias.direction,
      confidence: bias.confidence,
      status: 'success',
    }))

    return NextResponse.json(bias, {
      headers: {
        'Cache-Control': `s-maxage=${REVALIDATE_HOURS * 3600}`,
      },
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error(JSON.stringify({
      source: 'BIAS',
      symbol,
      url: request.url,
      durationMs,
      status: 'error',
      error: errorMessage,
    }))

    return NextResponse.json(
      { error: 'Bias calculation error', message: errorMessage },
      { status: 503 }
    )
  }
}







