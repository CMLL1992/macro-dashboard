export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { getBiasRaw } from '@/domain/macro-engine/bias'
import { getBiasState } from '@/domain/macro-engine/bias'

/**
 * Debug endpoint: Trace full chain from getMacroDiagnosis → getBiasState
 * GET /api/debug/bias-chain?key=CPIAUCSL
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const targetKey = searchParams.get('key') || 'CPIAUCSL'

    // Step 1: getMacroDiagnosis()
    const diagnosis = await getMacroDiagnosis()
    const sample1 = diagnosis.items.find((item: any) => item.key === targetKey)

    // Step 2: getMacroDiagnosisWithDelta()
    const diagnosisWithDelta = await getMacroDiagnosisWithDelta()
    const sample2 = diagnosisWithDelta.items.find((item: any) => item.key === targetKey)

    // Step 3: getBiasRaw()
    const biasRaw = await getBiasRaw()
    const sample3 = biasRaw.table.find((item: any) => item.key === targetKey)

    // Step 4: getBiasState()
    const biasState = await getBiasState()
    const sample4 = biasState.table.find((item: any) => item.key === targetKey)

    return NextResponse.json({
      target_key: targetKey,
      per_step_data: {
        step1_getMacroDiagnosis: sample1
          ? {
              key: sample1.key,
              label: sample1.label,
              value: sample1.value,
              value_previous: sample1.value_previous,
              date: sample1.date,
              date_previous: sample1.date_previous,
              trend: sample1.trend,
              posture: sample1.posture,
              weight: sample1.weight,
              category: sample1.category,
              originalKey: sample1.originalKey,
              full_object: sample1,
            }
          : null,
        step2_getMacroDiagnosisWithDelta: sample2
          ? {
              key: sample2.key,
              label: sample2.label,
              value: sample2.value,
              value_previous: sample2.value_previous,
              date: sample2.date,
              date_previous: sample2.date_previous,
              trend: sample2.trend,
              posture: sample2.posture,
              weight: sample2.weight,
              category: sample2.category,
              originalKey: sample2.originalKey,
              full_object: sample2,
            }
          : null,
        step3_getBiasRaw_table: sample3
          ? {
              key: sample3.key,
              label: sample3.label,
              value: sample3.value,
              value_previous: sample3.value_previous,
              date: sample3.date,
              date_previous: sample3.date_previous,
              trend: sample3.trend,
              posture: sample3.posture,
              weight: sample3.weight,
              category: sample3.category,
              originalKey: sample3.originalKey,
              unit: sample3.unit,
              full_object: sample3,
            }
          : null,
        step4_getBiasState_table: sample4
          ? {
              key: sample4.key,
              label: sample4.label,
              value: sample4.value,
              value_previous: sample4.value_previous,
              date: sample4.date,
              date_previous: sample4.date_previous,
              trend: sample4.trend,
              posture: sample4.posture,
              weight: sample4.weight,
              category: sample4.category,
              originalKey: sample4.originalKey,
              unit: sample4.unit,
              full_object: sample4,
            }
          : null,
      },
      summary: {
        step1_total_items: diagnosis.items.length,
        step1_items_with_value: diagnosis.items.filter((item: any) => item.value != null).length,
        step4_total_rows: biasState.table.length,
        step4_rows_with_value: biasState.table.filter((item: any) => item.value != null).length,
        value_lost_between_steps:
          diagnosis.items.filter((item: any) => item.value != null).length -
          biasState.table.filter((item: any) => item.value != null).length,
      },
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

