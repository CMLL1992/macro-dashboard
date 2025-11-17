/**
 * SDMX (Statistical Data and Metadata eXchange) parsing utilities
 */

export interface SdmxObservation {
  timeIndex: number
  value: number | null
}

export interface SdmxParseResult {
  timeValues: string[]
  observations: SdmxObservation[]
}

/**
 * Parse SDMX JSON observations
 * Handles both IMF and ECB SDMX formats
 */
export function parseSdmxObservations(json: any): SdmxParseResult {
  const timeValues: string[] = []
  const observations: SdmxObservation[] = []

  try {
    // IMF format: json.data.datasets[0].series[...].observations
    if (json.data?.datasets?.[0]?.series) {
      const series = Object.values(json.data.datasets[0].series)[0] as any
      if (series?.observations) {
        const obsMap = series.observations
        const timeKeys = Object.keys(obsMap).sort((a, b) => parseInt(a) - parseInt(b))

        // Get time dimension values
        const structure = json.structure?.dimensions?.observation?.[0]?.values || []
        timeKeys.forEach((key) => {
          const idx = parseInt(key, 10)
          const timeValue = structure[idx]?.id || structure[idx]?.name || key
          timeValues.push(timeValue)
          const obs = obsMap[key]
          const value = Array.isArray(obs) ? obs[0] : obs
          observations.push({
            timeIndex: idx,
            value: value != null && typeof value === 'number' ? value : null,
          })
        })
      }
    }
    // ECB format: json.dataSets[0].series[...].observations
    else if (json.dataSets?.[0]?.series) {
      const series = Object.values(json.dataSets[0].series)[0] as any
      if (series?.observations) {
        const obsMap = series.observations
        const timeKeys = Object.keys(obsMap).sort((a, b) => parseInt(a) - parseInt(b))

        // Get time dimension values
        const structure = json.structure?.dimensions?.observation?.[0]?.values || []
        timeKeys.forEach((key) => {
          const idx = parseInt(key, 10)
          const timeValue = structure[idx]?.id || structure[idx]?.name || key
          timeValues.push(timeValue)
          const obs = obsMap[key]
          const value = Array.isArray(obs) ? obs[0] : obs
          observations.push({
            timeIndex: idx,
            value: value != null && typeof value === 'number' ? value : null,
          })
        })
      }
    }
  } catch (error) {
    console.error('Error parsing SDMX observations:', error)
  }

  return { timeValues, observations }
}

/**
 * Safely extract series name from SDMX JSON
 */
export function safeGetSeriesName(json: any): string {
  try {
    // Try IMF format
    if (json.structure?.name) {
      return json.structure.name
    }
    // Try ECB format
    if (json.structure?.dimensions?.series?.[0]?.values?.[0]?.name) {
      return json.structure.dimensions.series[0].values[0].name
    }
    // Fallback to dataset name
    if (json.data?.datasets?.[0]?.name) {
      return json.data.datasets[0].name
    }
    if (json.dataSets?.[0]?.name) {
      return json.dataSets[0].name
    }
  } catch (error) {
    console.error('Error extracting series name:', error)
  }
  return 'Unknown Series'
}

/**
 * SDMX discovery and key resolution
 */

export interface SeriesKeyMatch {
  key: string
  name: string
  dimensions: Record<string, string>
  score: number
}

export interface DiscoveryFilters {
  textMatch?: string
  freq?: 'A' | 'Q' | 'M' | 'W' | 'D'
  adjust?: string // e.g., 'NSA' (not seasonally adjusted), 'SA' (seasonally adjusted)
  unit?: string // e.g., 'USD', 'EUR', 'PCT'
  refArea?: string // Country code
}

export interface KeyPreferences {
  freq?: 'A' | 'Q' | 'M' | 'W' | 'D'
  adjust?: string
  unit?: string
}

/**
 * Find series keys in SDMX dataflow/structure
 * This is a simplified version that works with structure metadata
 */
export async function findSeriesKey(
  source: 'IMF' | 'ECB_SDW',
  flow: string,
  filters: DiscoveryFilters
): Promise<string[]> {
  const keys: SeriesKeyMatch[] = []

  try {
    let url: string
    if (source === 'IMF') {
      url = `https://dataservices.imf.org/REST/SDMX_JSON/dataflow/IFS?format=sdmx-json`
    } else {
      url = `https://sdw-wsrest.ecb.europa.eu/service/dataflow/${flow}?format=jsondata`
    }

    // In a real implementation, we would fetch the dataflow structure
    // For now, we return empty array and rely on manual key specification
    // This can be extended to actually query SDMX dataflow APIs

    // Placeholder: return empty array
    // Real implementation would parse dataflow structure and match filters
  } catch (error) {
    console.error('Error discovering SDMX keys:', error)
  }

  return keys.map((k) => k.key)
}

/**
 * Pick the best key from a list of candidates based on preferences
 */
export function pickBestKey(
  keys: string[],
  prefs: KeyPreferences
): string | null {
  if (keys.length === 0) return null
  if (keys.length === 1) return keys[0]

  // Score each key based on preferences
  const scored = keys.map((key) => {
    let score = 0

    // Prefer frequency match
    if (prefs.freq) {
      const freqMap: Record<string, string> = {
        A: 'A',
        Q: 'Q',
        M: 'M',
        W: 'W',
        D: 'D',
      }
      if (key.includes(`.${freqMap[prefs.freq]}.`) || key.endsWith(`.${freqMap[prefs.freq]}`)) {
        score += 10
      }
    }

    // Prefer adjustment match (NSA by default)
    if (prefs.adjust) {
      if (key.includes(prefs.adjust)) {
        score += 5
      }
    } else {
      // Default: prefer NSA (not seasonally adjusted)
      if (key.includes('NSA') || key.includes('.N.')) {
        score += 5
      }
    }

    // Prefer unit match
    if (prefs.unit) {
      if (key.includes(prefs.unit)) {
        score += 3
      }
    }

    return { key, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  return scored[0].key
}

/**
 * Helper to build SDMX key from dimensions
 */
export function buildSdmxKey(
  flow: string,
  dimensions: Record<string, string>
): string {
  // Common dimension order for IMF IFS: FREQ.COUNTRY.INDICATOR.UNIT
  // For ECB: varies by flow
  const parts: string[] = []

  // Add dimensions in order
  if (dimensions.FREQ) parts.push(dimensions.FREQ)
  if (dimensions.REF_AREA) parts.push(dimensions.REF_AREA)
  if (dimensions.INDICATOR) parts.push(dimensions.INDICATOR)
  if (dimensions.UNIT) parts.push(dimensions.UNIT)
  if (dimensions.ADJUSTMENT) parts.push(dimensions.ADJUSTMENT)

  return parts.join('.')
}

