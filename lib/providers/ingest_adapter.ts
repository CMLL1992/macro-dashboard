/**
 * Ingest adapter for external data providers
 * Converts provider-specific payloads to standardized NewsItem format
 */

import { NewsItem } from '@/lib/notifications/news'

export interface ProviderPayload {
  // Provider-specific fields (flexible structure)
  [key: string]: any
}

export interface ProviderConfig {
  name: string
  impactMapping: {
    high: string[]
    med: string[]
    low: string[]
  }
  titleMapping?: Record<string, string> // Map provider titles to canonical
  countryMapping?: Record<string, string> // Map provider country codes to ISO3
}

/**
 * Normalize impact from provider-specific value to standard
 */
function normalizeImpact(
  providerImpact: string | number | undefined,
  config: ProviderConfig
): 'high' | 'med' | 'low' {
  if (!providerImpact) return 'med'

  const impactStr = String(providerImpact).toLowerCase()

  // Check high priority
  if (config.impactMapping.high.some(h => impactStr.includes(h.toLowerCase()))) {
    return 'high'
  }

  // Check low priority
  if (config.impactMapping.low.some(l => impactStr.includes(l.toLowerCase()))) {
    return 'low'
  }

  // Default to med
  return 'med'
}

/**
 * Normalize published_at to UTC ISO string
 */
function normalizePublishedAt(dateInput: string | Date | number): string {
  if (!dateInput) {
    return new Date().toISOString()
  }

  // If already ISO string, return as-is (assuming UTC)
  if (typeof dateInput === 'string' && dateInput.includes('T') && dateInput.includes('Z')) {
    return dateInput
  }

  // If ISO string without Z, assume UTC
  if (typeof dateInput === 'string' && dateInput.includes('T')) {
    return dateInput.endsWith('Z') ? dateInput : `${dateInput}Z`
  }

  // Convert to Date and then ISO
  const date = typeof dateInput === 'number' ? new Date(dateInput * 1000) : new Date(dateInput)
  return date.toISOString()
}

/**
 * Generate canonical title
 */
function generateCanonicalTitle(
  providerTitle: string,
  providerEvent: string,
  month?: string,
  flash?: boolean
): string {
  // Try to extract month/year from title or use current
  const monthStr = month || new Date().toLocaleString('en-US', { month: 'short' }).toLowerCase()
  const flashStr = flash ? ' (flash)' : ''

  // Common patterns
  if (providerTitle.toLowerCase().includes('cpi')) {
    return `CPI m/m (${monthStr})`
  }
  if (providerTitle.toLowerCase().includes('ppi')) {
    return `PPI m/m (${monthStr})`
  }
  if (providerTitle.toLowerCase().includes('nfp') || providerTitle.toLowerCase().includes('nonfarm')) {
    return `Nonfarm Payrolls (${monthStr})`
  }
  if (providerTitle.toLowerCase().includes('pmi')) {
    const type = providerTitle.toLowerCase().includes('manufactur') ? 'Manufacturas' : 'Servicios'
    return `PMI ${type} (${monthStr}${flashStr})`
  }

  // Fallback: use provider title with month if not present
  if (!providerTitle.toLowerCase().includes(monthStr)) {
    return `${providerTitle} (${monthStr})`
  }

  return providerTitle
}

/**
 * Map provider payload to NewsItem
 */
export function adaptProviderPayload(
  payload: ProviderPayload,
  config: ProviderConfig
): NewsItem | null {
  try {
    // Extract common fields (adjust based on your provider structure)
    const providerId = payload.id || payload.event_id || payload.release_id
    const providerSource = payload.source || payload.provider || config.name
    const providerTitle = payload.title || payload.event || payload.indicator
    const providerCountry = payload.country || payload.country_code || payload.pais
    const providerTheme = payload.theme || payload.category || payload.tema
    const providerImpact = payload.impact || payload.importance || payload.priority
    const providerPublishedAt = payload.published_at || payload.release_date || payload.timestamp
    const providerValue = payload.value || payload.actual || payload.valor_publicado
    const providerExpected = payload.expected || payload.consensus || payload.forecast || payload.valor_esperado
    const providerSummary = payload.summary || payload.description || payload.resumen

    // Validate required fields
    if (!providerId || !providerTitle || !providerPublishedAt) {
      console.warn('[ingest_adapter] Missing required fields:', { providerId, providerTitle, providerPublishedAt })
      return null
    }

    // Generate stable id_fuente
    const id_fuente = `${config.name.toLowerCase()}_${providerId}`.replace(/[^a-z0-9_]/gi, '_')

    // Normalize fields
    const impacto = normalizeImpact(providerImpact, config)
    const published_at = normalizePublishedAt(providerPublishedAt)
    const titulo = config.titleMapping?.[providerTitle] || generateCanonicalTitle(providerTitle, providerTitle)
    const pais = config.countryMapping?.[providerCountry] || providerCountry || undefined
    const tema = providerTheme || undefined

    // Build NewsItem
    const newsItem: NewsItem = {
      id_fuente,
      fuente: config.name,
      pais,
      tema,
      titulo,
      impacto,
      published_at,
      resumen: providerSummary || undefined,
      valor_publicado: providerValue != null ? Number(providerValue) : undefined,
      valor_esperado: providerExpected != null ? Number(providerExpected) : undefined,
    }

    return newsItem
  } catch (error) {
    console.error('[ingest_adapter] Error adapting payload:', error)
    return null
  }
}

/**
 * Predefined provider configurations
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  BLS: {
    name: 'BLS',
    impactMapping: {
      high: ['high', 'major', 'critical', 'cpi', 'nfp', 'employment'],
      med: ['med', 'medium', 'moderate'],
      low: ['low', 'minor'],
    },
    titleMapping: {
      'Consumer Price Index': 'CPI m/m',
      'Nonfarm Payrolls': 'Nonfarm Payrolls',
      'Producer Price Index': 'PPI m/m',
    },
    countryMapping: {
      'US': 'US',
      'USA': 'US',
      'United States': 'US',
    },
  },
  'S&P Global': {
    name: 'S&P Global',
    impactMapping: {
      high: ['high', 'flash', 'final', 'pmi'],
      med: ['med', 'preliminary'],
      low: ['low'],
    },
    titleMapping: {
      'Manufacturing PMI': 'PMI Manufacturas',
      'Services PMI': 'PMI Servicios',
    },
  },
  TradingEconomics: {
    name: 'TradingEconomics',
    impactMapping: {
      high: ['high', '3'],
      med: ['med', '2', 'medium'],
      low: ['low', '1'],
    },
  },
}

/**
 * Adapt payload from known provider
 */
export function adaptFromProvider(
  providerName: string,
  payload: ProviderPayload
): NewsItem | null {
  const config = PROVIDER_CONFIGS[providerName]
  if (!config) {
    console.warn(`[ingest_adapter] Unknown provider: ${providerName}`)
    return null
  }

  return adaptProviderPayload(payload, config)
}

/**
 * Retry helper for provider requests
 */
export async function retryProviderRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) // Exponential backoff: 2s, 4s, 8s
        console.warn(`[ingest_adapter] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Max retries exceeded')
}




