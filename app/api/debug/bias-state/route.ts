/**
 * Debug endpoint: Check what getBiasState() returns in production
 * GET /api/debug/bias-state
 * 
 * Shows exactly what tactical pairs are in getBiasState().tableTactical
 * Useful for debugging why dashboard shows all pairs instead of just 19
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getBiasState } from '@/domain/macro-engine/bias'
import { TACTICAL_PAIR_SET, getAllowedPairs } from '@/config/tactical-pairs'

export async function GET(request: NextRequest) {
  try {
    const state = await getBiasState()

    const uniqueTacticalPairs = Array.from(
      new Set(
        (state.tableTactical || [])
          .map((r: any) => (r.pair ?? r.symbol ?? '').replace('/', '').toUpperCase())
          .filter((p: string) => p.length > 0)
      )
    ).sort()

    const allowedPairs = getAllowedPairs()

    // Check which pairs are extra (not in allowed list)
    const extraPairs = uniqueTacticalPairs.filter(p => !TACTICAL_PAIR_SET.has(p))
    const missingPairs = allowedPairs.filter(p => !uniqueTacticalPairs.includes(p))

    return NextResponse.json({
      allowedPairs,
      tacticalPairsInState: uniqueTacticalPairs,
      tacticalCount: uniqueTacticalPairs.length,
      allowedCount: allowedPairs.length,
      matches: uniqueTacticalPairs.length === allowedPairs.length && 
                uniqueTacticalPairs.every(p => TACTICAL_PAIR_SET.has(p)),
      extraPairs,
      missingPairs,
      sampleRows: (state.tableTactical || []).slice(0, 5).map((r: any) => ({
        pair: r.pair ?? r.symbol,
        trend: r.trend,
        action: r.action,
        confidence: r.confidence,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


