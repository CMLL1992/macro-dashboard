/**
 * Investing.com API adapter for PMI data
 * Fetches PMI Composite, Manufacturing, and Services for Eurozone
 * 
 * Note: Investing.com doesn't have a public API, so we use their data export feature
 * or scrape their economic calendar. For production, consider using a service like
 * RapidAPI's Investing.com wrapper or similar.
 * 
 * Alternative: Use S&P Global PMI data via FRED or direct API if available.
 */

import type { MacroSeries } from '@/lib/types/macro'
import { fetchWithTimeout } from '@/lib/utils/http'
import { sortAscByDate } from '@/lib/utils/time'

const INVESTING_BASE = 'https://www.investing.com'

export type PMIType = 'composite' | 'manufacturing' | 'services'

/**
 * Fetch PMI data from Investing.com
 * 
 * WARNING: This is a placeholder implementation.
 * Investing.com doesn't have a public API, so this would require:
 * 1. Using a third-party service (RapidAPI, ScraperAPI, etc.)
 * 2. Web scraping (may violate ToS)
 * 3. Using alternative sources (S&P Global direct, FRED, etc.)
 * 
 * For now, this function throws an error indicating that an alternative source should be used.
 * 
 * @param type PMI type: composite, manufacturing, or services
 * @param country Country code (default: 'eurozone')
 * @returns MacroSeries with PMI data
 */
export async function fetchInvestingPMI(
  type: PMIType,
  country: string = 'eurozone'
): Promise<MacroSeries> {
  // TODO: Implement actual fetching from Investing.com
  // Options:
  // 1. Use RapidAPI Investing.com wrapper
  // 2. Use S&P Global PMI API directly (if available)
  // 3. Use FRED alternative series (BSCICP02EZM460S, BVCICP02EZM460S)
  // 4. Web scraping (not recommended, may violate ToS)
  
  throw new Error(
    `Investing.com PMI fetching not yet implemented. ` +
    `Please use alternative source: FRED series BSCICP02EZM460S (Manufacturing) or ` +
    `BVCICP02EZM460S (Services), or S&P Global PMI API if available.`
  )
}

/**
 * Alternative: Fetch PMI from FRED (Business Confidence Indicators)
 * These are close alternatives to PMI for Eurozone
 */
export async function fetchPMIFromFRED(
  type: PMIType
): Promise<MacroSeries> {
  const { fetchFredSeries } = await import('@/lib/fred')
  
  // FRED series that approximate PMI for Eurozone
  const seriesMap: Record<PMIType, string> = {
    manufacturing: 'BSCICP02EZM460S', // Business Tendency Surveys (Manufacturing): Confidence Indicators
    services: 'BVCICP02EZM460S', // Business Tendency Surveys: Composite Business Confidence: Economic Activity: Services
    composite: 'BSCICP02EZM460S', // Use Manufacturing as composite proxy (or calculate average)
  }

  const seriesId = seriesMap[type]
  if (!seriesId) {
    throw new Error(`Unknown PMI type: ${type}`)
  }

  const observations = await fetchFredSeries(seriesId, {
    observation_start: '2010-01-01',
    observation_end: new Date().toISOString().slice(0, 10),
    frequency: 'm',
  })

  if (observations.length === 0) {
    throw new Error(`No observations returned from FRED for ${seriesId}`)
  }

  return {
    id: `FRED_PMI_${type.toUpperCase()}`,
    source: 'FRED',
    indicator: seriesId,
    nativeId: seriesId,
    name: `PMI ${type.charAt(0).toUpperCase() + type.slice(1)} (Eurozone) - FRED Alternative`,
    frequency: 'M',
    data: observations.map(obs => ({
      date: obs.date,
      value: obs.value,
    })),
    lastUpdated: observations[observations.length - 1]?.date,
    meta: {
      series_id: seriesId,
      note: 'FRED Business Confidence Indicator as PMI alternative',
    },
  }
}


