/**
 * Eurostat API adapter
 * Fetches data from Eurostat REST API
 * Documentation: https://ec.europa.eu/eurostat/web/json-and-unicode-web-services
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'

const EUROSTAT_BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data'

export interface EurostatParams {
  dataset: string // e.g., 'nama_10_gdp', 'sts_inpr_m', 'sts_trtu_m'
  filters?: Record<string, string> // e.g., { unit: 'CP_MEUR', s_adj: 'SA' }
  geo?: string // e.g., 'EA19' for Euro Area 19
  frequency?: Frequency
}

/**
 * Fetch data from Eurostat API
 * @param params Dataset code, filters, and geographic area
 * @returns MacroSeries with normalized data
 */
export async function fetchEurostatSeries(
  params: EurostatParams
): Promise<MacroSeries> {
  const { dataset, filters = {}, geo = 'EA19', frequency = 'Q' } = params

  // Build filter string: unit=CP_MEUR&s_adj=SA&geo=EA19&freq=Q&na_item=B1GQ
  const filterParams = new URLSearchParams()
  if (geo) {
    filterParams.set('geo', geo)
  }
  // Add all filters (freq, na_item, s_adj, unit, etc.)
  Object.entries(filters).forEach(([key, value]) => {
    filterParams.set(key, value)
  })

  // Eurostat API format: ?format=JSON&lang=en&geo=EA20&freq=Q&na_item=B1GQ&s_adj=SA&unit=CLV_PCH_PRE
  const url = `${EUROSTAT_BASE}/${dataset}?format=JSON&lang=en&${filterParams.toString()}`

  let response: Response
  try {
    response = await withRetry(async () => {
      const res = await fetchWithTimeout(url, { timeoutMs: 20000 })
      if (!res.ok) {
        throw new Error(`Eurostat ${res.status}: ${res.statusText} - ${url}`)
      }
      return res
    }, 3)
  } catch (error) {
    // If error is 400 and geo is EA20, try fallback to EA19
    if (geo === 'EA20' && error instanceof Error && error.message.includes('400')) {
      console.log(`[Eurostat] EA20 failed, trying EA19 fallback for ${dataset}`)
      const fallbackParams = { ...params, geo: 'EA19' }
      return fetchEurostatSeries(fallbackParams)
    }
    throw new Error(`Failed to fetch Eurostat data: ${error instanceof Error ? error.message : String(error)}`)
  }

  const json = await response.json()

  // Eurostat JSON structure:
  // {
  //   "value": { "0": 123.45, "1": 234.56, ... },
  //   "dimension": {
  //     "time": { "category": { "index": { "2020-Q1": 0, "2020-Q2": 1, ... } } },
  //     "geo": { "category": { "index": { "EA19": 0, ... } } },
  //     ...
  //   },
  //   "status": { "0": "", "1": "e", ... }
  // }

  if (!json.value || !json.dimension) {
    return {
      id: `EUROSTAT:${dataset}`,
      source: 'EUROSTAT',
      indicator: dataset,
      nativeId: dataset,
      name: dataset,
      frequency,
      data: [],
      meta: {
        reason: 'NO_DATA',
        url,
      },
    }
  }

  // Extract time dimension
  const timeDim = json.dimension?.time?.category
  if (!timeDim || !timeDim.index) {
    return {
      id: `EUROSTAT:${dataset}`,
      source: 'EUROSTAT',
      indicator: dataset,
      nativeId: dataset,
      name: json.label || dataset,
      frequency,
      data: [],
      meta: {
        reason: 'NO_TIME_DIMENSION',
        url,
      },
    }
  }

  // Get time labels (keys of timeDim.index)
  const timeLabels = Object.keys(timeDim.index).sort()

  // Extract values
  const values = json.value || {}
  const status = json.status || {}

  // Map to DataPoint format
  // Eurostat uses index-based values: value["0"] = first observation
  // The index maps time labels to array positions
  const dataPoints = timeLabels
    .map((timeLabel) => {
      const timeIndex = timeDim.index[timeLabel]
      const valueKey = String(timeIndex)
      const value = values[valueKey]
      const stat = status[valueKey] || ''

      // Skip if value is null, undefined, or marked as estimated/provisional with 'e' or 'p'
      // But include if it's a valid number
      if (value == null || value === '') {
        return null
      }

      const numValue = Number(value)
      if (!Number.isFinite(numValue)) {
        return null
      }

      // Normalize date based on frequency
      // Eurostat dates: "2020-Q1", "2020-01", "2020"
      let normalizedDate: string
      if (timeLabel.includes('Q')) {
        // Quarterly: "2020-Q1" -> "2020-01-01" (first day of quarter)
        const [year, quarter] = timeLabel.split('-Q')
        const month = (parseInt(quarter) - 1) * 3 + 1
        normalizedDate = `${year}-${String(month).padStart(2, '0')}-01`
      } else if (timeLabel.match(/^\d{4}-\d{2}$/)) {
        // Monthly: "2020-01" -> "2020-01-01"
        normalizedDate = `${timeLabel}-01`
      } else if (timeLabel.match(/^\d{4}$/)) {
        // Annual: "2020" -> "2020-01-01"
        normalizedDate = `${timeLabel}-01-01`
      } else {
        // Try to parse as ISO date
        normalizedDate = normalizeDateByFreq(timeLabel, frequency)
      }

      return {
        date: normalizedDate,
        value: numValue,
      }
    })
    .filter((dp): dp is { date: string; value: number } => dp !== null)

  // Sort by date ascending
  const sortedData = sortAscByDate(dataPoints)

  // Get dataset name from JSON-stat label if available
  const datasetName = json.label || dataset

  return {
    id: `EUROSTAT:${dataset}`,
    source: 'EUROSTAT',
    indicator: dataset,
    nativeId: dataset,
    name: datasetName,
    frequency,
    data: sortedData,
    lastUpdated: sortedData.length > 0 ? sortedData[sortedData.length - 1].date : undefined,
    meta: {
      url,
      totalPoints: sortedData.length,
      geo,
      filters,
    },
  }
}

