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
  // Add frequency to filters if not present
  if (!filters.freq && frequency) {
    filterParams.set('freq', frequency)
  }
  
  const url = `${EUROSTAT_BASE}/${dataset}?format=JSON&lang=en&${filterParams.toString()}`
  
  // Log the full URL and parameters for debugging
  console.log(`[Eurostat] Fetching: ${url}`)
  console.log(`[Eurostat] Parameters:`, JSON.stringify({ dataset, filters, geo, frequency }, null, 2))

  let response: Response
  try {
    response = await withRetry(async () => {
      const res = await fetchWithTimeout(url, { timeoutMs: 20000 })
      if (!res.ok) {
        const errorBody = await res.text().catch(() => 'Unable to read error response')
        console.error(`[Eurostat] HTTP ${res.status} for ${dataset}:`, {
          url,
          status: res.status,
          statusText: res.statusText,
          errorBody: errorBody.substring(0, 500),
        })
        throw new Error(`Eurostat ${res.status}: ${res.statusText} - ${url}`)
      }
      return res
    }, 3)
  } catch (error) {
    // Try fallback geos if current one fails
    if (error instanceof Error && error.message.includes('400')) {
      const fallbackGeos = geo === 'EA20' ? ['EA19', 'EU27_2020'] : geo === 'EA19' ? ['EA20', 'EU27_2020'] : []
      for (const fallbackGeo of fallbackGeos) {
        console.log(`[Eurostat] ${geo} failed, trying ${fallbackGeo} fallback for ${dataset}`)
        try {
          const fallbackParams = { ...params, geo: fallbackGeo }
          return await fetchEurostatSeries(fallbackParams)
        } catch (fallbackError) {
          console.warn(`[Eurostat] ${fallbackGeo} also failed for ${dataset}:`, fallbackError)
          continue
        }
      }
    }
    throw new Error(`Failed to fetch Eurostat data: ${error instanceof Error ? error.message : String(error)}`)
  }

  const json = await response.json()

  // Log response details for debugging
  const responseSize = JSON.stringify(json).length
  const dimensionKeys = json.dimension ? Object.keys(json.dimension) : []
  const nValues = json.value ? Object.keys(json.value).length : 0
  const hasTimeDim = json.dimension?.time?.category?.index ? Object.keys(json.dimension.time.category.index).length : 0
  
  console.log(`[Eurostat] Response for ${dataset}:`, {
    url,
    status: response.status,
    responseSize,
    dimensionKeys,
    nValues,
    hasTimeDim,
    hasValue: !!json.value,
    hasDimension: !!json.dimension,
  })

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
    console.warn(`[Eurostat] No data returned for ${dataset}`, {
      url,
      hasValue: !!json.value,
      hasDimension: !!json.dimension,
      dimensionKeys,
      nValues,
    })
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
        dimensionKeys,
        nValues,
        responseSize,
      },
    }
  }

  // Extract time dimension
  const timeDim = json.dimension?.time?.category
  if (!timeDim || !timeDim.index) {
    console.warn(`[Eurostat] No time dimension for ${dataset}`, {
      url,
      availableDimensions: Object.keys(json.dimension || {}),
      hasTimeDim: !!json.dimension?.time,
    })
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
        availableDimensions: Object.keys(json.dimension || {}),
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

  console.log(`[Eurostat] Successfully parsed ${dataset}:`, {
    url,
    dataPoints: sortedData.length,
    firstDate: sortedData[0]?.date,
    lastDate: sortedData[sortedData.length - 1]?.date,
  })

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


