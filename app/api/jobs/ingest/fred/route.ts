/**
 * Job: Ingest FRED data into SQLite
 * POST /api/jobs/ingest/fred
 * Protected by CRON_TOKEN
 * 
 * Ingests all FRED indicators used by the dashboard into macro_observations
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { fetchFredSeries } from '@/lib/fred'
import { getUnifiedDB } from '@/lib/db/unified-db'
import { upsertMacroSeries, saveIngestHistory } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { checkMacroReleases } from '@/lib/alerts/triggers'
import { getAllIndicatorHistories } from '@/lib/db/read'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { KEY_TO_SERIES_ID } from '@/lib/db/read-macro'
import { fetchTradingEconomics } from '@/packages/ingestors/tradingeconomics'
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
  { id: 'NFIB', name: 'NFIB Small Business Optimism Index', frequency: 'm' },
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

    for (const series of FRED_SERIES) {
      try {
        // Check if this series has a fredTransform configured
        // Find the indicator config that uses this series ID
        let indicatorConfig: any = null
        try {
          const m = await import('@/config/macro-indicators')
          const configs = m.MACRO_INDICATORS_CONFIG as any
          indicatorConfig = Object.values(configs).find((cfg: any) => cfg.fredSeriesId === series.id)
        } catch {
          // Ignore
        }
        
        // Get indicator config synchronously (if available)
        let fredTransform: string | undefined = undefined
        try {
          const { MACRO_INDICATORS_CONFIG } = await import('@/config/macro-indicators')
          const config = Object.values(MACRO_INDICATORS_CONFIG).find((cfg: any) => cfg.fredSeriesId === series.id) as any
          if (config?.fredTransform) {
            fredTransform = config.fredTransform
            logger.info(`[fred/route] Found fredTransform for ${series.id}: ${fredTransform}`, { job: jobId, seriesId: series.id })
          }
        } catch (e) {
          // Ignore if config not available
          logger.warn(`[fred/route] Failed to load config for ${series.id}`, { job: jobId, seriesId: series.id, error: e })
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
            })),
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

        // Check what points are "new" before upserting
        // Get last date in DB for this series
        let lastDateInDb: string | null = null
        try {
          // All methods are async now, so always use await
          const db = getUnifiedDB()
          const result = await db.prepare(
            `SELECT MAX(date) as max_date FROM macro_observations WHERE series_id = ?`
          ).get(series.id) as { max_date: string | null } | undefined
          lastDateInDb = result?.max_date || null
        } catch (err) {
          logger.warn(`Could not get last date for ${series.id}`, { error: String(err) })
        }

        const newPoints = lastDateInDb
          ? macroSeries.data.filter((p) => p.date > lastDateInDb!)
          : macroSeries.data

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
        await upsertMacroSeries(macroSeries)
        ingested++

        logger.info(`Ingested ${series.id}`, {
          job: jobId,
          series_id: series.id,
          points: macroSeries.data.length,
        })
      } catch (error) {
        errors++
        const errorMsg = error instanceof Error ? error.message : String(error)
        ingestErrors.push({ seriesId: series.id, error: errorMsg })
        logger.error(`Failed to ingest ${series.id}`, {
          job: jobId,
          series_id: series.id,
          error: errorMsg,
        })
      }
    }

    // Ingest PMI Manufacturing from alternative sources (not available in FRED)
    // Try multiple sources in order: Trading Economics -> Alpha Vantage -> Manual entry
    let pmiIngested = false
    let pmiError: string | null = null
    
    // Source 1: Trading Economics
    if (!pmiIngested) {
      try {
        const teApiKey = process.env.TRADING_ECONOMICS_API_KEY || '3EE47420-8691-4DE1-AF46-32283925D96C'
        
        if (teApiKey !== 'guest:guest') {
          logger.info('Attempting PMI ingestion from Trading Economics', { job: jobId })
          
          const pmiObservations = await fetchTradingEconomics('united-states/manufacturing-pmi', teApiKey)
        
          if (pmiObservations.length > 0) {
            const reversedObservations = [...pmiObservations].reverse()
            
            const pmiSeries: MacroSeries = {
              id: 'USPMI',
              source: 'TRADING_ECONOMICS',
              indicator: 'USPMI',
              nativeId: 'united-states/manufacturing-pmi',
              name: 'ISM Manufacturing: PMI',
              frequency: 'M', // Monthly
              data: reversedObservations.map(obs => ({
                date: obs.date,
                value: obs.value,
              })),
              lastUpdated: reversedObservations[reversedObservations.length - 1]?.date || undefined,
            }

            await upsertMacroSeries(pmiSeries)
            ingested++
            pmiIngested = true
            
            logger.info('Ingested USPMI from Trading Economics', {
              job: jobId,
              series_id: 'USPMI',
              points: pmiObservations.length,
            })
          }
        }
      } catch (error) {
        pmiError = error instanceof Error ? error.message : String(error)
        logger.warn('Trading Economics PMI ingestion failed, will try alternatives', {
          job: jobId,
          error: pmiError,
        })
      }
    }
    
    // Source 2: Alpha Vantage (if available)
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

    logger.info('FRED ingestion completed', {
      job: jobId,
      ingested,
      errors,
      durationMs,
    })

    // Save ingest history
    try {
      saveIngestHistory({
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

    // Check macro release alerts (Trigger C)
    try {
      const diagnosis = await getMacroDiagnosis()
      const histories = getAllIndicatorHistories()
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
      logger.info('Macro release check completed', { job: jobId, count: observationsForAlerts.length })
    } catch (error) {
      logger.error('Failed to check macro release alerts', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
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

