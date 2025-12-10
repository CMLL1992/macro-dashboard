/**
 * Fallback data source utilities
 * Attempts to fetch data from multiple sources as backup
 */

import type { MacroSeries } from '@/lib/types/macro'
import { fetchFredSeries } from '@/lib/fred'
import { fetchOECDSeries } from './oecd'
import { fetchDBnomicsSeries } from './dbnomics'
import { logger } from '@/lib/obs/logger'

export interface FallbackSource {
  name: string
  fetch: () => Promise<MacroSeries | null>
}

/**
 * Try multiple sources in order until one succeeds
 */
export async function fetchWithFallback(
  seriesId: string,
  sources: FallbackSource[]
): Promise<MacroSeries | null> {
  for (const source of sources) {
    try {
      logger.info(`Attempting to fetch ${seriesId} from ${source.name}`)
      const result = await source.fetch()
      if (result && result.data.length > 0) {
        logger.info(`Successfully fetched ${seriesId} from ${source.name}`, {
          points: result.data.length,
          lastUpdated: result.lastUpdated,
        })
        return result
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn(`Failed to fetch ${seriesId} from ${source.name}`, {
        error: errorMsg,
      })
      continue
    }
  }

  logger.error(`All sources failed for ${seriesId}`)
  return null
}

/**
 * Create fallback sources for a FRED series
 */
export function createFredFallbackSources(
  seriesId: string,
  frequency: 'd' | 'm' | 'q',
  observationStart: string = '2010-01-01',
  observationEnd?: string,
  units?: string // Add units parameter for FRED transforms (pc1, pca, etc.)
): FallbackSource[] {
  const endDate = observationEnd || new Date().toISOString().slice(0, 10)

  const sources: FallbackSource[] = [
    // Primary: FRED
    {
      name: 'FRED',
      fetch: async () => {
        const observations = await fetchFredSeries(seriesId, {
          frequency,
          observation_start: observationStart,
          observation_end: endDate,
          units, // Use units parameter if provided (for pc1, pca, etc.)
        })
        if (observations.length === 0) return null

        return {
          id: seriesId,
          source: 'FRED',
          indicator: seriesId,
          nativeId: seriesId,
          name: seriesId,
          frequency: frequency === 'd' ? 'D' : frequency === 'm' ? 'M' : 'Q',
          data: observations.map(obs => ({
            date: obs.date,
            value: obs.value,
          })),
          lastUpdated: observations[observations.length - 1]?.date,
        }
      },
    },
  ]

  // Add DBnomics fallback for common FRED series
  // DBnomics has FRED data as a provider (format: provider/series)
  if (['GDPC1', 'CPIAUCSL', 'CPILFESL', 'UNRATE', 'PAYEMS', 'FEDFUNDS'].includes(seriesId)) {
    sources.push({
      name: 'DBnomics (FRED)',
      fetch: async () => {
        return await fetchDBnomicsSeries({
          provider: 'FRED',
          series: seriesId,
        })
      },
    })
  }

  // Add OECD fallback for specific indicators
  if (seriesId === 'CPIAUCSL' || seriesId === 'CPILFESL') {
    sources.push({
      name: 'OECD',
      fetch: async () => {
        return await fetchOECDSeries({
          dataset: 'MEI',
          filter: 'USA.CPI.TOT.IDX2015.M',
        })
      },
    })
  }

  return sources
}
