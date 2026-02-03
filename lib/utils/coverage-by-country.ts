/**
 * Calculate data coverage by country/currency
 * Groups indicators by currency and calculates coverage percentage
 * 
 * FIX 2: Corregir cálculo de cobertura
 * - totalCount: desde catálogo de indicadores (KEY_TO_SERIES_ID)
 * - availableCount: desde indicators con datos (value != null)
 * - Mapear correctamente keys internos (cpi_yoy) → series_id (CPIAUCSL) → currency
 */

import type { IndicatorRow } from '@/lib/dashboard-data'
import currencyIndicatorsConfig from '@/config/currency-indicators.json'
import coreIndicatorsConfig from '@/config/core-indicators.json'
import { KEY_TO_SERIES_ID } from '@/lib/db/read-macro'

export interface CountryCoverage {
  country: string
  currency: string
  flag: string
  availableCount: number
  totalCount: number
  coveragePct: number
  status: 'OK' | 'PARTIAL' | 'LOW'
  staleCount?: number
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: '🇺🇸',
  EU: '🇪🇺',
  UK: '🇬🇧',
  JP: '🇯🇵',
  CA: '🇨🇦',
  AU: '🇦🇺',
  NZ: '🇳🇿',
  CH: '🇨🇭',
  CN: '🇨🇳',
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'US',
  EU: 'EU',
  UK: 'UK',
  JP: 'JP',
  CA: 'CA',
  AU: 'AU',
  NZ: 'NZ',
  CH: 'CH',
  CN: 'CN',
}

/**
 * Calculate coverage for all countries
 * FIX 2: Usar KEY_TO_SERIES_ID para mapear keys internos → series_id → currency
 */
