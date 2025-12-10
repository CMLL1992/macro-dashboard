/**
 * ECB SDW (Statistical Data Warehouse) data adapter
 * Fetches data from ECB SDMX API
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'
import { fetchWithTimeout, withRetry } from '@/lib/utils/http'
import { normalizeDateByFreq, sortAscByDate } from '@/lib/utils/time'
import { parseSdmxObservations, safeGetSeriesName } from '@/lib/utils/sdmx'

/**
 * Fetch ECB series using simple code format (for specific indicators)
 * Uses ECB SDMX API: https://data-api.ecb.europa.eu/service/data/{flow}/{key}
 * @param code ECB code in format "FLOW/KEY" (e.g., "STS/M.I8.N.P3.IND.A.A")
 * @param lastNObservations Number of observations to fetch (default: 100 for historical data)
 * @returns MacroSeries with normalized data
 */
export async function fetchECBSimpleSeries(
  code: string,
  lastNObservations: number = 100
): Promise<MacroSeries> {
  // Parse code format: "STS/M.I8.N.P3.IND.A.A" -> flow="STS", key="M.I8.N.P3.IND.A.A"
  const [flow, ...keyParts] = code.split('/')
  const key = keyParts.join('/')
  
  if (!flow || !key) {
    throw new Error(`Invalid ECB code format: ${code}. Expected format: "FLOW/KEY"`)
  }

  // Use ECB SDMX API (standard endpoint)
  const url = `https://data-api.ecb.europa.eu/service/data/${flow}/${key}?format=jsondata&lastNObservations=${lastNObservations}&compressed=false`
  
  let response: Response
  try {
    response = await withRetry(async () => {
      const res = await fetchWithTimeout(url, { timeoutMs: 20000 })
      if (!res.ok) {
        throw new Error(`ECB_SDW ${res.status}: ${res.statusText} - ${url}`)
      }
      return res
    }, 3)
  } catch (error) {
    throw new Error(`Failed to fetch ECB SDW data: ${error instanceof Error ? error.message : String(error)}`)
  }

  const json = await response.json()

  // Use existing SDMX parser
  const { timeValues, observations } = parseSdmxObservations(json)

  if (timeValues.length === 0 || observations.length === 0) {
    return {
      id: `ECB_SDW:${code}`,
      source: 'ECB_SDW',
      indicator: code,
      nativeId: code,
      name: safeGetSeriesName(json) || code,
      frequency: 'M',
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
      date: normalizeDateByFreq(timeValue, 'M'),
      value: obs?.value ?? null,
    }
  })

  // Filter nulls and sort
  const filteredData = dataPoints.filter((dp) => dp.value != null)
  const sortedData = sortAscByDate(filteredData)

  return {
    id: `ECB_SDW:${code}`,
    source: 'ECB_SDW',
    indicator: code,
    nativeId: code,
    name: safeGetSeriesName(json) || code,
    frequency: 'M',
    data: sortedData,
    lastUpdated: sortedData.length > 0 ? sortedData[sortedData.length - 1].date : undefined,
    meta: {
      url,
      totalPoints: observations.length,
      filteredPoints: sortedData.length,
    },
  }
}

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
  // ECB migrated to new API endpoint as of Oct 2025: https://data-api.ecb.europa.eu
  // Use new endpoint, fallback to old one if needed
  // Try without compressed first (more reliable), then with compressed
  const newUrl = `https://data-api.ecb.europa.eu/service/data/${flow}/${key}?format=jsondata&compressed=false`
  const newUrlCompressed = `https://data-api.ecb.europa.eu/service/data/${flow}/${key}?format=jsondata&compressed=true`
  const oldUrl = `https://sdw-wsrest.ecb.europa.eu/service/data/${flow}/${key}?format=jsondata&compressed=false`
  
  let url = newUrl
  let response: Response
  
  // Try new endpoint first (as of Oct 2025)
  // Increase timeout for ECB API calls (can be slow)
  try {
    response = await withRetry(async () => {
      // Try uncompressed first (more reliable)
      let res = await fetchWithTimeout(newUrl, { timeoutMs: 20000 }) // 20 seconds timeout
      if (res.ok) {
        return res
      }
      // If uncompressed fails, try compressed
      if (res.status === 404 || res.status >= 500) {
        res = await fetchWithTimeout(newUrlCompressed, { timeoutMs: 20000 })
        if (res.ok) {
          url = newUrlCompressed
          return res
        }
      }
      // If new endpoint fails, try old one
      if (res.status === 404 || res.status >= 500) {
        const oldRes = await fetchWithTimeout(oldUrl, { timeoutMs: 20000 })
        if (!oldRes.ok) {
          throw new Error(`ECB_SDW ${oldRes.status}: ${oldRes.statusText} - ${oldUrl}`)
        }
        url = oldUrl
        return oldRes
      }
      throw new Error(`ECB_SDW ${res.status}: ${res.statusText} - ${newUrl}`)
    }, 3) // 3 retries instead of 2
  } catch (error) {
    // Fallback to old endpoint if new one completely fails
    url = oldUrl
    response = await withRetry(async () => {
      const res = await fetchWithTimeout(oldUrl, { timeoutMs: 20000 })
      if (!res.ok) {
        throw new Error(`ECB_SDW ${res.status}: ${res.statusText} - ${oldUrl}`)
      }
      return res
    }, 3)
  }

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
