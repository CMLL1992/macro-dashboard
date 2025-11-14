/**
 * Derived macro indicators endpoint
 * GET /api/macro/derived?name=TRADE_BALANCE_USD&source=WORLD_BANK&country=USA
 */

import { NextRequest, NextResponse } from 'next/server'
import type { CatalogIndicator, CatalogSource } from '@/lib/catalog'
import {
  getAvailability,
  getDerivation,
  getCatalogParams,
} from '@/lib/catalog'
import { computeSeries, computeTradeBalance, computeCurrentAccountPctGDP } from '@/lib/derive'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import { fetchECBSeries } from '@/lib/datasources/ecb'

const REVALIDATE_HOURS = 6

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const name = searchParams.get('name')
  const source = searchParams.get('source')
  const country = searchParams.get('country')

  // Validation
  if (!name) {
    return NextResponse.json(
      { error: 'Missing required parameter: name' },
      { status: 400 }
    )
  }

  if (!source) {
    return NextResponse.json(
      { error: 'Missing required parameter: source' },
      { status: 400 }
    )
  }

  if (!country) {
    return NextResponse.json(
      { error: 'Missing required parameter: country' },
      { status: 400 }
    )
  }

  // Validate country ISO3
  if (!/^[A-Z]{3}$/.test(country)) {
    return NextResponse.json(
      { error: 'Invalid country code. Must be ISO3 format (e.g., USA, GBR, DEU)' },
      { status: 400 }
    )
  }

  // Validate indicator name
  const indicator = name as CatalogIndicator
  const validIndicators: CatalogIndicator[] = [
    'TRADE_BALANCE_USD',
    'TRADE_BALANCE',
    'CURRENT_ACCOUNT_PCT_GDP',
  ]

  if (!validIndicators.includes(indicator)) {
    return NextResponse.json(
      { error: `Invalid indicator name. Must be one of: ${validIndicators.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate source
  const catalogSource = source as CatalogSource
  const validSources: CatalogSource[] = ['WORLD_BANK', 'IMF', 'ECB_SDW']
  if (!validSources.includes(catalogSource)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    // Check availability
    const availability = getAvailability(indicator, catalogSource)
    if (availability?.status === 'NOT_AVAILABLE_FREE_SOURCE') {
      return NextResponse.json(
        {
          error: 'Indicator not available from free sources',
          availability,
        },
        { status: 404 }
      )
    }

    // Get derivation spec
    const derivation = getDerivation(indicator)

    let series

    // Handle specific derivations
    if (indicator === 'TRADE_BALANCE_USD' || indicator === 'TRADE_BALANCE') {
      series = await computeTradeBalance(catalogSource, country)
    } else if (indicator === 'CURRENT_ACCOUNT_PCT_GDP') {
      series = await computeCurrentAccountPctGDP(catalogSource, country)
    } else if (derivation) {
      // Generic derivation
      series = await computeSeries(derivation, country)
    } else {
      // Try direct fetch if no derivation needed
      const params = getCatalogParams(indicator, catalogSource, country)
      if (!params) {
        return NextResponse.json(
          { error: 'Indicator not available from this source' },
          { status: 404 }
        )
      }

      switch (catalogSource) {
        case 'WORLD_BANK':
          series = await fetchWorldBankSeries(params as any)
          break
        case 'IMF':
          series = await fetchIMFSeries(params as any)
          break
        case 'ECB_SDW':
          series = await fetchECBSeries(params as any)
          break
      }
    }

    const durationMs = Date.now() - startTime
    console.log(JSON.stringify({
      source: 'DERIVED',
      indicator: name,
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
      source: 'DERIVED',
      indicator: name,
      url: request.url,
      durationMs,
      status: 'error',
      error: errorMessage,
    }))

    return NextResponse.json(
      { error: 'Computation error', message: errorMessage },
      { status: 503 }
    )
  }
}