export function calculateCoverageByCountry(indicators: IndicatorRow[]): CountryCoverage[] {
  const expectedMissing = new Set<string>(
    Array.isArray((coreIndicatorsConfig as any)?.expectedMissing)
      ? ((coreIndicatorsConfig as any).expectedMissing as string[]).map((k) => String(k || '').trim()).filter(Boolean)
      : [],
  )
  const minDatasetByCurrency: Record<string, string[]> =
    (coreIndicatorsConfig as any)?.minDatasetByCurrency && typeof (coreIndicatorsConfig as any).minDatasetByCurrency === 'object'
      ? ((coreIndicatorsConfig as any).minDatasetByCurrency as Record<string, string[]>)
      : {}

  // Map indicator keys to currencies from config
  // FIX 2: Mapear keys internos (cpi_yoy) → series_id (CPIAUCSL) → currency
  const indicatorToCurrency = new Map<string, string>()
  const allIndicatorKeys = new Set<string>()

  // Build mapping: internal key → series_id → currency
  for (const [internalKey, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
    // Buscar series_id en currency-indicators.json
    const config = (currencyIndicatorsConfig.indicators as any)[seriesId]
    if (config && config.currency) {
      indicatorToCurrency.set(internalKey.toUpperCase(), config.currency)
      allIndicatorKeys.add(internalKey.toUpperCase())
    }
  }

  // Also map EU indicators (eu_*) directly
  indicators.forEach(ind => {
    if (ind.key && ind.key.toLowerCase().startsWith('eu_')) {
      indicatorToCurrency.set(ind.key.toUpperCase(), 'EUR')
      allIndicatorKeys.add(ind.key.toUpperCase())
    }
  })
  
  // Also map other indicators from currency-indicators.json that might not be in KEY_TO_SERIES_ID
  // (e.g., UK_CPI_YOY, JP_CPI_YOY, etc.)
  for (const [seriesId, config] of Object.entries(currencyIndicatorsConfig.indicators)) {
    const currency = (config as any).currency
    if (currency && !indicatorToCurrency.has(seriesId.toUpperCase())) {
      // Try to find internal key that matches this series_id
      const matchingKey = Object.keys(KEY_TO_SERIES_ID).find(
        k => KEY_TO_SERIES_ID[k] === seriesId
      )
      if (matchingKey) {
        indicatorToCurrency.set(matchingKey.toUpperCase(), currency)
        allIndicatorKeys.add(matchingKey.toUpperCase())
      } else {
        // If no matching key, use series_id as key (for indicators like UK_CPI_YOY)
        indicatorToCurrency.set(seriesId.toUpperCase(), currency)
        allIndicatorKeys.add(seriesId.toUpperCase())
      }
    }
  }

  // Group indicators by currency
  const byCurrency = new Map<string, {
    available: string[]
    total: string[]
    stale: string[]
  }>()

  // Initialize only target currencies: USD, EUR, GBP, JPY (excluimos AU, CN, NZ, CA, CH)
  const currencies = ['USD', 'EUR', 'GBP', 'JPY']
  currencies.forEach(ccy => {
    byCurrency.set(ccy, { available: [], total: [], stale: [] })
  })

  // Count indicators per currency
  for (const indicatorKey of allIndicatorKeys) {
    const currency = indicatorToCurrency.get(indicatorKey) || 'USD' // Default to USD if not found
    const entry = byCurrency.get(currency)
    if (entry) {
      entry.total.push(indicatorKey)
      
      // Check if this indicator has data
      const indicator = indicators.find(ind => 
        (ind.key?.toUpperCase() === indicatorKey) || 
        (ind.originalKey?.toUpperCase() === indicatorKey)
      )
      
      if (indicator && indicator.value != null && !isNaN(Number(indicator.value))) {
        entry.available.push(indicatorKey)
        
        // Check if stale (date > 365 days old)
        if (indicator.date) {
          const dateObj = new Date(indicator.date)
          const daysOld = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
          if (daysOld > 365) {
            entry.stale.push(indicatorKey)
          }
        }
      }
    }
  }

  // Build coverage results
  const results: CountryCoverage[] = []
  // Excluir países fuera del universo del dashboard: AU, CN, NZ, CA, CH
  const EXCLUDED_COUNTRIES = new Set(['AU', 'CN', 'NZ', 'CA', 'CH'])
  
  for (const [currency, data] of byCurrency.entries()) {
    const countryCode = currency === 'EUR' ? 'EU' : 
                       currency === 'GBP' ? 'UK' :
                       currency === 'JPY' ? 'JP' :
                       currency === 'CAD' ? 'CA' :
                       currency === 'AUD' ? 'AU' :
                       currency === 'NZD' ? 'NZ' :
                       currency === 'CHF' ? 'CH' :
                       currency === 'CNY' ? 'CN' : 'US'
    
    // Dataset mínimo (single source of truth). Si existe, el coverage se calcula SOLO sobre mínimos.
    const minKeysRaw = Array.isArray(minDatasetByCurrency[currency]) ? minDatasetByCurrency[currency] : []
    const minKeys = minKeysRaw
      .map((k) => String(k || '').trim())
      .filter(Boolean)
      .filter((k) => !expectedMissing.has(k)) // no penalizar expectedMissing en mínimos
      .map((k) => k.toUpperCase())

    const targetKeys = minKeys.length > 0 ? minKeys : data.total

    const present: string[] = []
    const stale: string[] = []

    for (const indicatorKey of targetKeys) {
      const indicator = indicators.find(
        (ind) => ind.key?.toUpperCase() === indicatorKey || ind.originalKey?.toUpperCase() === indicatorKey,
      )
      if (indicator && indicator.value != null && !isNaN(Number(indicator.value))) {
        present.push(indicatorKey)
        if (indicator.date) {
          const dateObj = new Date(indicator.date)
          const daysOld = (Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24)
          if (daysOld > 365) stale.push(indicatorKey)
        }
      }
    }

    const total = targetKeys.length
    const available = present.length
    const coveragePct = total > 0 ? Math.round((available / total) * 100) : 0
    const staleCount = stale.length

    // Status basado en mínimos:
    // - OK: todos los mínimos presentes y sin stale
    // - PARTIAL: parte de mínimos presentes
    // - LOW: casi sin mínimos
    let status: 'OK' | 'PARTIAL' | 'LOW'
    if (total > 0 && available === total && staleCount === 0) {
      status = 'OK'
    } else if (available >= Math.max(1, Math.ceil(total * 0.5))) {
      status = 'PARTIAL'
    } else {
      status = 'LOW'
    }

    // Excluir países fuera del universo del dashboard (AU, CN)
    if (!EXCLUDED_COUNTRIES.has(countryCode)) {
      results.push({
        country: COUNTRY_NAMES[countryCode] || countryCode,
        currency,
        flag: COUNTRY_FLAGS[countryCode] || '🌍',
        availableCount: available,
        totalCount: total,
        coveragePct,
        status,
        staleCount,
      })
    }
  }

  // Sort by importance (US, EU first) then alphabetically
  // Solo incluir países objetivo: US, EU, UK, JP
  const priority = ['US', 'EU', 'UK', 'JP']
  results.sort((a, b) => {
    const aPriority = priority.indexOf(a.country)
    const bPriority = priority.indexOf(b.country)
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority
    if (aPriority !== -1) return -1
    if (bPriority !== -1) return 1
    return a.country.localeCompare(b.country)
  })

  return results
}
