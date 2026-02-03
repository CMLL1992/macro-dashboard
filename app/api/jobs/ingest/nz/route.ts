/**
 * Job: Ingest New Zealand economic indicators into SQLite
 * POST /api/jobs/ingest/nz
 * Protected by CRON_TOKEN
 * 
 * Ingests all New Zealand indicators (NZD) used by the dashboard
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { env } from '@/lib/env'
import { generateRunId } from '@/lib/obs/request-id'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { resolveIndicatorWithFallback } from '@/lib/datasources/multi-source-resolver'
import fs from 'node:fs'
import path from 'node:path'

// Load NZ indicators config
function loadNZIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'nz-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load nz-indicators.json', { error })
    return { indicators: [] }
  }
}

const NZ_INDICATORS = loadNZIndicators()

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const runId = generateRunId()
  const startTime = Date.now()
  
  // Check for dryRun mode
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  logger.info('job.start', { 
    job: 'ingest/nz', 
    runId, 
    route: '/api/jobs/ingest/nz',
    provider: 'Multi-source (FRED/OECD)',
    country: 'NZ',
    dryRun 
  })

  try {
    type IngestIndicator = {
      id: string
      name?: string
      frequency?: string
      unit?: string
      source?: string
      seriesId?: string
      oecdDataset?: string
      oecdFilter?: string
    }

    let ingested = 0
    let failed = 0
    let notMigrated = 0
    const ingestErrors: Array<{ indicatorId?: string; error: string; errorType?: string; status?: string }> = []
    const dryRunResults: Array<{
      indicatorId: string
      source: string
      status: string
      firstDate?: string
      lastDate?: string
      sample?: Array<{ date: string; value: number | null }>
      url?: string
    }> = []

    const indicators: IngestIndicator[] = NZ_INDICATORS.indicators || []

    // Performance: Process indicators in parallel batches (with rate limiting)
    const BATCH_SIZE = 3
    const batches: IngestIndicator[][] = []
    for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
      batches.push(indicators.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(async (indicator: IngestIndicator) => {
      try {
        let macroSeries: MacroSeries | null = null
        let sourceUsed = 'none'
        let fetchUrl: string | undefined
        let status: 'success' | 'failed' | 'not_migrated' = 'failed'
        let errorEntry: { indicatorId?: string; error: string; errorType?: string; status?: string } | null = null

        // Check if indicator is still using TradingEconomics (not migrated)
        const isNotMigrated = indicator.source === 'trading_economics' && 
                              !indicator.seriesId && 
                              !indicator.oecdDataset && 
                              !indicator.oecdFilter

        if (isNotMigrated) {
          status = 'not_migrated'
          errorEntry = { 
            indicatorId: indicator.id, 
            error: 'Indicator not migrated to FRED/OECD yet',
            errorType: 'not_migrated',
            status: 'not_migrated'
          }
          if (dryRun) {
            return {
              indicator,
              macroSeries: null,
              sourceUsed: 'none',
              status: 'not_migrated',
              errorEntry,
              dryRunResult: {
                indicatorId: indicator.id,
                source: indicator.source || 'unknown',
                status: 'not_migrated',
              }
            }
          }
          return { indicator, macroSeries: null, sourceUsed: 'none', status, errorEntry, dryRunResult: null }
        }

        // Determine if transformation is needed (YoY/QoQ from level series)
        let needsTransform: 'yoy' | 'qoq' | 'none' = 'none'
        if (indicator.id.includes('_YOY') || indicator.id.includes('_YOY_')) {
          needsTransform = 'yoy'
        } else if (indicator.id.includes('_QOQ') || indicator.id.includes('_QOQ_')) {
          needsTransform = 'qoq'
        }

        // Use multi-source resolver (FRED → OECD → fallback)
        const resolverResult = await resolveIndicatorWithFallback({
          indicatorId: indicator.id,
          indicatorName: indicator.name || indicator.id,
          frequency: indicator.frequency?.toUpperCase() as 'A' | 'Q' | 'M' | 'W' | 'D' | 'B' | undefined,
          unit: indicator.unit,
          fredSeriesId: indicator.seriesId,
          oecdDataset: indicator.oecdDataset,
          oecdFilter: indicator.oecdFilter || indicator.seriesId,
          needsTransform,
        })

        if (resolverResult.success && resolverResult.macroSeries) {
          macroSeries = resolverResult.macroSeries
          sourceUsed = resolverResult.sourceUsed || 'unknown'
          
          logger.info(`Successfully fetched ${indicator.id} from ${sourceUsed}`, {
            job: 'ingest/nz',
            runId,
            indicatorId: indicator.id,
            source: sourceUsed,
            observations: macroSeries.data.length,
            lastUpdated: macroSeries.lastUpdated,
          })
          status = 'success'
        } else {
          const errorMsg = resolverResult.error || 'No data source available or all sources failed'
          logger.warn(`Failed to fetch ${indicator.id}`, {
            job: 'ingest/nz',
            runId,
            indicatorId: indicator.id,
            error: errorMsg,
            errorType: resolverResult.errorType,
          })
          status = 'failed'
          errorEntry = { 
            indicatorId: indicator.id, 
            error: errorMsg,
            errorType: resolverResult.errorType || 'no_data_source',
            status: 'failed'
          }
        }

        if (dryRun && macroSeries) {
          const firstDate = macroSeries.data.length > 0 ? macroSeries.data[0].date : undefined
          const lastDate = macroSeries.data.length > 0 ? macroSeries.data[macroSeries.data.length - 1].date : undefined
          const sample = macroSeries.data.slice(0, 5).map(d => ({ date: d.date, value: d.value }))
          return {
            indicator,
            macroSeries,
            sourceUsed,
            status,
            errorEntry,
            dryRunResult: {
              indicatorId: indicator.id,
              source: sourceUsed,
              status: status === 'success' ? 'success' : 'failed',
              firstDate,
              lastDate,
              sample,
              url: fetchUrl,
            }
          }
        }

        return { indicator, macroSeries, sourceUsed, status, errorEntry, dryRunResult: null }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to ingest ${indicator.id}`, {
          job: 'ingest/nz',
          runId,
          indicatorId: indicator.id,
          error: errorMsg,
        })
        return {
          indicator,
          macroSeries: null,
          sourceUsed: 'none',
          status: 'failed' as const,
          errorEntry: { indicatorId: indicator.id, error: errorMsg, errorType: 'ingest_failed', status: 'failed' },
          dryRunResult: null
        }
      }
      }))

      // Process batch results sequentially to avoid race conditions
      for (const result of batchResults) {
        if (result.status === 'not_migrated') {
          notMigrated++
          if (result.errorEntry) ingestErrors.push(result.errorEntry)
          if (result.dryRunResult) dryRunResults.push(result.dryRunResult)
        } else if (result.status === 'failed') {
          failed++
          if (result.errorEntry) ingestErrors.push(result.errorEntry)
          if (result.dryRunResult) dryRunResults.push(result.dryRunResult)
        } else if (result.status === 'success' && result.macroSeries) {
          if (!dryRun) {
            await upsertMacroSeries(result.macroSeries)
            ingested++
            logger.info(`Ingested ${result.indicator.id}`, {
              job: 'ingest/nz',
              runId,
              indicatorId: result.indicator.id,
              source: result.sourceUsed,
              observations: result.macroSeries.data.length,
              lastUpdated: result.macroSeries.lastUpdated,
            })
          } else {
            ingested++
            if (result.dryRunResult) dryRunResults.push(result.dryRunResult)
          }
        }
      }

      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const duration = Date.now() - startTime

    logger.info('job.complete', {
      job: 'ingest/nz',
      runId,
      durationMs: duration,
      ingested,
      failed,
      notMigrated,
      total: indicators.length,
    })

    return NextResponse.json({
      success: true,
      runId,
      durationMs: duration,
      ingested,
      failed,
      notMigrated,
      total: indicators.length,
      errorDetails: ingestErrors.length > 0 ? ingestErrors : undefined,
      dryRunResults: dryRun ? dryRunResults : undefined,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('job.failed', {
      job: 'ingest/nz',
      runId,
      durationMs: duration,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        success: false,
        runId,
        error: errorMessage,
        durationMs: duration,
      },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}
