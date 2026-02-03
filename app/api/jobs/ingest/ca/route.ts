/**
 * Job: Ingest Canada economic indicators into SQLite
 * POST /api/jobs/ingest/ca
 * Protected by CRON_TOKEN
 * 
 * Ingests all Canada indicators (CAD) used by the dashboard
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
import { resolveIndicatorFromMultipleSources, resolveIndicatorWithFallback } from '@/lib/datasources/multi-source-resolver'
import { buildJobSummary, logJobSummary, checkAndLogAlerts, type ErrorEntry } from '@/lib/jobs/job-summary'
import fs from 'node:fs'
import path from 'node:path'

// Load CA indicators config
function loadCAIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'ca-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load ca-indicators.json', { error })
    return { indicators: [] }
  }
}

const CA_INDICATORS = loadCAIndicators()

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const runId = generateRunId()
  const startTime = Date.now()
  
  // Check for dryRun mode
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  // Store run status as running
  try {
    const { storeRunStatus } = await import('@/lib/betaRunStore')
    storeRunStatus({
      runId,
      job: 'ingest/ca',
      country: 'CA',
      status: 'running',
      startTime,
    })
  } catch (e) {
    // Ignore if storeRunStatus not available
  }

  logger.info('job.start', { 
    job: 'ingest/ca', 
    runId, 
    route: '/api/jobs/ingest/ca',
    provider: 'Multi-source (FRED/OECD)',
    country: 'CA',
    dryRun
  })

  try {
    let ingested = 0
    let failed = 0
    let notMigrated = 0
    let notAvailable = 0
    const ingestErrors: ErrorEntry[] = []
    const dryRunResults: Array<{
      indicatorId: string
      source: string
      status: string
      firstDate?: string
      lastDate?: string
      sample?: Array<{ date: string; value: number | null }>
      url?: string
    }> = []

    const indicators: Array<{
      id: string
      name?: string
      frequency?: string
      unit?: string
      source?: string
      seriesId?: string
      series?: string
      oecdDataset?: string
      oecdFilter?: string
      availability?: string
      availabilityNote?: string
    }> = CA_INDICATORS.indicators || []

    // Performance: Process indicators in parallel batches (with rate limiting)
    const BATCH_SIZE = 3 // Process 3 indicators at a time to avoid overwhelming APIs
    const batches: Array<typeof indicators> = []
    for (let i = 0; i < indicators.length; i += BATCH_SIZE) {
      batches.push(indicators.slice(i, i + BATCH_SIZE))
    }

    type BatchResult = {
      indicator: (typeof indicators)[number]
      macroSeries: MacroSeries | null
      sourceUsed: string
      status: 'success' | 'failed' | 'not_migrated' | 'not_available'
      errorEntry?: ErrorEntry
      dryRunResult: {
        indicatorId: string
        source: string
        status: string
        firstDate?: string
        lastDate?: string
        sample?: Array<{ date: string; value: number | null }>
        url?: string
      } | null
    }

    let allBatchResults: BatchResult[] = []

    for (const batch of batches) {
      // Process batch in parallel
      const batchResults: BatchResult[] = await Promise.all(batch.map(async (indicator) => {
      try {
        let macroSeries: MacroSeries | null = null
        let sourceUsed = 'none'
        let fetchUrl: string | undefined
        let status: 'success' | 'failed' | 'not_migrated' | 'not_available' = 'failed'
        let errorEntry: ErrorEntry | undefined

        // Check if indicator is marked as not available
        const isNotAvailable = (indicator as any).availability === 'not_available_in_source'
        
        if (isNotAvailable) {
          status = 'not_available'
          errorEntry = {
            indicatorId: indicator.id,
            error: (indicator as any).availabilityNote || 'Indicator not available in configured data sources',
            errorType: 'not_available_in_source',
            status: 'not_available',
          }
          return { indicator, macroSeries: null, sourceUsed: 'none', status, errorEntry, dryRunResult: null }
        }

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
          fredSeriesId: indicator.seriesId || (indicator.source === 'fred' ? indicator.series : undefined),
          oecdDataset: indicator.oecdDataset,
          oecdFilter: indicator.oecdFilter || indicator.seriesId,
          needsTransform,
        })

        if (resolverResult.success && resolverResult.macroSeries) {
          macroSeries = resolverResult.macroSeries
          sourceUsed = resolverResult.sourceUsed || 'unknown'
          
          logger.info(`Successfully fetched ${indicator.id} from ${sourceUsed}`, {
            job: 'ingest/ca',
            runId,
            indicatorId: indicator.id,
            source: sourceUsed,
            observations: macroSeries.data.length,
            lastUpdated: macroSeries.lastUpdated,
          })
          status = 'success'
        } else {
          const errorMsg = resolverResult.error || 'No data source available or all sources failed'
          const errorType = resolverResult.errorType || 'unknown'
          const isNotAvailable = errorType === 'not_available_in_source' || 
                                errorMsg.includes('not available in')
          const isInvalidMapping = errorType === 'invalid_mapping' ||
                                  errorMsg.includes('invalid format') ||
                                  errorMsg.includes('Invalid FRED series ID')
          
          // Log source attempts if available
          const sourceAttempts = resolverResult.sourceAttempts || []
          
          logger.warn(`Failed to fetch ${indicator.id}`, {
            job: 'ingest/ca',
            runId,
            indicatorId: indicator.id,
            error: errorMsg,
            errorType,
            isNotAvailable,
            isInvalidMapping,
            sourceAttempts: sourceAttempts.length > 0 ? sourceAttempts : undefined,
          })
          
          if (isNotAvailable) {
            status = 'not_available'
            errorEntry = { 
              indicatorId: indicator.id, 
              error: errorMsg,
              errorType: 'not_available_in_source',
              status: 'not_available'
            }
          } else if (isInvalidMapping) {
            // Invalid mapping should be reported separately
            status = 'failed'
            errorEntry = { 
              indicatorId: indicator.id, 
              error: errorMsg,
              errorType: 'invalid_mapping',
              status: 'failed'
            }
          } else {
            status = 'failed'
            errorEntry = { 
              indicatorId: indicator.id, 
              error: errorMsg,
              errorType: errorType,
              status: 'failed'
            }
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
          job: 'ingest/ca',
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

      // Acumular resultados de batch
      allBatchResults = allBatchResults.concat(batchResults)

      // Process batch results sequentially to avoid race conditions
      for (const result of batchResults) {
        if (result.status === 'not_migrated') {
          notMigrated++
          if (result.errorEntry) ingestErrors.push(result.errorEntry)
          if (result.dryRunResult) dryRunResults.push(result.dryRunResult)
        } else if (result.status === 'not_available') {
          notAvailable++
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
              job: 'ingest/ca',
              runId,
              indicatorId: result.indicator.id,
              source: result.sourceUsed,
              observations: result.macroSeries.data.length,
              lastUpdated: result.macroSeries.lastUpdated,
            })
          } else {
            ingested++ // Count for dry run too
            if (result.dryRunResult) dryRunResults.push(result.dryRunResult)
          }
        }
      }

      // Small delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const duration = Date.now() - startTime

    // Build comprehensive summary
    const summary = buildJobSummary(
      runId,
      'ingest/ca',
      'CA',
      duration,
      allBatchResults.map(r => ({
        indicator: r.indicator,
        sourceUsed: r.sourceUsed || 'none',
        status: r.status,
        errorEntry: r.errorEntry,
      }))
    )

    // Log structured summary
    logJobSummary(summary)

    // Check and log alerts
    checkAndLogAlerts(summary)

    logger.info('job.complete', {
      job: 'ingest/ca',
      runId,
      durationMs: duration,
      ingested,
      failed,
      notMigrated,
      notAvailable,
      total: indicators.length,
      summary: {
        okCount: summary.okCount,
        errorCount: summary.errorCount,
        breakdownByErrorType: summary.breakdownByErrorType,
        breakdownBySource: summary.breakdownBySource,
        topFailingIndicators: summary.topFailingIndicators.map(i => i.indicatorKey),
      },
    })

    const result = {
      success: true,
      runId,
      durationMs: duration,
      ingested,
      failed,
      notMigrated,
      notAvailable,
      total: indicators.length,
      errorDetails: ingestErrors.length > 0 ? ingestErrors : undefined,
      dryRunResults: dryRun ? dryRunResults : undefined,
      summary: {
        okCount: summary.okCount,
        errorCount: summary.errorCount,
        breakdownByErrorType: summary.breakdownByErrorType,
        breakdownBySource: summary.breakdownBySource,
        topFailingIndicators: summary.topFailingIndicators,
        circuitBreakerState: summary.circuitBreakerState,
      },
    }

    // Store run status for /api/jobs/runs/latest
    try {
      const { storeRunStatus } = await import('@/lib/betaRunStore')
      storeRunStatus({
        runId,
        job: 'ingest/ca',
        country: 'CA',
        status: 'complete',
        startTime,
        durationMs: result.durationMs,
        summary: {
          ingested,
          failed,
          notMigrated,
          notAvailable,
          total: indicators.length,
          okCount: summary.okCount,
          errorCount: summary.errorCount,
          breakdownByErrorType: summary.breakdownByErrorType,
          breakdownBySource: summary.breakdownBySource,
          topFailingIndicators: summary.topFailingIndicators,
          circuitBreakerState: summary.circuitBreakerState,
        },
      })
    } catch (e) {
      // Ignore if storeRunStatus not available
    }

    return NextResponse.json(result)
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    // Store run status as error
    try {
      const { storeRunStatus } = await import('@/lib/betaRunStore')
      storeRunStatus({
        runId,
        job: 'ingest/ca',
        country: 'CA',
        status: 'error',
        startTime,
        durationMs: duration,
        error: errorMessage,
      })
    } catch (e) {
      // Ignore if storeRunStatus not available
    }

    logger.error('job.failed', {
      job: 'ingest/ca',
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
