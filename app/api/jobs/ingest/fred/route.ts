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

  const jobId = 'ingest_fred'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting FRED data ingestion', { job: jobId })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ seriesId?: string; error: string }> = []
    const seriesTimings: Array<{ seriesId: string; durationMs: number; success: boolean }> = []

    // Forzar reingesta completa temporalmente para rellenar histórico y "dato anterior"
    const FORCE_FULL_REINGEST = true

    // Pre-fetch all last dates from DB in a single query to optimize (still useful for logging)
    const db = getUnifiedDB()
    let lastDatesMap = new Map<string, string | null>()
    try {
      const seriesIds = FRED_SERIES.map(s => s.id)
      const placeholders = seriesIds.map(() => '?').join(',')
      const result = await db.prepare(
        `SELECT series_id, MAX(date) as max_date FROM macro_observations WHERE series_id IN (${placeholders}) GROUP BY series_id`
      ).all(...seriesIds) as Array<{ series_id: string; max_date: string | null }>
      
      for (const row of result) {
        lastDatesMap.set(row.series_id, row.max_date)
      }
      logger.info('Pre-fetched last dates from DB', { job: jobId, count: lastDatesMap.size })
    } catch (err) {
      logger.warn('Could not pre-fetch last dates, will query individually', { job: jobId, error: String(err) })
    }

    for (const series of FRED_SERIES) {
      const seriesStartTime = Date.now()
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

        const newPoints = (FORCE_FULL_REINGEST || !lastDateInDb)
          ? macroSeries.data
          : macroSeries.data.filter((p: { date: string; value: number }) => p.date > lastDateInDb)

        const seriesDurationMs = Date.now() - seriesStartTime
        logger.info(`[${series.id}] Fetch completed`, {
          job: jobId,
          series_id: series.id,
          durationMs: seriesDurationMs,
          totalPoints: macroSeries.data.length,
          newPoints: newPoints.length,
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
    }

    // Ingest PMI Manufacturing from alternative sources (not available in FRED)
    // Try Alpha Vantage -> Manual entry (TradingEconomics removed for USA)
    let pmiIngested = false
    let pmiError: string | null = null
    
    // Source: Alpha Vantage (if available)
    if (!pmiIngested && process.env.ALPHA_VANTAGE_API_KEY) {
      try {
        logger.info('Attempting PMI ingestion from Alpha Vantage', { job: jobId })
        const { fetchAlphaVantagePMI } = await import('@/packages/ingestors/alphavantage')
        
        const pmiObservations = await fetchAlphaVantagePMI(process.env.ALPHA_VANTAGE_API_KEY)
        
        if (pmiObservations.length > 0) {
          const pmiSeries: MacroSeries = {
            id: 'USPMI',
            source: 'ALPHA_VANTAGE',
            indicator: 'USPMI',
            nativeId: 'MANUFACTURING_PMI',
            name: 'ISM Manufacturing: PMI',
            frequency: 'M', // Monthly
            data: pmiObservations.map(obs => ({
              date: obs.date,
              value: obs.value,
            })),
            lastUpdated: pmiObservations[pmiObservations.length - 1]?.date || undefined,
          }

          await upsertMacroSeries(pmiSeries)
          ingested++
          pmiIngested = true
          
          logger.info('Ingested USPMI from Alpha Vantage', {
            job: jobId,
            series_id: 'USPMI',
            points: pmiObservations.length,
          })
        }
      } catch (error) {
        const avError = error instanceof Error ? error.message : String(error)
        logger.warn('Alpha Vantage PMI ingestion failed', {
          job: jobId,
          error: avError,
        })
        if (!pmiError) pmiError = avError
      }
    }
    
    // Log final status
    if (!pmiIngested) {
      errors++
      const finalError = pmiError || 'No PMI data sources available or all sources failed'
      ingestErrors.push({ seriesId: 'USPMI', error: finalError })
      logger.warn('PMI ingestion failed from all sources. Manual entry may be required.', {
        job: jobId,
        series_id: 'USPMI',
        error: finalError,
      })
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    // Log timing summary
    const totalSeriesTime = seriesTimings.reduce((sum, t) => sum + t.durationMs, 0)
    const avgSeriesTime = seriesTimings.length > 0 ? totalSeriesTime / seriesTimings.length : 0
    const slowestSeries = seriesTimings.sort((a, b) => b.durationMs - a.durationMs)[0]
    
    logger.info('FRED ingestion completed', {
      job: jobId,
      ingested,
      errors,
      durationMs,
      totalSeriesTime,
      avgSeriesTime: Math.round(avgSeriesTime),
      slowestSeries: slowestSeries ? { id: slowestSeries.seriesId, durationMs: slowestSeries.durationMs } : null,
      seriesTimings: seriesTimings.slice(0, 5), // Log top 5 slowest
    })

    // Save ingest history
    try {
      await saveIngestHistory({
        jobType: 'ingest_fred',
        updatedSeriesCount: ingested,
        errorsCount: errors,
        durationMs,
        errors: ingestErrors.length > 0 ? ingestErrors : undefined,
        finishedAt,
      })
    } catch (error) {
      logger.error('Failed to save ingest history', { job: jobId, error })
    }

    // Check macro release alerts (Trigger C) - Only if we have time (< 250s elapsed)
    // Skip if we're running out of time to avoid timeout
    const timeElapsed = Date.now() - new Date(startedAt).getTime()
    const TIME_LIMIT_MS = 250 * 1000 // 250 seconds (leave 50s buffer)
    
    if (timeElapsed < TIME_LIMIT_MS) {
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
      logger.warn('Skipping macro release alerts check due to time limit', {
        job: jobId,
        timeElapsed,
        timeLimit: TIME_LIMIT_MS,
      })
    }

    return NextResponse.json({
      success: true,
      ingested,
      errors,
      duration_ms: durationMs,
      finishedAt,
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

