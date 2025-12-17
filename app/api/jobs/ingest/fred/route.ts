/**
 * Job: Ingest FRED data into SQLite
 * POST /api/jobs/ingest/fred
 * GET /api/jobs/ingest/fred (for Vercel Scheduled Functions)
 * Protected by CRON_TOKEN or INGEST_KEY
 * 
 * Scheduled via: app/api/jobs/ingest/fred/schedule.json
 * Ingests all FRED indicators used by the dashboard into macro_observations
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { fetchFredSeries } from '@/lib/fred'
import { upsertMacroSeries, saveIngestHistory } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { checkMacroReleases } from '@/lib/alerts/triggers'
import { getAllIndicatorHistories } from '@/lib/db/read'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { KEY_TO_SERIES_ID } from '@/lib/db/read-macro'
import { fetchWithFallback, createFredFallbackSources } from '@/lib/datasources/fallback'
import { getJobState, saveJobState } from '@/lib/db/job-state'

// FRED series IDs used by the dashboard
const FRED_SERIES = [
  // Inflation
  { id: 'CPIAUCSL', name: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', frequency: 'm' },
  { id: 'CPILFESL', name: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy in U.S. City Average', frequency: 'm' },
  { id: 'PCEPILFE', name: 'Personal Consumption Expenditures Excluding Food and Energy (Chain-Type Price Index)', frequency: 'm' },
  { id: 'PPIACO', name: 'Producer Price Index for All Commodities', frequency: 'm' },
  // Growth / Activity
  { id: 'GDPC1', name: 'Real Gross Domestic Product', frequency: 'q' },
  { id: 'INDPRO', name: 'Industrial Production Index', frequency: 'm' },
  { id: 'RSAFS', name: 'Advance Retail Sales: Retail and Food Services', frequency: 'm' },
  // Employment
  { id: 'PAYEMS', name: 'All Employees, Total Nonfarm', frequency: 'm' },
  { id: 'UNRATE', name: 'Unemployment Rate', frequency: 'm' },
  { id: 'ICSA', name: 'Initial Claims', frequency: 'w' },
  { id: 'JTSJOL', name: 'Job Openings: Total Nonfarm', frequency: 'm' },
  // Monetary Policy
  { id: 'T10Y2Y', name: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', frequency: 'd' },
  { id: 'FEDFUNDS', name: 'Effective Federal Funds Rate', frequency: 'm' },
  // Extra indicators
  { id: 'UMCSENT', name: 'University of Michigan: Consumer Sentiment', frequency: 'm' },
  { id: 'HOUST', name: 'Housing Starts: Total New Privately Owned Housing Units Started', frequency: 'm' },
  { id: 'PERMIT', name: 'New Private Housing Units Authorized by Building Permits', frequency: 'm' },
  // NFIB series not available in FRED (returns 400: series does not exist)
  // { id: 'NFIB', name: 'NFIB Small Business Optimism Index', frequency: 'm' },
  // NOTA: USPMI (ISM Manufacturing) y USPMI_SERVICES (ISM Services) no están en FRED
  // Se obtienen de Trading Economics o ISM directo (ver app/api/jobs/ingest/pmi/route.ts)
]

export async function POST(request: NextRequest) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  // Allow if: localhost AND (no CRON_TOKEN set OR not in Vercel)
  if (isLocalhost && (!hasCronToken || !isVercel)) {
    // Allow without authentication
    console.log('[fred/route] Allowing request from localhost without token')
  } else {
    // Require authentication
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  // TEMPORARY: ENV CHECK for Trading Economics API key (replaced Alpha Vantage)
  logger.info("ENV CHECK", {
    hasTradingEconomicsKey: !!process.env.TRADING_ECONOMICS_API_KEY,
    tradingEconomicsKeyPrefix: process.env.TRADING_ECONOMICS_API_KEY?.slice(0, 4) ?? null,
  })

  const jobId = 'ingest_fred'
  const startedAt = Date.now()
  const HARD_LIMIT_MS = 240_000 // 4 minutes (leave margin before 300s timeout)

  // Parse batch parameters
  const { searchParams } = new URL(request.url)
  const batchSize = parseInt(searchParams.get('batch') || '10', 10)
  const cursorParam = searchParams.get('cursor')
  const resetParam = searchParams.get('reset') === 'true'
  const onlySeries = searchParams.get('only') || null

  try {
    // Get or reset job state
    let cursor: string | null = null
    if (resetParam) {
      await saveJobState(jobId, null, 'success')
      logger.info('Job state reset requested', { job: jobId })
    } else {
      const state = cursorParam ? null : await getJobState(jobId)
      cursor = cursorParam || state?.cursor || null
    }

    logger.info('Starting FRED data ingestion', {
      job: jobId,
      batchSize,
      cursor,
      reset: resetParam,
    })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ seriesId?: string; error: string }> = []
    const seriesTimings: Array<{ seriesId: string; durationMs: number; success: boolean }> = []

    // Forzar reingesta completa temporalmente para rellenar histórico y "dato anterior"
    // ESPECIAL: Forzar reingesta de RSAFS para cambiar de YoY a nivel crudo
    const FORCE_FULL_REINGEST = true
    const FORCE_REINGEST_RSAFS = true // Force re-ingest RSAFS to get raw level data

    // Determine base series list (support debug mode ?only=SERIES_ID)
    // Special case: USPMI is not in FRED_SERIES (comes from Trading Economics)
    let baseSeries = FRED_SERIES
    if (onlySeries) {
      if (onlySeries === 'USPMI') {
        // USPMI is handled separately, create a dummy entry for the loop
        baseSeries = [{ id: 'USPMI', name: 'ISM Manufacturing: PMI', frequency: 'm' }]
      } else {
        baseSeries = FRED_SERIES.filter(s => s.id === onlySeries)
      }
    }

    // Find starting index from cursor (ignored when onlySeries is set)
    // IMPORTANT: If cursor exists, start AFTER it (cursorIndex + 1), not at it
    let startIndex = 0
    if (!onlySeries && cursor) {
      const cursorIndex = baseSeries.findIndex(s => s.id === cursor)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1 // Start AFTER the cursor, not at it
      } else {
        logger.warn(`Cursor ${cursor} not found in baseSeries, starting from beginning`, { job: jobId })
        startIndex = 0
      }
    }

    const endIndex = Math.min(startIndex + batchSize, baseSeries.length)
    const seriesToProcess = baseSeries.slice(startIndex, endIndex)
    
    // Calculate nextCursor: should point to the NEXT item after the batch, not the last processed
    const nextCursor = endIndex < baseSeries.length ? baseSeries[endIndex].id : null
    // When only=USPMI, baseSeries.length is 1, so done should be true after processing
    const done = endIndex >= baseSeries.length

    logger.info(`Processing batch: ${seriesToProcess.length} series starting from index ${startIndex}`, {
      job: jobId,
      totalSeries: FRED_SERIES.length,
      startIndex,
      endIndex,
      batchSize,
      cursor,
      nextCursor,
      done,
      seriesIds: seriesToProcess.map(s => s.id),
    })

    // Pre-fetch all last dates from DB in a single query to optimize (still useful for logging)
    // Only fetch for series in current batch to optimize
    const db = getUnifiedDB()
    let lastDatesMap = new Map<string, string | null>()
    try {
      const seriesIds = seriesToProcess.map(s => s.id)
      if (seriesIds.length > 0) {
        const placeholders = seriesIds.map(() => '?').join(',')
        const result = await db.prepare(
          `SELECT series_id, MAX(date) as max_date FROM macro_observations WHERE series_id IN (${placeholders}) GROUP BY series_id`
        ).all(...seriesIds) as Array<{ series_id: string; max_date: string | null }>
        
        for (const row of result) {
          lastDatesMap.set(row.series_id, row.max_date)
        }
        logger.info('Pre-fetched last dates from DB', { job: jobId, count: lastDatesMap.size })
      }
    } catch (err) {
      logger.warn('Could not pre-fetch last dates, will query individually', { job: jobId, error: String(err) })
    }

    let processedCount = 0
    let actualNextCursor: string | null = nextCursor // Will be updated if we hit hard limit

    for (const series of seriesToProcess) {
      // Check hard limit before processing each series
      const elapsed = Date.now() - startedAt
      if (elapsed > HARD_LIMIT_MS) {
        // If we hit hard limit, nextCursor should be the CURRENT series (we'll continue from here)
        const currentIndex = baseSeries.findIndex(s => s.id === series.id)
        if (currentIndex >= 0 && currentIndex + 1 < baseSeries.length) {
          actualNextCursor = baseSeries[currentIndex].id // Continue from this series next time
        } else {
          actualNextCursor = null // We're at the end
        }
        logger.warn(`Hard limit reached, stopping batch processing`, {
          job: jobId,
          elapsedMs: elapsed,
          processedCount,
          currentSeries: series.id,
          nextCursor: actualNextCursor,
        })
        break
      }

      processedCount++
      const seriesStartTime = Date.now()
      
      // Special handling for USPMI (PMI Manufacturing from Trading Economics, not FRED)
      if (series.id === 'USPMI') {
        const seriesStartTime = Date.now()
        if (!process.env.TRADING_ECONOMICS_API_KEY) {
          logger.warn('TRADING_ECONOMICS_API_KEY not configured, skipping USPMI ingestion', { job: jobId })
          ingestErrors.push({ seriesId: 'USPMI', error: 'TRADING_ECONOMICS_API_KEY not configured' })
          seriesTimings.push({ seriesId: 'USPMI', durationMs: Date.now() - seriesStartTime, success: false })
        } else {
          try {
            // If reset=true, delete existing USPMI observations
            if (resetParam) {
              try {
                await db.prepare('DELETE FROM macro_observations WHERE series_id = ?').run('USPMI')
                lastDatesMap.set('USPMI', null)
                logger.info(`[USPMI] Deleted existing observations due to reset=true`, { job: jobId })
              } catch (error) {
                logger.warn(`[USPMI] Failed to delete observations on reset`, { job: jobId, error: String(error) })
              }
            }

            logger.info('Attempting USPMI ingestion from Trading Economics', { job: jobId })
            const { fetchUSPMIFromTradingEconomics } = await import('@/packages/ingestors/tradingEconomics')
            
            const pmiObservations = await fetchUSPMIFromTradingEconomics(process.env.TRADING_ECONOMICS_API_KEY)
            
            if (pmiObservations.length > 0) {
              const pmiSeries: MacroSeries = {
                id: 'USPMI',
                source: 'TRADING_ECONOMICS',
                indicator: 'USPMI',
                nativeId: 'ISM_MANUFACTURING_PMI',
                name: 'ISM Manufacturing: PMI',
                frequency: 'M', // Monthly - no transformations needed (diffusion index)
                data: pmiObservations.map(obs => ({
                  date: obs.date, // Already normalized to YYYY-MM-01
                  value: obs.value,
                })),
                lastUpdated: pmiObservations[pmiObservations.length - 1]?.date || undefined,
              }

              logger.info(`[USPMI] fetchUSPMIFromTradingEconomics result`, {
                job: jobId,
                totalPoints: pmiObservations.length,
                firstObs: pmiObservations[0] || null,
                lastObs: pmiObservations[pmiObservations.length - 1] || null,
              })

              logger.info(`[USPMI] Preparing to upsert observations`, {
                job: jobId,
                series_id: 'USPMI',
                toInsert: pmiObservations.length,
                firstDate: pmiObservations[0]?.date ?? null,
                lastDate: pmiObservations[pmiObservations.length - 1]?.date ?? null,
              })

              await upsertMacroSeries(pmiSeries)
              ingested++
              
              const lastObs = pmiObservations[pmiObservations.length - 1]
              const lastDate = lastObs?.date
              const daysSinceLastObs = lastDate 
                ? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
                : null
              
              logger.info('Ingested USPMI from Trading Economics', {
                job: jobId,
                series_id: 'USPMI',
                points: pmiObservations.length,
                lastDate: lastDate,
                lastValue: lastObs?.value,
                daysSinceLastObs: daysSinceLastObs,
              })
              
              seriesTimings.push({ seriesId: 'USPMI', durationMs: Date.now() - seriesStartTime, success: true })
            } else {
              const errorMsg = 'No observations returned from Trading Economics'
              logger.warn(`[USPMI] ${errorMsg}`, { job: jobId })
              ingestErrors.push({ seriesId: 'USPMI', error: errorMsg })
              seriesTimings.push({ seriesId: 'USPMI', durationMs: Date.now() - seriesStartTime, success: false })
            }
          } catch (error) {
            const teError = error instanceof Error ? error.message : String(error)
            logger.error('Trading Economics USPMI ingestion failed', {
              job: jobId,
              error: teError,
            })
            errors++
            ingestErrors.push({ seriesId: 'USPMI', error: teError })
            seriesTimings.push({ seriesId: 'USPMI', durationMs: Date.now() - seriesStartTime, success: false })
          }
        }
        continue // Skip FRED processing for USPMI
      }

      try {
        // Get indicator config synchronously (if available) - cache import to avoid repeated imports
        let fredTransform: string | undefined = undefined
        try {
          // Cache the config import to avoid repeated dynamic imports
          const { MACRO_INDICATORS_CONFIG } = await import('@/config/macro-indicators')
          const config = Object.values(MACRO_INDICATORS_CONFIG).find((cfg: any) => cfg.fredSeriesId === series.id) as any
          if (config?.fredTransform) {
            fredTransform = config.fredTransform
          }
        } catch (e) {
          // Ignore if config not available
        }

        // If reset=true, delete existing observations for this series BEFORE fetching
        if (resetParam) {
          try {
            await db.prepare('DELETE FROM macro_observations WHERE series_id = ?').run(series.id)
            lastDatesMap.set(series.id, null)
            logger.info(`[${series.id}] Deleted existing observations due to reset=true`, { job: jobId })
          } catch (error) {
            logger.warn(`[${series.id}] Failed to delete observations on reset`, { job: jobId, error: String(error) })
          }
        }

        // Try FRED first, then fallback to other sources
        const endDate = new Date().toISOString().slice(0, 10)
        
        // If fredTransform is specified, use it directly instead of fallback
        let macroSeries
        if (fredTransform) {
          // Fetch directly with transform
          const observations = await fetchFredSeries(series.id, {
            observation_start: '2010-01-01',
            observation_end: endDate,
            units: fredTransform, // Use FRED transform (pc1 for YoY, pca for QoQ, etc.)
          })
          
          logger.info(`[${series.id}] fetchFredSeries result (direct)`, {
            job: jobId,
            transform: fredTransform,
            observationsLength: observations.length,
            firstObs: observations[0] || null,
            lastObs: observations[observations.length - 1] || null,
          })
          
          macroSeries = {
            id: series.id,
            source: 'FRED' as const,
            indicator: series.id,
            nativeId: series.id,
            name: series.name,
            frequency: series.frequency as any,
            data: observations.map(obs => ({
              date: obs.date,
              value: obs.value,
              ...(obs.observation_period && { observation_period: obs.observation_period }), // Preserve observation_period if present
            })) as any, // Type assertion to allow observation_period
            lastUpdated: observations.length > 0 ? observations[observations.length - 1].date : undefined,
          }
        } else {
          // Use fallback sources (original behavior)
          const fallbackSources = createFredFallbackSources(
            series.id,
            series.frequency as 'd' | 'm' | 'q',
            '2010-01-01',
            endDate,
            undefined // No units transform
          )
          macroSeries = await fetchWithFallback(series.id, fallbackSources)

          logger.info(`[${series.id}] fetchWithFallback result`, {
            job: jobId,
            source: macroSeries?.source,
            totalPoints: macroSeries?.data?.length ?? 0,
            firstObs: macroSeries?.data?.[0] || null,
            lastObs: macroSeries?.data?.[macroSeries.data.length - 1] || null,
          })
        }

        if (!macroSeries || macroSeries.data.length === 0) {
          logger.warn(`No observations for ${series.id} from any source`, { job: jobId })
          errors++
          ingestErrors.push({ seriesId: series.id, error: 'All sources failed or returned no data' })
          continue
        }

        // Ensure series metadata is set correctly
        macroSeries.id = series.id
        macroSeries.name = series.name
        macroSeries.frequency = series.frequency as any

        // Get last date in DB for this series (from pre-fetched map)
        const lastDateInDb = lastDatesMap.get(series.id) || null
        
        // Force re-ingest RSAFS to replace YoY values with raw level data
        const forceReingest = FORCE_FULL_REINGEST || (FORCE_REINGEST_RSAFS && series.id === 'RSAFS')
        
        // If forcing re-ingest of RSAFS, delete old data first to replace YoY with raw level
        if (FORCE_REINGEST_RSAFS && series.id === 'RSAFS' && !fredTransform) {
          try {
            const db = getUnifiedDB()
            if (isUsingTurso()) {
              await db.prepare('DELETE FROM macro_observations WHERE series_id = ?').run(series.id)
            } else {
              await db.prepare('DELETE FROM macro_observations WHERE series_id = ?').run(series.id)
            }
            logger.info(`[${series.id}] Deleted old data to force re-ingest as raw level`, { job: jobId })
          } catch (error) {
            logger.warn(`[${series.id}] Failed to delete old data, will upsert anyway`, { job: jobId, error: String(error) })
          }
        }

        const newPoints = (forceReingest || !lastDateInDb)
          ? macroSeries.data
          : macroSeries.data.filter((p: { date: string; value: number }) => p.date > lastDateInDb)

        const seriesDurationMs = Date.now() - seriesStartTime
        logger.info(`[${series.id}] Fetch completed`, {
          job: jobId,
          series_id: series.id,
          durationMs: seriesDurationMs,
          totalPoints: macroSeries.data.length,
          newPoints: newPoints.length,
          lastDateInDb,
        })

        if (newPoints.length === 0) {
          logger.info(`[${series.id}] No new points, skipping upsert`, {
            job: jobId,
            series_id: series.id,
            lastDateInDb,
          })
          seriesTimings.push({ seriesId: series.id, durationMs: seriesDurationMs, success: true })
          continue
        }

        console.log(
          JSON.stringify({
            level: "debug",
            message: "filtered points to insert",
            series_id: series.id,
            lastDateInDb,
            incomingPoints: macroSeries.data.length,
            newPoints: newPoints.length,
            firstNewDate: newPoints[0]?.date,
            lastNewDate: newPoints[newPoints.length - 1]?.date,
          })
        )

        // Upsert to database (idempotent - no duplicates)
        logger.info(`[${series.id}] Preparing to upsert observations`, {
          job: jobId,
          series_id: series.id,
          toInsert: newPoints.length,
          firstDate: newPoints[0]?.date ?? null,
          lastDate: newPoints[newPoints.length - 1]?.date ?? null,
        })

        const upsertStartTime = Date.now()
        await upsertMacroSeries(macroSeries)
        const upsertDurationMs = Date.now() - upsertStartTime
        
        ingested++
        const totalDurationMs = Date.now() - seriesStartTime
        seriesTimings.push({ seriesId: series.id, durationMs: totalDurationMs, success: true })

        logger.info(`Ingested ${series.id}`, {
          job: jobId,
          series_id: series.id,
          points: macroSeries.data.length,
          newPoints: newPoints.length,
          fetchDurationMs: seriesDurationMs,
          upsertDurationMs,
          totalDurationMs,
        })
      } catch (error) {
        errors++
        const errorMsg = error instanceof Error ? error.message : String(error)
        const seriesDurationMs = Date.now() - seriesStartTime
        seriesTimings.push({ seriesId: series.id, durationMs: seriesDurationMs, success: false })
        ingestErrors.push({ seriesId: series.id, error: errorMsg })
        logger.error(`Failed to ingest ${series.id}`, {
          job: jobId,
          series_id: series.id,
          error: errorMsg,
          durationMs: seriesDurationMs,
        })
      }
      // Note: nextCursor is already calculated before the loop (points to item AFTER batch)
      // We only update it if we hit hard limit mid-batch
    }

    // Use actualNextCursor (may have been updated if we hit hard limit)
    const finalNextCursor = actualNextCursor !== null ? actualNextCursor : nextCursor

    // Check if we've processed all series
    // When only=USPMI, baseSeries.length is 1, so use baseSeries.length instead of FRED_SERIES.length
    const totalSeriesToProcess = onlySeries ? baseSeries.length : FRED_SERIES.length
    const isComplete = endIndex >= totalSeriesToProcess
    const finalDone = isComplete && finalNextCursor === null

    // Log final cursor state
    logger.info(`Batch processing complete`, {
      job: jobId,
      startIndex,
      endIndex,
      processedCount,
      totalSeries: FRED_SERIES.length,
      cursor,
      nextCursor: finalNextCursor,
      done: finalDone,
    })

    // Save job state
    const durationMs = Date.now() - startedAt
    await saveJobState(
      jobId,
      finalDone ? null : finalNextCursor,
      finalDone ? 'success' : 'partial',
      durationMs
    )

    // Only process PMI if we're in the last batch (to avoid timeout)
    // PMI is processed after all FRED series, so only do it if we're done with FRED series
    // IMPORTANT: Skip this if only=USPMI (already processed in main loop above)
    const isLastBatch = finalDone
    let pmiIngested = false
    let pmiError: string | null = null
    
    // Check if USPMI was already processed in the main loop (when only=USPMI)
    const uspmiAlreadyProcessed = onlySeries === 'USPMI' && seriesToProcess.some(s => s.id === 'USPMI')
    
    // USPMI is now processed in the main loop above (when only=USPMI or in normal flow)
    // This section is kept for backward compatibility but should not execute if USPMI was already processed
    // Note: Trading Economics is now the primary source for USPMI (replaced Alpha Vantage)
    if (isLastBatch && !pmiIngested && !uspmiAlreadyProcessed) {
      // USPMI should have been processed in main loop, but if not, log warning
      logger.warn('USPMI was not processed in main loop (this should not happen)', {
        job: jobId,
        onlySeries,
        seriesToProcess: seriesToProcess.map(s => s.id),
      })
      pmiError = 'USPMI processing skipped - should be handled in main loop'
    }
    
    // Log final status (only if last batch)
    if (isLastBatch) {
      if (!pmiIngested) {
        // Don't increment errors - PMI is optional and doesn't block the job
        const finalError = pmiError || 'No PMI data sources available or all sources failed'
        ingestErrors.push({ seriesId: 'USPMI', error: finalError })
        logger.warn('PMI ingestion failed from all sources (non-fatal). Manual entry may be required.', {
          job: jobId,
          series_id: 'USPMI',
          error: finalError,
          hasApiKey: !!process.env.TRADING_ECONOMICS_API_KEY,
          note: 'Job completed successfully - PMI can be inserted manually via /api/admin/pmi/insert',
        })
      } else {
        logger.info('PMI ingestion completed successfully', {
          job: jobId,
          series_id: 'USPMI',
        })
      }
    } else {
      logger.info('PMI ingestion skipped (not last batch)', {
        job: jobId,
        isLastBatch,
        done,
      })
    }

    const finishedAt = new Date().toISOString()
    const totalDurationMs = Date.now() - startedAt

    // Log timing summary
    const totalSeriesTime = seriesTimings.reduce((sum, t) => sum + t.durationMs, 0)
    const avgSeriesTime = seriesTimings.length > 0 ? totalSeriesTime / seriesTimings.length : 0
    const slowestSeries = seriesTimings.sort((a, b) => b.durationMs - a.durationMs)[0]
    
    logger.info('FRED ingestion batch completed', {
      job: jobId,
      ingested,
      errors,
      durationMs: totalDurationMs,
      done: finalDone,
      nextCursor: finalNextCursor,
      processedCount,
      totalSeries: FRED_SERIES.length,
      startIndex,
      endIndex,
      totalSeriesTime,
      avgSeriesTime: Math.round(avgSeriesTime),
      slowestSeries: slowestSeries ? { id: slowestSeries.seriesId, durationMs: slowestSeries.durationMs } : null,
      seriesTimings: seriesTimings.slice(0, 5), // Log top 5 slowest
    })

    // Save ingest history (only if done, to avoid cluttering history with partial batches)
    if (finalDone) {
      try {
        await saveIngestHistory({
          jobType: 'ingest_fred',
          updatedSeriesCount: ingested,
          errorsCount: errors,
          durationMs: totalDurationMs,
          errors: ingestErrors.length > 0 ? ingestErrors : undefined,
          finishedAt,
        })
      } catch (error) {
        logger.error('Failed to save ingest history', { job: jobId, error })
      }
    }

    // Check macro release alerts (Trigger C) - Only if we have time and this is the last batch
    // Skip if we're running out of time to avoid timeout
    if (isLastBatch && totalDurationMs < HARD_LIMIT_MS) {
      try {
        const alertsStartTime = Date.now()
        const diagnosis = await getMacroDiagnosis()
        const histories = await getAllIndicatorHistories()
        const CRITICAL_SERIES_IDS = ['CPIAUCSL', 'CPILFESL', 'PCEPI', 'PCEPILFE', 'PPIACO', 'PAYEMS', 'UNRATE', 'ICSA', 'GDPC1', 'T10Y2Y', 'VIXCLS']

        const observationsForAlerts = diagnosis.items
          .filter(item => {
            const seriesId = KEY_TO_SERIES_ID[item.key]
            return seriesId && CRITICAL_SERIES_IDS.includes(seriesId)
          })
          .map(item => {
            const seriesId = KEY_TO_SERIES_ID[item.key]
            const history = histories.get(item.key.toUpperCase())
            
            return {
              seriesId: seriesId!,
              label: item.label,
              value: item.value ?? 0,
              valuePrevious: history?.value_previous ?? null,
              date: item.date || '',
              datePrevious: history?.date_previous ?? null,
              trend: (item.trend || 'Estable') as 'Mejora' | 'Empeora' | 'Estable',
              posture: (item.posture || 'Neutral') as 'Hawkish' | 'Dovish' | 'Neutral',
            }
          })

        await checkMacroReleases(observationsForAlerts)
        const alertsDurationMs = Date.now() - alertsStartTime
        logger.info('Macro release check completed', { 
          job: jobId, 
          count: observationsForAlerts.length,
          durationMs: alertsDurationMs,
        })
      } catch (error) {
        logger.error('Failed to check macro release alerts', {
          job: jobId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } else {
      logger.warn('Skipping macro release alerts check due to time limit or not last batch', {
        job: jobId,
        isLastBatch,
        durationMs: totalDurationMs,
        hardLimit: HARD_LIMIT_MS,
      })
    }

    return NextResponse.json({
      success: true,
      job: jobId,
      ingested,
      errors,
      processed: processedCount,
      nextCursor: finalNextCursor,
      done: finalDone,
      durationMs: totalDurationMs,
      finishedAt,
      ingestErrors: ingestErrors.slice(0, 10), // Limit to first 10 errors
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('FRED ingestion failed', {
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

