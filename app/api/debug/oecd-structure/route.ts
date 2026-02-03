/**
 * Debug endpoint to query OECD Structure
 * GET /api/debug/oecd-structure?dataset=MEI
 * Not available in production (404).
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/obs/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const searchParams = request.nextUrl.searchParams
  const dataset = searchParams.get('dataset') || 'MEI'
  const agency = searchParams.get('agency') || 'all'

  const mod = await import('@/lib/datasources/oecd')
  const queryOECDStructure = (mod as any).queryOECDStructure

  if (typeof queryOECDStructure !== 'function') {
    return NextResponse.json(
      { error: 'queryOECDStructure is not exported from lib/datasources/oecd' },
      { status: 500 }
    )
  }

  try {
    const structure = await queryOECDStructure(dataset, agency)

    return NextResponse.json({
      success: true,
      dataset,
      agency,
      structure: {
        dimensions: structure.dimensions,
        codelists: structure.codelists,
        relevantInfo: {
          canadaExists: structure.codelists['LOCATION']?.includes('CAN') ||
            structure.codelists['COUNTRY']?.includes('CAN') ||
            structure.codelists['GEO']?.includes('CAN'),
          cpiCoreCodes: structure.codelists['SUBJECT']?.filter((code: string) =>
            code.includes('CPALTT01') || code.includes('CPI')
          ) || [],
          measureCodes: structure.codelists['MEASURE'] || [],
          frequencyCodes: structure.codelists['FREQUENCY'] || structure.codelists['FREQ'] || [],
        },
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('api.debug.oecd-structure.failed', {
      dataset,
      agency,
      error: errorMsg,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to query OECD structure',
        message: errorMsg,
      },
      { status: 500 }
    )
  }
}
