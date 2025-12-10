/**
 * Econdify data adapter
 * Fetches economic indicators from Econdify API
 * Documentation: https://www.econdify.com/
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'

const ECONDIFY_BASE_URL = 'https://www.econdify.com/api/json'

export interface EcondifyParams {
  country: string // e.g., 'EZ' for Eurozone
  indicator: string // e.g., 'Economic_Sentiment'
}

/**
 * Fetch data from Econdify API
 */
export async function fetchEcondifySeries(params: EcondifyParams): Promise<MacroSeries> {
  const { country, indicator } = params

  if (!country || !indicator) {
    throw new Error('Econdify: country and indicator are required')
  }

  const url = `${ECONDIFY_BASE_URL}/${country}/${indicator}`

  const response = await withRetry(async () => {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 10000,
    })
    if (!res.ok) {
      throw new Error(`Econdify ${res.status}: ${res.statusText} - ${url}`)
    }
    return res
  })

  const json = await response.json()

  // Econdify returns data in format: { dates: [...], values: [...], source: "..." }
  if (!json || typeof json !== 'object' || !Array.isArray(json.dates) || !Array.isArray(json.values)) {
    throw new Error(`Econdify: Invalid response format - expected {dates: [], values: []}`)
  }

  const { dates, values } = json

  if (dates.length !== values.length) {
    throw new Error(`Econdify: dates and values arrays have different lengths`)
  }

  // Convert to data points
  const dataPoints: Array<{ date: string; value: number }> = []

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i]
    const value = values[i]

    if (typeof value === 'number' && !isNaN(value) && dateStr) {
      // Econdify dates are in format "MM/DD/YYYY" or "DD/MM/YYYY"
      // Convert to YYYY-MM-DD
      let normalizedDate: string
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        if (parts.length === 3) {
          // Assume format is MM/DD/YYYY
          const month = parts[0].padStart(2, '0')
          const day = parts[1].padStart(2, '0')
          const year = parts[2]
          normalizedDate = `${year}-${month}-${day}`
        } else {
          continue
        }
      } else {
        normalizedDate = dateStr.slice(0, 10) // Already in YYYY-MM-DD format
      }

      dataPoints.push({
        date: normalizedDate,
        value: value,
      })
    }
  }

  if (dataPoints.length === 0) {
    throw new Error(`Econdify: No valid values found`)
  }

  // Sort by date ascending
  const sortedData = sortAscByDate(dataPoints)

  // Determine frequency (assume monthly for Economic Sentiment)
  const frequency: Frequency = 'M'

  return {
    id: `ECONDIFY:${country}:${indicator}`,
    source: 'ECONDIFY',
    indicator: indicator,
    nativeId: `${country}/${indicator}`,
    name: `${indicator} for ${country}`,
    frequency,
    data: sortedData,
    lastUpdated: sortedData.length > 0 ? sortedData[sortedData.length - 1].date : undefined,
    meta: {
      country,
      indicator,
    },
  }
}

