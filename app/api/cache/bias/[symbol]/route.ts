/**
 * Cached macro bias endpoint
 * GET /api/cache/bias/:symbol
 * Includes expanded narrative (monetary stance, cycle phase, blocks, risks)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getMacroBias } from '@/lib/db/read'
import { buildExpandedNarrative } from '@/lib/bias/expanded'
import { fetchBiasInputs } from '@/lib/bias/inputs'
import universeAssets from '@/config/universe.assets.json'
import type { AssetMeta } from '@/lib/bias/types'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase()

  try {
    const result = getMacroBias(symbol)

    if (!result) {
      return NextResponse.json(
        { error: 'Bias not found in cache' },
        { status: 404 }
      )
    }

    // Get expanded narrative
    const asset = (universeAssets as AssetMeta[]).find((a) => a.symbol === symbol)
    if (asset) {
      try {
        const inputs = await fetchBiasInputs(asset.region)
        const expanded = buildExpandedNarrative(result.bias, inputs)
        return NextResponse.json({
          ...result,
          expanded,
        }, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        })
      } catch (e) {
        // If expanded fails, return basic result
        console.error('Failed to build expanded narrative:', e)
      }
    }

    return NextResponse.json(result, {
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

