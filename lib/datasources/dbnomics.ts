/**
 * DBnomics data adapter
 * Fetches macroeconomic indicators from DBnomics API
 * Documentation: https://docs.db.nomics.world/web-api/
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'

const DEFAULT_REVALIDATE_HOURS = 6
const DBNOMICS_BASE_URL = 'https://api.db.nomics.world/v22'

export interface DBnomicsParams {
  provider: string // e.g., 'FRED', 'IMF', 'ECB', 'Eurostat'
  dataset?: string // Optional dataset code (e.g., 'namq_10_gdp' for Eurostat)
  series: string // e.g., 'GDPC1', 'PCPIPCH.USA.A', or 'Q.CP_MEUR.SCA.B1GQ.EA19' (DBnomics uses provider/dataset/series format)
}

/**
 * Map DBnomics frequency codes to our Frequency type
 */
function mapDBnomicsFrequency(freq: string | undefined): Frequency {
  if (!freq) return 'A'
  
  const mapping: Record<string, Frequency> = {
    annual: 'A',
    quarterly: 'Q',
    monthly: 'M',
    weekly: 'W',
    daily: 'D',
    a: 'A',
    q: 'Q',
    m: 'M',
    w: 'W',
    d: 'D',
  }
  
  return mapping[freq.toLowerCase()] || 'A'
}

/**
 * Fetch a DBnomics series
 * @param params Provider, dataset, and series codes
 * @returns MacroSeries with normalized data
 */
export async function fetchDBnomicsSeries(params: DBnomicsParams): Promise<MacroSeries> {
  const { provider, dataset, series } = params

  if (!provider || !series) {
    throw new Error('DBnomics: provider and series are required')
  }

  // Build DBnomics API URL
  // Format with dataset: https://api.db.nomics.world/v22/series/{provider}/{dataset}/{series_code}
  // Format without dataset: https://api.db.nomics.world/v22/series/{provider}/{series}
  // 
  // Note: If series contains @, it's a notation for dimensions (e.g., "M.PRD.B-D.PCH_M12_CA.EA20@...")
  // The @ is just notation - in the API URL, use the part after @ as the series_code directly
  // Example: "M.PRD.B-D.PCH_M12_CA.EA20" -> series_code = "M.PRD.B-D.PCH_M12_CA.EA20"
  
  // Parse series code: if it contains @, use the part after @ as the actual series code
  let seriesCode = series
  if (series.includes('@')) {
    // Format: dimensions@notation -> use dimensions as series_code
    seriesCode = series.split('@')[0]
  }
  
  // Build URL: provider/dataset/series_code or provider/series_code
  const url = dataset 
    ? `${DBNOMICS_BASE_URL}/series/${provider}/${dataset}/${seriesCode}`
    : `${DBNOMICS_BASE_URL}/series/${provider}/${seriesCode}`

  const response = await withRetry(async () => {
    const res = await fetchWithTimeout(url, {
      revalidateHours: DEFAULT_REVALIDATE_HOURS,
    })
    if (!res.ok) {
      throw new Error(`DBnomics ${res.status}: ${res.statusText} - ${url}`)
    }
    return res
  })

  const json = await response.json()

  // DBnomics response structure
  if (!json?.series?.docs || !Array.isArray(json.series.docs) || json.series.docs.length === 0) {
    throw new Error(`DBnomics: Invalid response format - no series found`)
  }

  const seriesDoc = json.series.docs[0]

  // Extract metadata
  const name = seriesDoc?.name || seriesDoc?.title || `${provider}/${dataset}/${series}`
  const frequency = mapDBnomicsFrequency(seriesDoc?.frequency)

  // Extract values
  const values = seriesDoc?.values || []
  if (values.length === 0) {
    throw new Error(`DBnomics: No values found in series`)
  }

  // Build data points
  const dataPoints: Array<{ date: string; value: number }> = []

  for (const value of values) {
    const period = value.period
    const val = value.value

    if (period && typeof val === 'number' && !isNaN(val)) {
      const normalizedDate = normalizeDateByFreq(period, frequency)
      dataPoints.push({
        date: normalizedDate,
        value: val,
      })
    }
  }

  // Sort by date ascending
  const sortedData = sortAscByDate(dataPoints)

  // Build proper ID: use dataset if provided, otherwise just provider/series
  const id = dataset 
    ? `DBNOMICS:${provider}:${dataset}:${series}`
    : `DBNOMICS:${provider}:${series}`

  // Get last updated date
  const lastUpdated = sortedData.length > 0
    ? sortedData[sortedData.length - 1].date
    : undefined

  return {
    id,
    source: 'DBNOMICS',
    indicator: series,
    nativeId: dataset ? `${provider}/${dataset}/${series}` : `${provider}/${series}`,
    name,
    frequency,
    data: sortedData,
    lastUpdated,
    meta: {
      provider,
      dataset: dataset || undefined,
      series,
    },
  }
}

/**
 * Common DBnomics providers
 */
export const DBNOMICS_PROVIDERS = {
  FRED: 'FRED',
  IMF: 'IMF',
  ECB: 'ECB',
  OECD: 'OECD',
  WORLD_BANK: 'WB',
  BIS: 'BIS',
} as const

/**
 * Example series for common indicators
 */
export const DBNOMICS_SERIES = {
  // FRED GDP
  FRED_GDP: {
    provider: 'FRED',
    series: 'GDPC1',
  },
  // FRED CPI
  FRED_CPI: {
    provider: 'FRED',
    series: 'CPIAUCSL',
  },
  // IMF CPI (format: provider/series)
  IMF_CPI: {
    provider: 'IMF',
    series: 'IFS.PCPIPCH.USA.A',
  },
} as const
