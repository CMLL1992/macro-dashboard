export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMacroDiagnosis } from '@/domain/diagnostic'

/**
 * Debug endpoint: Test getMacroDiagnosis() directly
 * GET /api/debug/macro-diagnosis
 */
export async function GET() {
  try {
    const data = await getMacroDiagnosis()

    // Sample a few specific indicators for inspection
    const samples = ['CPIAUCSL', 'GDPC1', 'T10Y2Y', 'PCEPI', 'CPILFESL']
    const sampleItems = data.items
      .filter((item: any) => samples.includes(item.key))
      .map((item: any) => ({
        key: item.key,
        label: item.label,
        value: item.value,
        value_previous: item.value_previous,
        date: item.date,
        date_previous: item.date_previous,
        trend: item.trend,
        posture: item.posture,
        weight: item.weight,
        category: item.category,
        originalKey: item.originalKey,
      }))

    return NextResponse.json({
      regime: data.regime,
      score: data.score,
      total_items: data.items.length,
      items_with_value: data.items.filter((item: any) => item.value != null).length,
      items_with_null_value: data.items.filter((item: any) => item.value == null).length,
      sample_indicators: sampleItems,
      // Full first 3 items for detailed inspection
      first_3_items: data.items.slice(0, 3).map((item: any) => ({
        key: item.key,
        label: item.label,
        value: item.value,
        value_previous: item.value_previous,
        date: item.date,
        date_previous: item.date_previous,
        trend: item.trend,
        posture: item.posture,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

