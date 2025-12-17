/**
 * Debug endpoint: Test Alpha Vantage PMI fetch
 * GET /api/debug/alphavantage-pmi
 */

import { NextResponse } from 'next/server'
import { fetchAlphaVantagePMI } from '@/packages/ingestors/alphavantage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'ALPHA_VANTAGE_API_KEY not configured',
        hasApiKey: false,
      }, { status: 400 })
    }
    
    const observations = await fetchAlphaVantagePMI(apiKey)
    
    return NextResponse.json({
      success: true,
      hasApiKey: true,
      observationsCount: observations.length,
      observations: observations.slice(0, 10), // First 10
      lastObservation: observations[observations.length - 1] || null,
      firstObservation: observations[0] || null,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      hasApiKey: !!process.env.ALPHA_VANTAGE_API_KEY,
    }, { status: 500 })
  }
}
