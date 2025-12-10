/**
 * Utility functions for formatting indicator values
 * Formats values according to unit type (percent, millions, thousands, index, level)
 */

import { getIndicatorConfig, formatIndicatorValue as formatValueFromConfig } from '@/config/macro-indicators'

/**
 * Format indicator value with unit
 * Examples:
 * - 7.658 (millions) → "7.658M"
 * - 214.75 (thousands) → "214.75K"
 * - 3.02 (percent) → "3.02%"
 * - 48.2 (index) → "48.2"
 */
export function formatIndicatorValue(
  value: number | null | undefined,
  indicatorKey?: string,
  unit?: string
): string {
  if (value === null || value === undefined) return '—'
  
  // Try to get config for the indicator
  if (indicatorKey) {
    const config = getIndicatorConfig(indicatorKey)
    if (config) {
      return formatValueFromConfig(value, config)
    }
  }
  
  // Fallback: use provided unit or format as number
  if (unit) {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(numValue)) return '—'
    
    // Format based on unit
    if (unit === '%' || unit === 'percent') {
      return `${numValue.toFixed(2)}%`
    } else if (unit === 'K' || unit === 'k' || unit === 'thousands') {
      return `${numValue.toFixed(2)}K`
    } else if (unit === 'M' || unit === 'millions') {
      return `${numValue.toFixed(3)}M`
    } else if (unit === 'index') {
      return numValue.toFixed(1)
    } else {
      // Default: format with 2 decimals
      return numValue.toFixed(2)
    }
  }
  
  // No unit: format as number with 2 decimals
  const numValue = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(numValue)) return '—'
  return numValue.toFixed(2)
}

/**
 * Format indicator value for display in table (simpler format)
 */
export function formatIndicatorValueSimple(
  value: number | null | undefined,
  indicatorKey?: string,
  unit?: string
): string {
  if (value === null || value === undefined) return '—'
  
  // Try to get config for the indicator
  if (indicatorKey) {
    const config = getIndicatorConfig(indicatorKey)
    if (config) {
      // IMPORTANT: The value coming from read-macro.ts is ALREADY SCALED
      // We should NOT apply scale again, just format the value
      // Debug: log values (only in development)
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INDICATORS === 'true') {
        console.log(`[DEBUG_INDICATOR] ${indicatorKey}: VALUE=${value} (already scaled), CONFIG_SCALE=${config.scale}, CONFIG_UNIT=${config.unit}, CONFIG_DECIMALS=${config.decimals}`)
      }
      
      // Value is already scaled from read-macro.ts, just round and format
      const rounded = Number(value.toFixed(config.decimals))
      
      switch (config.unit) {
        case 'percent':
          // Always show decimals for percent, even if 0
          return `${rounded.toFixed(config.decimals)}%`
        case 'millions':
          // Value already scaled, just format it (NO double scaling)
          return `${rounded.toFixed(config.decimals)}M`
        case 'thousands':
          // Value already scaled, just format it (NO double scaling)
          return `${rounded.toFixed(config.decimals)}K`
        case 'index':
          return rounded.toFixed(config.decimals)
        case 'level':
        default:
          return rounded.toFixed(config.decimals)
      }
    }
  }
  
  // Fallback: use provided unit
  if (unit) {
    const numValue = typeof value === 'number' ? value : parseFloat(String(value))
    if (isNaN(numValue)) return '—'
    
    if (unit === '%') {
      return `${numValue.toFixed(2)}%`
    } else if (unit === 'K' || unit === 'k') {
      return `${numValue.toFixed(2)}K`
    } else if (unit === 'M') {
      return `${numValue.toFixed(3)}M`
    } else if (unit === 'index') {
      return numValue.toFixed(1)
    }
  }
  
  // Default
  const numValue = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(numValue)) return '—'
  return numValue.toFixed(2)
}