/**
 * Fetch GDP from Eurostat (nama_10_gdp)
 * @param geo Geographic area (default: 'EA19' for Euro Area 19)
 * @returns MacroSeries with GDP data
 */
export async function fetchEurostatGDP(geo: string = 'EA19'): Promise<MacroSeries> {
  return fetchEurostatSeries({
    dataset: 'nama_10_gdp',
    filters: {
      unit: 'CP_MEUR', // Chain linked volumes, reference year 2015, million euro
      s_adj: 'SA', // Seasonally adjusted
    },
    geo,
    frequency: 'Q',
  })
}

/**
 * Fetch Industrial Production from Eurostat (sts_inpr_m)
 * @param geo Geographic area (default: 'EA19')
 * @returns MacroSeries with Industrial Production data
 */
export async function fetchEurostatIndustrialProduction(geo: string = 'EA19'): Promise<MacroSeries> {
  return fetchEurostatSeries({
    dataset: 'sts_inpr_m',
    filters: {
      unit: 'I15', // Index, 2015=100
      s_adj: 'SA', // Seasonally adjusted
      nace_r2: 'B-D', // Industry (except construction)
    },
    geo,
    frequency: 'M',
  })
}

/**
 * Fetch Retail Sales from Eurostat (sts_trtu_m)
 * @param geo Geographic area (default: 'EA19')
 * @returns MacroSeries with Retail Sales data
 */
export async function fetchEurostatRetailSales(geo: string = 'EA19'): Promise<MacroSeries> {
  return fetchEurostatSeries({
    dataset: 'sts_trtu_m',
    filters: {
      unit: 'I15', // Index, 2015=100
      s_adj: 'SA', // Seasonally adjusted
      nace_r2: 'G47', // Retail trade
    },
    geo,
    frequency: 'M',
  })
}
