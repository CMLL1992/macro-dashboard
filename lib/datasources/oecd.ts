/**
 * OECD (Organisation for Economic Co-operation and Development) data adapter
 * Fetches macroeconomic indicators from OECD API
 * Documentation: https://stats.oecd.org/
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'

const DEFAULT_REVALIDATE_HOURS = 6
const OECD_BASE_URL = 'https://stats.oecd.org/SDMX-JSON/data'

export interface OECDSeriesParams {
  dataset: string // e.g., 'MEI', 'KEI', 'SNA_TABLE1'
  filter: string // e.g., 'USA.CPI.TOT.IDX2015.M' (country.indicator.measure.frequency)
  startPeriod?: string // Optional start period (e.g., '2020-01')
  endPeriod?: string // Optional end period (e.g., '2024-12')
}

/**
 * Map OECD frequency codes to our Frequency type
 */
function mapOECDFrequency(freq: string | undefined): Frequency {
  if (!freq) return 'A'
  
  const mapping: Record<string, Frequency> = {
    A: 'A', // Annual
    Q: 'Q', // Quarterly
    M: 'M', // Monthly
    D: 'D', // Daily
  }
  
  return mapping[freq.toUpperCase()] || 'A'
}

/**
 * Parse OECD date format (e.g., "2020-Q1", "2020-01", "2020")
 */
function parseOECDDate(dateStr: string, frequency: Frequency): string {
  if (frequency === 'Q') {
    // Format: "2020-Q1" -> "2020-03-31"
    const match = dateStr.match(/^(\d{4})-Q(\d)$/)
    if (match) {
      const year = parseInt(match[1])
      const quarter = parseInt(match[2])
      const month = quarter * 3
      return `${year}-${month.toString().padStart(2, '0')}-01`
    }
  } else if (frequency === 'M') {
    // Format: "2020-01" -> "2020-01-01"
    const match = dateStr.match(/^(\d{4})-(\d{2})$/)
    if (match) {
      return `${match[1]}-${match[2]}-01`
    }
  } else if (frequency === 'A') {
    // Format: "2020" -> "2020-12-31"
    const match = dateStr.match(/^(\d{4})$/)
    if (match) {
      return `${match[1]}-12-31`
    }
  }
  
  // Fallback: try to parse as ISO date
  return dateStr
}

/**
 * Fetch an OECD series
 * @param params Dataset, filter, and optional date range
 * @returns MacroSeries with normalized data
 */
export async function fetchOECDSeries(params: OECDSeriesParams): Promise<MacroSeries> {
  const { dataset, filter, startPeriod, endPeriod } = params

  if (!dataset || !filter) {
    throw new Error('OECD: dataset and filter are required')
  }

  // Build OECD API URL
  // Format: https://stats.oecd.org/SDMX-JSON/data/{dataset}/{filter}
  // Example: https://stats.oecd.org/SDMX-JSON/data/MEI/USA.CPI.TOT.IDX2015.M
  let url = `${OECD_BASE_URL}/${dataset}/${filter}`
  
  // Add date range if provided
  const queryParams: string[] = []
  if (startPeriod) {
    queryParams.push(`startTime=${encodeURIComponent(startPeriod)}`)
  }
  if (endPeriod) {
    queryParams.push(`endTime=${encodeURIComponent(endPeriod)}`)
  }
  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`
  }

  const response = await withRetry(async () => {
    const res = await fetchWithTimeout(url, {
      revalidateHours: DEFAULT_REVALIDATE_HOURS,
    })
    if (!res.ok) {
      throw new Error(`OECD ${res.status}: ${res.statusText} - ${url}`)
    }
    return res
  })

  const json = await response.json()

  // Parse OECD SDMX-JSON structure
  // Structure: { dataSets: [{ series: [{ observations: {...} }] }], structure: {...} }
  if (!json.dataSets || !Array.isArray(json.dataSets) || json.dataSets.length === 0) {
    throw new Error('OECD: No data sets found in response')
  }

  const dataSet = json.dataSets[0]
  if (!dataSet.series || !Array.isArray(dataSet.series) || dataSet.series.length === 0) {
    throw new Error('OECD: No series found in data set')
  }

  // Get the first series (usually there's only one for a specific filter)
  const series = dataSet.series[0]
  const observations = series.observations || {}

  // Extract dimension values to map observation indices to dates
  // OECD uses dimension indices that need to be mapped via the structure
  const structure = json.structure
  const dimensions = structure?.dimensions?.observation || []
  
  // Find time dimension
  const timeDimension = dimensions.find((dim: any) => dim.id === 'TIME_PERIOD' || dim.id === 'TIME')
  if (!timeDimension) {
    throw new Error('OECD: Time dimension not found in structure')
  }

  // Extract time periods from dimension values
  const timeValues = timeDimension.values || []
  
  // Determine frequency from filter or structure
  // Filter format: COUNTRY.INDICATOR.MEASURE.FREQUENCY
  const filterParts = filter.split('.')
  const frequencyCode = filterParts[filterParts.length - 1] || 'M'
  const frequency = mapOECDFrequency(frequencyCode)

  // Build data points
  const data: Array<{ date: string; value: number }> = []
  
  for (const [indexStr, valueArr] of Object.entries(observations)) {
    const index = parseInt(indexStr)
    if (isNaN(index) || index >= timeValues.length) continue
    
    const timeValue = timeValues[index]
    if (!timeValue || !timeValue.id) continue
    
    const dateStr = parseOECDDate(timeValue.id, frequency)
    const value = Array.isArray(valueArr) ? valueArr[0] : valueArr
    
    if (typeof value === 'number' && !isNaN(value)) {
      data.push({
        date: normalizeDateByFreq(dateStr, frequency),
        value,
      })
    }
  }

  // Sort by date ascending
  sortAscByDate(data)

  if (data.length === 0) {
    throw new Error('OECD: No valid observations found')
  }

  // Extract series name from structure
  const seriesName = structure?.name || `${dataset} ${filter}`

  return {
    id: `OECD:${dataset}:${filter}`,
    source: 'OECD',
    indicator: filter,
    nativeId: `${dataset}/${filter}`,
    name: seriesName,
    frequency,
    data,
    lastUpdated: data[data.length - 1]?.date,
  }
}









