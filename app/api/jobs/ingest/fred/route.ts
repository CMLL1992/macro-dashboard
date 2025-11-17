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
import { getDB } from '@/lib/db/schema'
import { upsertMacroSeries, saveIngestHistory } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { checkMacroReleases } from '@/lib/alerts/triggers'
import { getAllIndicatorHistories } from '@/lib/db/read'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { KEY_TO_SERIES_ID } from '@/lib/db/read-macro'

// FRED series IDs used by the dashboard
const FRED_SERIES = [
  { id: 'CPIAUCSL', name: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', frequency: 'm' },
  { id: 'CPILFESL', name: 'Consumer Price Index for All Urban Consumers: All Items Less Food and Energy in U.S. City Average', frequency: 'm' },
  { id: 'PCEPI', name: 'Personal Consumption Expenditures: Chain-type Price Index', frequency: 'm' },
  { id: 'PCEPILFE', name: 'Personal Consumption Expenditures Excluding Food and Energy (Chain-Type Price Index)', frequency: 'm' },
  { id: 'PPIACO', name: 'Producer Price Index for All Commodities', frequency: 'm' },
  { id: 'GDPC1', name: 'Real Gross Domestic Product', frequency: 'q' },
  { id: 'INDPRO', name: 'Industrial Production Index', frequency: 'm' },
  { id: 'RSXFS', name: 'Advance Retail Sales: Retail Trade', frequency: 'm' },
  { id: 'PAYEMS', name: 'All Employees, Total Nonfarm', frequency: 'm' },
  { id: 'UNRATE', name: 'Unemployment Rate', frequency: 'm' },
  { id: 'ICSA', name: 'Initial Claims', frequency: 'w' },
  { id: 'T10Y2Y', name: '10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity', frequency: 'd' },
  { id: 'FEDFUNDS', name: 'Effective Federal Funds Rate', frequency: 'm' },
  { id: 'VIXCLS', name: 'CBOE Volatility Index: VIX', frequency: 'd' },
]

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
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
        // Fetch from FRED
        const observations = await fetchFredSeries(series.id, {
          frequency: series.frequency as 'd' | 'm' | 'q',
          observation_start: '2010-01-01',
          observation_end: new Date().toISOString().slice(0, 10),
        })

        if (observations.length === 0) {
          logger.warn(`No observations for ${series.id}`, { job: jobId })
          continue
        }

        // Convert to MacroSeries format
        const macroSeries: MacroSeries = {
          id: series.id,
          source: 'FRED',
          indicator: series.id,
          nativeId: series.id,
          name: series.name,
          frequency: series.frequency as any,
          data: observations.map(obs => ({
            date: obs.date,
            value: obs.value,
          })),
          lastUpdated: observations[observations.length - 1]?.date || undefined,
        }

        // Upsert to database (idempotent - no duplicates)
        upsertMacroSeries(macroSeries)
        ingested++

        logger.info(`Ingested ${series.id}`, {
          job: jobId,
          series_id: series.id,
          points: observations.length,
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

