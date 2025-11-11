/**
 * Validators for API responses
 * Ensures data shape matches expected structure
 */

export type BiasAPIResponse = {
  items: Array<{
    key: string
    seriesId: string
    label: string
    value: number | null
    value_previous?: number | null
    date: string | null
    date_previous?: string | null
    trend?: 'Mejora' | 'Empeora' | 'Estable'
    posture?: 'Hawkish' | 'Dovish' | 'Neutral'
    weight: number
    category: string
    unit?: string
    originalKey?: string
  }>
  regime: string
  usd: 'Fuerte' | 'Débil' | 'Neutral'
  quad: string
  score: number
  rows: Array<{
    par: string
    tactico?: string
    accion: string
    confianza?: 'Alta' | 'Media' | 'Baja'
    corr12m?: number | null
    corr3m?: number | null
    motivo?: string
  }>
  health: {
    hasData: boolean
    observationCount: number
    biasCount: number
    correlationCount: number
  }
  updatedAt: string | null
  latestDataDate: string | null
}

/**
 * Validate bias API response shape
 */
export function validateBiasResponse(data: unknown): BiasAPIResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid API response: expected object')
  }

  const obj = data as Record<string, unknown>

  // Validate required fields
  if (!Array.isArray(obj.items)) {
    throw new Error('Invalid API response: missing or invalid "items" array')
  }

  if (typeof obj.regime !== 'string') {
    throw new Error('Invalid API response: missing or invalid "regime"')
  }

  if (typeof obj.score !== 'number') {
    throw new Error('Invalid API response: missing or invalid "score"')
  }

  if (!obj.health || typeof obj.health !== 'object') {
    throw new Error('Invalid API response: missing or invalid "health" object')
  }

  // Validate items structure
  for (const item of obj.items) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Invalid API response: item is not an object')
    }

    const itemObj = item as Record<string, unknown>
    if (typeof itemObj.key !== 'string') {
      throw new Error('Invalid API response: item missing "key"')
    }
    if (typeof itemObj.label !== 'string') {
      throw new Error('Invalid API response: item missing "label"')
    }
    if (typeof itemObj.weight !== 'number') {
      throw new Error('Invalid API response: item missing or invalid "weight"')
    }
  }

  return data as BiasAPIResponse
}

/**
 * Normalize dates to ISO strings for serialization
 */
export function normalizeDates<T extends Record<string, unknown>>(obj: T): T {
  const normalized: Record<string, unknown> = { ...obj }

  for (const [key, value] of Object.entries(normalized)) {
    if (value instanceof Date) {
      normalized[key] = value.toISOString()
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      normalized[key] = normalizeDates(value as Record<string, unknown>)
    } else if (Array.isArray(value)) {
      normalized[key] = value.map(item =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? normalizeDates(item as Record<string, unknown>)
          : item instanceof Date
          ? item.toISOString()
          : item
      )
    }
  }

  return normalized as T
}

