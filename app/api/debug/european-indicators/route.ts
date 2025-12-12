/**
 * Debug endpoint for European indicators
 * GET /api/debug/european-indicators
 * 
 * Shows the complete flow of European indicator data:
 * 1. Data in database
 * 2. Data from getAllLatestFromDBWithPrev()
 * 3. Data from getMacroDiagnosis()
 * 4. Data in final table
 */

import { NextResponse } from 'next/server'
import { getAllLatestFromDBWithPrev } from '@/lib/db/read-macro'
import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { getBiasState } from '@/domain/macro-engine/bias'
import { getDashboardData } from '@/lib/dashboard-data'
import { getDB } from '@/lib/db/schema'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      steps: {},
    }

    // Step 1: Check data in database
    let dbData: Array<{ series_id: string; count: number; last_date: string }> = []
    try {
      if (isUsingTurso()) {
        const db = getUnifiedDB()
        const rows = await db.prepare(`
          SELECT series_id, COUNT(*) as count, MAX(date) as last_date 
          FROM macro_observations 
          WHERE series_id LIKE 'EU_%' 
          GROUP BY series_id
          ORDER BY series_id
        `).all() as Array<{ series_id: string; count: number; last_date: string }>
        dbData = rows
      } else {
        const db = getDB()
        const rows = db.prepare(`
          SELECT series_id, COUNT(*) as count, MAX(date) as last_date 
          FROM macro_observations 
          WHERE series_id LIKE 'EU_%' 
          GROUP BY series_id
          ORDER BY series_id
        `).all() as Array<{ series_id: string; count: number; last_date: string }>
        dbData = rows
      }
    } catch (error) {
      results.steps.database = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
    results.steps.database = {
      status: 'ok',
      indicators: dbData,
    }

    // Step 2: Check getAllLatestFromDBWithPrev()
    let allLatestData: any[] = []
    try {
      allLatestData = await getAllLatestFromDBWithPrev()
      const euData = allLatestData.filter(d => d.key.startsWith('eu_'))
      results.steps.getAllLatestFromDBWithPrev = {
        status: 'ok',
        totalIndicators: allLatestData.length,
        europeanIndicators: euData.map(d => ({
          key: d.key,
          label: d.label,
          value: d.value,
          value_previous: d.value_previous,
          date: d.date,
          date_previous: d.date_previous,
          unit: d.unit,
          isStale: d.isStale,
        })),
      }
    } catch (error) {
      results.steps.getAllLatestFromDBWithPrev = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // Step 3: Check getMacroDiagnosis()
    let diagnosisData: any = null
    try {
      diagnosisData = await getMacroDiagnosisWithDelta()
      const euItems = diagnosisData.items.filter((item: any) => 
        (item.originalKey ?? item.key ?? '').toString().startsWith('eu_')
      )
      results.steps.getMacroDiagnosis = {
        status: 'ok',
        totalItems: diagnosisData.items.length,
        europeanItems: euItems.map((item: any) => ({
          key: item.key,
          originalKey: item.originalKey,
          label: item.label,
          value: item.value,
          value_previous: item.value_previous,
          date: item.date,
          date_previous: item.date_previous,
          trend: item.trend,
          posture: item.posture,
          weight: item.weight,
          category: item.category,
        })),
      }
    } catch (error) {
      results.steps.getMacroDiagnosis = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // Step 4: Check getBiasState() (final table)
    let biasState: any = null
    try {
      biasState = await getBiasState()
      const euRows = biasState.table.filter((row: any) => 
        (row.originalKey ?? row.key ?? '').toString().startsWith('eu_')
      )
      results.steps.getBiasState = {
        status: 'ok',
        totalRows: biasState.table.length,
        europeanRows: euRows.map((row: any) => ({
          key: row.key,
          originalKey: row.originalKey,
          label: row.label,
          value: row.value,
          value_previous: row.value_previous,
          date: row.date,
          date_previous: row.date_previous,
          trend: row.trend,
          posture: row.posture,
          weight: row.weight,
          category: row.category,
        })),
      }
    } catch (error) {
      results.steps.getBiasState = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // Step 5: Check buildIndicatorRows() output (final dashboard data)
    let dashboardData: any = null
    try {
      dashboardData = await getDashboardData()
      const euIndicatorRows = dashboardData.indicators.filter((row: any) => 
        (row.originalKey ?? row.key ?? '').toString().startsWith('eu_')
      )
      results.steps.buildIndicatorRows = {
        status: 'ok',
        totalRows: dashboardData.indicators.length,
        europeanRows: euIndicatorRows.map((row: any) => ({
          key: row.key,
          originalKey: row.originalKey,
          label: row.label,
          value: row.value,
          previous: row.previous,
          date: row.date,
          category: row.category,
          trend: row.trend,
          posture: row.posture,
        })),
      }
    } catch (error) {
      results.steps.buildIndicatorRows = {
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // Summary
    results.summary = {
      database: {
        total: dbData.length,
        withData: dbData.filter(d => d.count > 0).length,
      },
      getAllLatestFromDBWithPrev: {
        total: allLatestData.filter(d => d.key.startsWith('eu_')).length,
        withValue: allLatestData.filter(d => d.key.startsWith('eu_') && d.value != null).length,
      },
      getMacroDiagnosis: {
        total: diagnosisData?.items?.filter((item: any) => 
          (item.originalKey ?? item.key ?? '').toString().startsWith('eu_')
        ).length || 0,
        withValue: diagnosisData?.items?.filter((item: any) => 
          (item.originalKey ?? item.key ?? '').toString().startsWith('eu_') && item.value != null
        ).length || 0,
      },
      getBiasState: {
        total: biasState?.table?.filter((row: any) => 
          (row.originalKey ?? row.key ?? '').toString().startsWith('eu_')
        ).length || 0,
        withValue: biasState?.table?.filter((row: any) => 
          (row.originalKey ?? row.key ?? '').toString().startsWith('eu_') && row.value != null
        ).length || 0,
      },
      buildIndicatorRows: {
        total: dashboardData?.indicators?.filter((row: any) => 
          (row.originalKey ?? row.key ?? '').toString().startsWith('eu_')
        ).length || 0,
        withValue: dashboardData?.indicators?.filter((row: any) => 
          (row.originalKey ?? row.key ?? '').toString().startsWith('eu_') && row.value != null
        ).length || 0,
      },
    }

    return NextResponse.json(results, {
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
