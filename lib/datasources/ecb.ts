/**
 * ECB SDW (Statistical Data Warehouse) data adapter
 * Fetches data from ECB SDMX API
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'
import { parseSdmxObservations, safeGetSeriesName } from '@/lib/utils/sdmx'

export interface ECBParams {
  flow: string
  key: string
  freq?: Frequency
}

/**
 * Fetch an ECB series via SDMX
 * @param params Flow, key, and optional frequency
 * @returns MacroSeries with normalized data
 */
export async function fetchECBSeries(
  params: ECBParams
): Promise<MacroSeries> {
  const { flow, key, freq = 'M' } = params
  const url = `https://sdw-wsrest.ecb.europa.eu/service/data/${flow}/${key}?format=jsondata&compressed=true`

  const response = await withRetry(async () => {
    const res = await fetchWithTimeout(url)
    if (!res.ok) {
      throw new Error(`ECB_SDW ${res.status}: ${res.statusText} - ${url}`)
    }
    return res
  })

  const json = await response.json()

  // Parse SDMX observations
  const { timeValues, observations } = parseSdmxObservations(json)

  if (timeValues.length === 0 || observations.length === 0) {
    return {
      id: `ECB_SDW:${flow}:${key}`,
      source: 'ECB_SDW',
      indicator: key,
      nativeId: `${flow}:${key}`,
      name: safeGetSeriesName(json) || `${flow} ${key}`,
      frequency: freq,
      data: [],
      meta: {
        reason: 'NO_DATA',
        url,
      },
    }
  }

  // Map to DataPoint format
  const dataPoints = timeValues.map((timeValue, idx) => {
    const obs = observations.find((o) => o.timeIndex === idx)
    return {
      date: normalizeDateByFreq(timeValue, freq),
      value: obs?.value ?? null,
    }
  })

  // Filter nulls and sort
  const filteredData = dataPoints.filter((dp) => dp.value != null)
  const sortedData = sortAscByDate(filteredData)

  const id = `ECB_SDW:${flow}:${key}`
  const name = safeGetSeriesName(json) || `${flow} ${key}`

  const lastUpdated =
    sortedData.length > 0
      ? sortedData[sortedData.length - 1].date
      : undefined

  return {
    id,
    source: 'ECB_SDW',
    indicator: key,
    nativeId: `${flow}:${key}`,
    name,
    frequency: freq,
    data: sortedData,
    lastUpdated,
    meta: {
      url,
      totalPoints: observations.length,
      filteredPoints: sortedData.length,
    },
  }
}
