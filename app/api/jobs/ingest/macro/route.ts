/**
 * Job: Ingest macro data
 * POST /api/jobs/ingest/macro
 * Protected by CRON_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { upsertMacroSeries } from '@/lib/db/upsert'
import { logger } from '@/lib/obs/logger'
import { fetchWorldBankSeries } from '@/lib/datasources/worldbank'
import { fetchIMFSeries } from '@/lib/datasources/imf'
import { fetchECBSeries } from '@/lib/datasources/ecb'
import { getCatalogParams } from '@/lib/catalog'
import type { CatalogIndicator } from '@/lib/catalog'

/**
 * Lista curada de indicadores de alto impacto (16 principales)
 * Solo se ingieren estos indicadores para minimizar ruido estadístico
 * 
 * Nota: Los indicadores de FRED (CPI, GDP, NFP, etc.) se obtienen directamente desde FRED
 * y no requieren ingesta a través de este job. Este job solo ingiere indicadores
 * de fuentes externas (World Bank, IMF, ECB) que son parte de los 16 curados.
 */
const CATALOG_INDICATORS: Array<{
  indicator: CatalogIndicator
  source: 'WORLD_BANK' | 'IMF' | 'ECB_SDW'
  country?: string
}> = [
  // Sector externo (2 indicadores de los 16 curados)
  { indicator: 'CURRENT_ACCOUNT_USD', source: 'WORLD_BANK', country: 'USA' },
  // TRADE_BALANCE_USD requiere derivación (EXPORTS - IMPORTS)
  // Se ingieren los componentes base para poder derivar
  { indicator: 'EXPORTS_GS_USD', source: 'WORLD_BANK', country: 'USA' },
  { indicator: 'IMPORTS_GS_USD', source: 'WORLD_BANK', country: 'USA' },
]

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_macro'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting macro data ingestion', { job: jobId })

    let ingested = 0
    let errors = 0

    for (const item of CATALOG_INDICATORS) {
      try {
        const params = getCatalogParams(
          item.indicator,
          item.source,
          item.country
        )

        if (!params) {
          logger.warn(`No params for ${item.indicator} from ${item.source}`, {
            job: jobId,
          })
          continue
        }

        let series
        switch (item.source) {
          case 'WORLD_BANK':
            series = await fetchWorldBankSeries(params as any)
            break
          case 'IMF':
            series = await fetchIMFSeries(params as any)
            break
          case 'ECB_SDW':
            series = await fetchECBSeries(params as any)
            break
        }

        await upsertMacroSeries(series)
        ingested++

        logger.info(`Ingested ${series.id}`, {
          job: jobId,
          series_id: series.id,
          points: series.data.length,
        })
      } catch (error) {
        errors++
        logger.error(`Failed to ingest ${item.indicator}`, {
          job: jobId,
          indicator: item.indicator,
          source: item.source,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const finishedAt = new Date().toISOString()

    logger.info('Macro ingestion completed', {
      job: jobId,
      ingested,
      errors,
    })

    return NextResponse.json({
      success: true,
      ingested,
      errors,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Macro ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}



