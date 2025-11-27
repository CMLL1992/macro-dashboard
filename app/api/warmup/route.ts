export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getMacroDiagnosis } from '@/domain/diagnostic'
import { getCorrelations } from '@/domain/corr-dashboard'
import { fetchFredSeries } from '@/lib/fred'
import { upsertMacroSeries, saveIngestHistory } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { ensureNotificationsInitialized } from '@/lib/notifications/init'
import { getInitializationStatus } from '@/lib/notifications/init'

// FRED series IDs used by the dashboard (same as /api/jobs/ingest/fred)
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

export async function GET() {
  const startedAt = Date.now()
  const errors: Array<{ seriesId?: string; error: string }> = []
  let updatedSeriesCount = 0

  console.log('[warmup] start')

  // Step 1: Ingest FRED data
  try {
    console.log('[warmup] ingesting FRED data...')
    
    for (const series of FRED_SERIES) {
      try {
        // No usar observation_end para obtener los datos más recientes disponibles
        const observations = await fetchFredSeries(series.id, {
          frequency: series.frequency as 'd' | 'm' | 'q',
          observation_start: '2010-01-01',
          // No especificar observation_end para obtener datos hasta la fecha más reciente disponible
        })

        if (observations.length === 0) {
          console.warn(`[warmup] No observations for ${series.id}`)
          continue
        }

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

        await upsertMacroSeries(macroSeries)
        updatedSeriesCount++

        console.log(`[warmup] ingested ${series.id} (${observations.length} points)`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push({ seriesId: series.id, error: errorMsg })
        console.error(`[warmup] failed to ingest ${series.id}:`, errorMsg)
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push({ error: `FRED ingestion failed: ${errorMsg}` })
    console.error('[warmup] FRED ingestion error:', error)
  }

  // Step 2: Update notifications status (initialize if needed)
  try {
    console.log('[warmup] updating notifications status...')
    await ensureNotificationsInitialized()
    const initStatus = getInitializationStatus()
    console.log('[warmup] notifications initialized:', initStatus.initialized)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push({ error: `Notifications status update failed: ${errorMsg}` })
    console.error('[warmup] notifications status error:', error)
  }

  // Step 3: Warm up diagnostic and correlations (non-blocking)
  try {
    await getMacroDiagnosis()
    console.log('[warmup] macro diagnosis warmed up')
  } catch (e) {
    console.error('[warmup] macro diagnosis error:', e)
  }

  try {
    await getCorrelations()
    console.log('[warmup] correlations warmed up')
  } catch (e) {
    console.error('[warmup] correlations error:', e)
  }

  const finishedAt = new Date().toISOString()
  const durationMs = Date.now() - startedAt
  const errorsCount = errors.length

  // Save ingest history
  try {
    saveIngestHistory({
      jobType: 'warmup',
      updatedSeriesCount,
      errorsCount,
      durationMs,
      errors: errors.length > 0 ? errors : undefined,
      finishedAt,
    })
  } catch (error) {
    console.error('[warmup] failed to save ingest history:', error)
  }

  console.log('[warmup] done', {
    updatedSeriesCount,
    durationMs,
    errorsCount,
  })

  return Response.json({
    ok: true,
    updatedSeriesCount,
    durationMs,
    finishedAt,
    errors: errors.length > 0 ? errors : [],
  })
}


