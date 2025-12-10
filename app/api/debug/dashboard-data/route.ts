/**
 * Debug endpoint to see exactly what data getDashboardData() returns
 * GET /api/debug/dashboard-data
 */

import { NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/dashboard-data'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await getDashboardData()
    
    // Extract European indicators
    const euIndicators = data.indicators.filter(r => 
      (r.originalKey ?? r.key ?? '').toString().startsWith('eu_')
    )
    
    // Extract indicators in "Precios / Inflación" category
    const inflationIndicators = data.indicators.filter(r => 
      r.category === 'Precios / Inflación'
    )
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      summary: {
        totalIndicators: data.indicators.length,
        europeanIndicators: euIndicators.length,
        inflationCategoryIndicators: inflationIndicators.length,
        europeanWithValue: euIndicators.filter(r => r.value != null).length,
      },
      europeanIndicators: euIndicators.map(r => ({
        key: r.key,
        originalKey: r.originalKey,
        label: r.label,
        value: r.value,
        previous: r.previous,
        category: r.category,
        date: r.date,
        trend: r.trend,
        posture: r.posture,
      })),
      inflationCategoryIndicators: inflationIndicators.map(r => ({
        key: r.key,
        originalKey: r.originalKey,
        label: r.label,
        value: r.value,
        previous: r.previous,
        category: r.category,
        date: r.date,
      })),
      allIndicatorsSample: data.indicators.slice(0, 5).map(r => ({
        key: r.key,
        originalKey: r.originalKey,
        label: r.label,
        category: r.category,
        hasValue: r.value != null,
      })),
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
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
