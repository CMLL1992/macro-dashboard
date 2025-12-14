/**
 * Debug endpoint for Eurozone indicators in dashboard
 * GET /api/debug/dashboard-eurozone
 * 
 * Shows exactly what Eurozone data arrives at the dashboard
 */

import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const data = await getDashboardData()

    // Filter European indicators from the indicators array
    const euroIndicators = data.indicators.filter(
      (ind) => ind.section === 'EUROZONA' || ind.key.startsWith('eu_')
    )

    // Group by section for clarity
    const indicatorsBySection = {
      EUROZONA: euroIndicators,
      GLOBAL: data.indicators.filter(
        (ind) => ind.section !== 'EUROZONA' && !ind.key.startsWith('eu_')
      ),
    }

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        euroIndicators: euroIndicators.map((ind) => ({
          key: ind.key,
          label: ind.label,
          value: ind.value,
          previous: ind.previous,
          date: ind.date,
          section: ind.section,
          unit: ind.unit,
          isStale: ind.isStale,
        })),
        indicatorsBySection: {
          EUROZONA: {
            count: euroIndicators.length,
            withValue: euroIndicators.filter((ind) => ind.value != null).length,
            withPrevious: euroIndicators.filter((ind) => ind.previous != null).length,
          },
          GLOBAL: {
            count: indicatorsBySection.GLOBAL.length,
            withValue: indicatorsBySection.GLOBAL.filter((ind) => ind.value != null).length,
            withPrevious: indicatorsBySection.GLOBAL.filter((ind) => ind.previous != null).length,
          },
        },
        summary: {
          totalIndicators: data.indicators.length,
          euroIndicators: euroIndicators.length,
          euroWithValue: euroIndicators.filter((ind) => ind.value != null).length,
          euroWithPrevious: euroIndicators.filter((ind) => ind.previous != null).length,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
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


