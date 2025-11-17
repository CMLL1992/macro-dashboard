export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { getBiasRaw } from '@/domain/macro-engine/bias'
import { getBiasState } from '@/domain/macro-engine/bias'

/**
 * Debug endpoint: Trace full chain from getMacroDiagnosis → getBiasState
 * GET /api/debug/bias-chain
 */
export async function GET() {
  try {
    // Step 1: getMacroDiagnosis()
    const diagnosis = await getMacroDiagnosis()
    const sample1 = diagnosis.items.find((item: any) => item.key === 'CPIAUCSL')

    // Step 2: getMacroDiagnosisWithDelta()
    const diagnosisWithDelta = await getMacroDiagnosisWithDelta()
    const sample2 = diagnosisWithDelta.items.find((item: any) => item.key === 'CPIAUCSL')

    // Step 3: getBiasRaw()
    const biasRaw = await getBiasRaw()
    const sample3 = biasRaw.table.find((item: any) => item.key === 'CPIAUCSL')

    // Step 4: getBiasState()
    const biasState = await getBiasState()
    const sample4 = biasState.table.find((item: any) => item.key === 'CPIAUCSL')

    return NextResponse.json({
      chain: {
        step1_getMacroDiagnosis: {
          total_items: diagnosis.items.length,
          sample_cpi: sample1
            ? {
                key: sample1.key,
                label: sample1.label,
                value: sample1.value,
                value_previous: sample1.value_previous,
                date: sample1.date,
                date_previous: sample1.date_previous,
              }
            : null,
        },
        step2_getMacroDiagnosisWithDelta: {
          total_items: diagnosisWithDelta.items.length,
          sample_cpi: sample2
            ? {
                key: sample2.key,
                label: sample2.label,
                value: sample2.value,
                value_previous: sample2.value_previous,
                date: sample2.date,
                date_previous: sample2.date_previous,
              }
            : null,
        },
        step3_getBiasRaw: {
          total_table_rows: biasRaw.table.length,
          sample_cpi: sample3
            ? {
                key: sample3.key,
                label: sample3.label,
                value: sample3.value,
                value_previous: sample3.value_previous,
                date: sample3.date,
                date_previous: sample3.date_previous,
              }
            : null,
        },
        step4_getBiasState: {
          total_table_rows: biasState.table.length,
          sample_cpi: sample4
            ? {
                key: sample4.key,
                label: sample4.label,
                value: sample4.value,
                value_previous: sample4.value_previous,
                date: sample4.date,
                date_previous: sample4.date_previous,
              }
            : null,
        },
      },
      summary: {
        'items_with_value_at_step1': diagnosis.items.filter((item: any) => item.value != null).length,
        'items_with_value_at_step4': biasState.table.filter((item: any) => item.value != null).length,
        'value_lost_between_steps': diagnosis.items.filter((item: any) => item.value != null).length -
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

