/**
 * Debug endpoint: Test Eurostat queries
 * GET /api/debug/eurostat-test?dataset=sts_trtu_m&geo=EA20&freq=M&unit=I15&s_adj=SA&nace_r2=G47
 * 
 * Allows testing Eurostat queries with different parameters
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchEurostatSeries } from '@/lib/datasources/eurostat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dataset = searchParams.get('dataset') || 'sts_trtu_m'
    const geo = searchParams.get('geo') || 'EA20'
    const freq = searchParams.get('freq') || 'M'
    
    // Build filters from query params
    const filters: Record<string, string> = {}
    if (freq) filters.freq = freq
    if (searchParams.get('unit')) filters.unit = searchParams.get('unit')!
    if (searchParams.get('s_adj')) filters.s_adj = searchParams.get('s_adj')!
    if (searchParams.get('nace_r2')) filters.nace_r2 = searchParams.get('nace_r2')!
    if (searchParams.get('na_item')) filters.na_item = searchParams.get('na_item')!

    const result = await fetchEurostatSeries({
      dataset,
      filters,
      geo,
      frequency: freq as any,
    })

    return NextResponse.json({
      success: true,
      dataset,
      geo,
      filters,
      result: {
        id: result.id,
        name: result.name,
        dataPoints: result.data.length,
        firstDate: result.data[0]?.date,
        lastDate: result.data[result.data.length - 1]?.date,
        firstValue: result.data[0]?.value,
        lastValue: result.data[result.data.length - 1]?.value,
        meta: result.meta,
      },
      sampleData: result.data.slice(-5), // Last 5 points
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
