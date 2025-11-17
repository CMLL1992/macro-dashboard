/**
 * World Bank data adapter
 * Fetches macroeconomic indicators from World Bank API
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'

const DEFAULT_REVALIDATE_HOURS = 6

export interface WorldBankParams {
  countryISO3: string
  indicatorCode: string
}

/**
 * Fetch a World Bank series
 * @param params Country ISO3 code and indicator code
 * @returns MacroSeries with normalized data
 */
export async function fetchWorldBankSeries(
  params: WorldBankParams
): Promise<MacroSeries> {
  const { countryISO3, indicatorCode } = params
  const url = `https://api.worldbank.org/v2/country/${countryISO3}/indicator/${indicatorCode}?format=json&per_page=20000`

  const response = await withRetry(async () => {
    const res = await fetchWithTimeout(url, {
      revalidateHours: DEFAULT_REVALIDATE_HOURS,
    })
    if (!res.ok) {
      throw new Error(
        `WorldBank ${res.status}: ${res.statusText} - ${url}`
      )
    }
    return res
  })

  const json = await response.json()

  if (!Array.isArray(json) || json.length < 2) {
    throw new Error(`WorldBank: Invalid response format - ${url}`)
  }

  const metadata = json[0]
  const dataArray = json[1] as Array<{
    date: string
    value: number | null
    indicator?: { id: string; value: string }
    country?: { id: string; value: string }
  }>

  // Filter null values and normalize dates
  const dataPoints = dataArray
    .filter((item) => item.value != null)
    .map((item) => ({
      date: normalizeDateByFreq(item.date, 'A'), // World Bank uses annual frequency
      value: item.value,
    }))

  // Sort by date ascending
  const sortedData = sortAscByDate(dataPoints)

  // Extract name from metadata
  const name =
    (Array.isArray(metadata?.indicator) && metadata.indicator[0]?.value) ||
    (typeof metadata?.indicator === 'object' && metadata.indicator?.value) ||
    dataArray[0]?.indicator?.value ||
    indicatorCode

  const id = `WORLD_BANK:${indicatorCode}:${countryISO3}`

  // Get last updated date
  const lastUpdated = sortedData.length > 0
    ? sortedData[sortedData.length - 1].date
    : undefined

  return {
    id,
    source: 'WORLD_BANK',
    indicator: indicatorCode,
    nativeId: `${countryISO3}:${indicatorCode}`,
    name,
    frequency: 'A',
    country: countryISO3,
    data: sortedData,
    lastUpdated,
    meta: {
      url,
      totalPoints: dataArray.length,
      filteredPoints: sortedData.length,
    },
  }
}
