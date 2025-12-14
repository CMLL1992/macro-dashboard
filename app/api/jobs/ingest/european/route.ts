/**
 * Job: Ingest European economic indicators into SQLite
 * POST /api/jobs/ingest/european
 * Protected by CRON_TOKEN
 * 
 * Ingests all European indicators (Eurozone) used by the dashboard
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { fetchECBSeries, fetchECBSimpleSeries } from '@/lib/datasources/ecb'
import { fetchDBnomicsSeries } from '@/lib/datasources/dbnomics'
import { fetchEurostatSeries } from '@/lib/datasources/eurostat'
import { fetchFredSeries } from '@/lib/fred'
import { fetchEcondifySeries } from '@/lib/datasources/econdify'
import fs from 'node:fs'
import path from 'node:path'

// Helper function to validate dates
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}

// Load European indicators config
function loadEuropeanIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'european-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load european-indicators.json', { error })
    return { indicators: [] }
  }
}

const EUROPEAN_INDICATORS = loadEuropeanIndicators()

export async function POST(request: NextRequest) {
  // Debug: Log request details
  const host = request.headers.get('host') || ''
  const crontoken = process.env.CRON_TOKEN || ''
  const vercel = process.env.VERCEL || ''
  console.log('[european-job] Request received:', { host, hasCronToken: !!crontoken, isVercel: !!vercel })
  
  const isValid = validateCronToken(request)
  console.log('[european-job] Token validation result:', isValid)
  
  if (!isValid) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_european'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting European indicators ingestion', { job: jobId })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ indicatorId?: string; error: string }> = []

    const indicators = EUROPEAN_INDICATORS.indicators || []
    
    // TAREA 1: Log indicators to be processed
    logger.info(`[${jobId}] Starting ingestion for ${indicators.length} European indicators`, {
      job: jobId,
      indicatorIds: indicators.map((ind: any) => ind.id),
    })
    
    // Note: TradingEconomics removed for Eurozone - now using Eurostat/ECB/FRED only
    // Validate that no indicators use trading_economics source
    const invalidIndicators = indicators.filter((ind: any) => 
      ind.source === 'trading_economics' || ind.source === 'TRADING_ECONOMICS'
    )
    if (invalidIndicators.length > 0) {
      logger.error('Found indicators with trading_economics source - these should be removed', {
        job: jobId,
        invalidIndicators: invalidIndicators.map((ind: any) => ind.id),
      })
      throw new Error(`Invalid source 'trading_economics' found for indicators: ${invalidIndicators.map((ind: any) => ind.id).join(', ')}. TradingEconomics is not allowed for Eurozone indicators.`)
    }

    // Forzar reingesta completa temporalmente para rellenar histórico y "dato anterior"
    const FORCE_FULL_REINGEST = true

    for (const indicator of indicators) {
      // Process each indicator independently - errors in one don't affect others
      try {
        logger.info(`[${jobId}] Processing ${indicator.id} from ${indicator.source}`, {
          job: jobId,
          indicatorId: indicator.id,
          source: indicator.source,
        })
        
        let macroSeries: MacroSeries | null = null

        // Fetch based on source - each source is wrapped in try/catch to prevent one failure from aborting the job
        try {
          if (indicator.source === 'ecb') {
            macroSeries = await fetchECBSeries({
              flow: indicator.flow,
              key: indicator.key,
              freq: indicator.frequency as any,
            })
          } else if (indicator.source === 'ecb_sdw') {
            const code = (indicator as any).code
            if (!code) {
              throw new Error(`ECB SDW code is required for ${indicator.id}`)
            }
            macroSeries = await fetchECBSimpleSeries(code, 100) // Fetch last 100 observations for historical data
            // Override ID and name to match indicator configuration
            if (macroSeries) {
              macroSeries.id = indicator.id
              macroSeries.name = indicator.name
              macroSeries.frequency = indicator.frequency as any
            }
          } else if (indicator.source === 'fred') {
            const seriesId = (indicator as any).series_id
            if (!seriesId) {
              throw new Error(`FRED series_id is required for ${indicator.id}`)
            }
            
            // For Eurostat series (EA19*), they are already YoY, so don't apply transformation
            // Check if series ID starts with EA19 (Eurostat series) - these are already YoY
            const isEurostatYoY = seriesId.startsWith('EA19') && (indicator.id.includes('_YOY') || indicator.name.toLowerCase().includes('yoy'))
            
            // Determine if we need YoY transformation
            // For Eurostat YoY series, they're already YoY, so use units=lin (no transformation)
            // For other series that need YoY, use units=pc1 (percent change from year ago)
            const needsYoY = !isEurostatYoY && (indicator.id.includes('_YOY') || indicator.name.toLowerCase().includes('yoy'))
            const units = needsYoY ? 'pc1' : 'lin' // Use lin for Eurostat YoY series (already YoY)
            
            // Fetch from FRED
            // Note: Some FRED series don't support frequency parameter, so we omit it
            const observations = await fetchFredSeries(seriesId, {
              observation_start: '2010-01-01',
              observation_end: new Date().toISOString().slice(0, 10),
              units: units, // Use lin for Eurostat YoY (already YoY), pc1 for others
              // Don't set frequency - let FRED use the series' native frequency
            })
            
            if (observations.length === 0) {
              throw new Error('No observations returned from FRED')
            }
            
            // Convert to MacroSeries format
            // IMPORTANT: Use observation_period if available (actual period of data), otherwise use date
            // This ensures each observation has its unique date, not a fallback date
            macroSeries = {
              id: indicator.id,
              source: 'FRED',
              indicator: seriesId,
              nativeId: seriesId,
              name: indicator.name,
              frequency: indicator.frequency as any,
              data: observations
                .map(obs => {
                  // Use observation_period if available (actual period), otherwise use date
                  const observationDate = obs.observation_period || obs.date
                  
                  // Validate date format (YYYY-MM-DD)
                  const parsedDate = new Date(observationDate)
                  if (!isValidDate(parsedDate)) {
                    logger.warn(`[${jobId}] Invalid date for ${indicator.id}: ${observationDate}`, {
                      job: jobId,
                      indicatorId: indicator.id,
                      invalidDate: observationDate,
                      originalDate: obs.date,
                      observationPeriod: obs.observation_period,
                    })
                    return null // Skip this observation
                  }
                  
                  return {
                    date: observationDate, // Use actual observation period, not realtime_start
                    value: obs.value,
                  }
                })
                .filter((dp): dp is { date: string; value: number } => dp !== null),
              lastUpdated: observations[observations.length - 1]?.observation_period || observations[observations.length - 1]?.date,
              meta: {
                series_id: seriesId,
              },
            }
            
            // Log date validation summary
            if (macroSeries.data.length !== observations.length) {
              logger.warn(`[${jobId}] Filtered ${observations.length - macroSeries.data.length} observations with invalid dates for ${indicator.id}`, {
                job: jobId,
                indicatorId: indicator.id,
                originalCount: observations.length,
                validCount: macroSeries.data.length,
              })
            }
            } else if (indicator.source === 'eurostat') {
            const dataset = (indicator as any).dataset
            const filters = (indicator as any).filters || {}
            const geo = (indicator as any).geo || 'EA19'
            
            if (!dataset) {
              throw new Error(`Eurostat dataset is required for ${indicator.id}`)
            }
            
            // Log Eurostat query parameters before fetching
            const eurostatParams = {
              dataset,
              filters,
              geo,
              frequency: indicator.frequency as any,
            }
            const eurostatUrl = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?format=JSON&lang=en&geo=${geo}&${Object.entries(filters).map(([k, v]) => `${k}=${v}`).join('&')}`
            logger.info(`[${jobId}] Fetching Eurostat data for ${indicator.id}`, {
              job: jobId,
              indicatorId: indicator.id,
              url: eurostatUrl,
              params: JSON.stringify(eurostatParams),
            })
            
            macroSeries = await fetchEurostatSeries(eurostatParams)
            
            // Override ID and name to match indicator configuration
            if (macroSeries) {
              macroSeries.id = indicator.id
              macroSeries.name = indicator.name
              macroSeries.frequency = indicator.frequency as any
            }
          } else if (indicator.source === 'econdify') {
            const country = (indicator as any).country
            const indicatorName = (indicator as any).indicator
            if (!country || !indicatorName) {
              throw new Error(`Econdify country and indicator are required for ${indicator.id}`)
            }
            
            macroSeries = await fetchEcondifySeries({
              country,
              indicator: indicatorName,
            })
            
            // Override ID to match indicator.id
            if (macroSeries) {
              macroSeries.id = indicator.id
              macroSeries.name = indicator.name
            }
          } else if (indicator.source === 'dbnomics') {
            macroSeries = await fetchDBnomicsSeries({
              provider: indicator.provider,
              dataset: indicator.dataset,
              series: indicator.series,
            })
          } else if (indicator.source === 'trading_economics' || indicator.source === 'TRADING_ECONOMICS') {
            // TradingEconomics is explicitly not allowed for Eurozone indicators
            throw new Error(`TradingEconomics is not allowed for Eurozone indicators. Use 'eurostat', 'ecb', 'fred', 'econdify', or 'dbnomics' instead. Indicator: ${indicator.id}`)
          } else {
            throw new Error(`Unknown source: ${indicator.source} for indicator ${indicator.id}`)
          }
          
          // Log successful fetch
          if (macroSeries && macroSeries.data.length > 0) {
            logger.info(`[${jobId}] Successfully fetched ${indicator.id}`, {
              job: jobId,
              indicatorId: indicator.id,
              source: indicator.source,
              dataPoints: macroSeries.data.length,
              firstDate: macroSeries.data[0]?.date,
              lastDate: macroSeries.data[macroSeries.data.length - 1]?.date,
            })
          }
        } catch (fetchError) {
          // Log fetch error but don't abort the job - continue with next indicator
          logger.error(`[${jobId}] Failed to fetch ${indicator.id} from ${indicator.source}`, {
            job: jobId,
            indicatorId: indicator.id,
            source: indicator.source,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
            stack: fetchError instanceof Error ? fetchError.stack : undefined,
          })
          errors++
          ingestErrors.push({ 
            indicatorId: indicator.id, 
            error: `Fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}` 
          })
          continue // Skip to next indicator
        }

        if (!macroSeries || macroSeries.data.length === 0) {
          logger.warn(`No observations for ${indicator.id} from ${indicator.source}`, { job: jobId })
          errors++
          ingestErrors.push({ indicatorId: indicator.id, error: 'No data returned from source' })
          continue
        }

        // Ensure series metadata is set correctly
        macroSeries.id = indicator.id
        macroSeries.name = indicator.name
        macroSeries.frequency = indicator.frequency as any

        // TAREA 1: Log before writing to DB
        logger.info(`[${jobId}] About to save ${indicator.id}`, {
          job: jobId,
          indicatorId: indicator.id,
          seriesId: macroSeries.id,
          source: macroSeries.source,
          dataPoints: macroSeries.data.length,
          firstValue: macroSeries.data[0]?.value,
          firstDate: macroSeries.data[0]?.date,
          lastValue: macroSeries.data[macroSeries.data.length - 1]?.value,
          lastDate: macroSeries.data[macroSeries.data.length - 1]?.date,
        })

        // Get last date in DB for this series
        let lastDateInDb: string | null = null
        try {
          if (isUsingTurso()) {
            const db = getUnifiedDB()
            const result = await db.prepare(
              `SELECT MAX(date) as max_date FROM macro_observations WHERE series_id = ?`
            ).get(indicator.id) as { max_date: string | null } | null
            lastDateInDb = result?.max_date || null
          } else {
            // All methods are async now, so always use await
            const db = getUnifiedDB()
            const result = await db.prepare(
              `SELECT MAX(date) as max_date FROM macro_observations WHERE series_id = ?`
            ).get(indicator.id) as { max_date: string | null } | undefined
            lastDateInDb = result?.max_date || null
          }
        } catch (err) {
          logger.warn(`Could not get last date for ${indicator.id}`, { error: String(err) })
        }

        // TEMPORAL: Forzar re-ingesta completa para EU_RETAIL_SALES_YOY y EU_INDUSTRIAL_PRODUCTION_YOY
        // después de cambiar de TradingEconomics a FRED
        const forceReingest = indicator.id === 'EU_RETAIL_SALES_YOY' || indicator.id === 'EU_INDUSTRIAL_PRODUCTION_YOY'
        
        const newPoints = (forceReingest || FORCE_FULL_REINGEST || !lastDateInDb)
          ? macroSeries.data  // Forzar re-ingesta completa para estos indicadores
          : macroSeries.data.filter((p) => p.date > lastDateInDb!)

        if (newPoints.length === 0) {
          logger.info(`No new points for ${indicator.id}`, { job: jobId, lastDateInDb })
          continue
        }

        // TAREA 1: Log before upsert
        logger.info(`[${jobId}] Calling upsertMacroSeries for ${indicator.id}`, {
          job: jobId,
          indicatorId: indicator.id,
          seriesId: macroSeries.id,
          pointsToInsert: newPoints.length,
          sampleValue: newPoints[0]?.value,
          sampleDate: newPoints[0]?.date,
        })

        // Upsert series metadata and observations
        try {
          // Count rows BEFORE insertion
          let verifyCountBefore = 0
          try {
            if (isUsingTurso()) {
              const db = getUnifiedDB()
              const beforeResult = await db.prepare(
                `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
              ).get(indicator.id) as { count: number } | null
              verifyCountBefore = beforeResult?.count || 0
            } else {
              const db = getUnifiedDB()
              const beforeResult = await db.prepare(
                `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
              ).get(indicator.id) as { count: number } | undefined
              verifyCountBefore = beforeResult?.count || 0
            }
          } catch (beforeErr) {
            logger.warn(`[${jobId}] Could not count rows before insertion for ${indicator.id}`, { error: String(beforeErr) })
          }
          
          await upsertMacroSeries(macroSeries)
          
          // Count rows AFTER insertion
          let verifyCountAfter = 0
          try {
            if (isUsingTurso()) {
              const db = getUnifiedDB()
              const afterResult = await db.prepare(
                `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
              ).get(indicator.id) as { count: number } | null
              verifyCountAfter = afterResult?.count || 0
            } else {
              const db = getUnifiedDB()
              const afterResult = await db.prepare(
                `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
              ).get(indicator.id) as { count: number } | undefined
              verifyCountAfter = afterResult?.count || 0
            }
          } catch (afterErr) {
            logger.warn(`[${jobId}] Could not count rows after insertion for ${indicator.id}`, { error: String(afterErr) })
          }
          
          const delta = verifyCountAfter - verifyCountBefore
          
          logger.info(`[${jobId}] Successfully saved ${indicator.id}`, {
            job: jobId,
            indicatorId: indicator.id,
            seriesId: macroSeries.id,
            totalPoints: macroSeries.data.length,
            newPoints: newPoints.length,
            lastDate: newPoints[newPoints.length - 1]?.date,
            verifyCountBefore, // Rows before insertion
            verifyCountAfter, // Rows after insertion
            delta, // Difference (should match newPoints.length if all were inserted)
          })
          
          // Warn if delta doesn't match expected new points (accounting for potential duplicates)
          if (delta < newPoints.length) {
            logger.warn(`[${jobId}] Delta (${delta}) is less than newPoints (${newPoints.length}) for ${indicator.id} - possible duplicates or insertion issues`, {
              job: jobId,
              indicatorId: indicator.id,
              delta,
              newPoints: newPoints.length,
              verifyCountBefore,
              verifyCountAfter,
            })
          }
        } catch (upsertError) {
          logger.error(`[${jobId}] upsertMacroSeries failed for ${indicator.id}`, {
            job: jobId,
            indicatorId: indicator.id,
            seriesId: macroSeries.id,
            error: upsertError instanceof Error ? upsertError.message : String(upsertError),
            stack: upsertError instanceof Error ? upsertError.stack : undefined,
          })
          throw upsertError // Re-throw to be caught by outer catch
        }

        ingested++
      } catch (error) {
        // Outer catch - catches any error not handled by inner try/catch blocks
        errors++
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error(`[${jobId}] Failed to ingest ${indicator.id} (outer catch)`, {
          job: jobId,
          indicator: indicator.id,
          error: errorMessage,
          stack: errorStack,
        })
        ingestErrors.push({ indicatorId: indicator.id, error: errorMessage })
        // Continue with next indicator - don't abort the entire job
      }
    }

    const finishedAt = new Date().toISOString()
    logger.info('European indicators ingestion completed', {
      job: jobId,
      ingested,
      errors,
      duration: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })

    return NextResponse.json({
      success: true,
      job: jobId,
      startedAt,
      finishedAt,
      ingested,
      errors,
      ingestErrors: ingestErrors.slice(0, 10), // Limit to first 10 errors
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('European indicators ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        success: false,
        job: jobId,
        error: errorMessage,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}
