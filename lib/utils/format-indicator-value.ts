/**
 * Utility functions for formatting indicator values
 * Formats values according to unit type (percent, millions, thousands, index, level)
 * Detects placeholder values (0, null) and shows "Dato pendiente" instead
 */

import { getIndicatorConfig, formatIndicatorValue as formatValueFromConfig } from '@/config/macro-indicators'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar mapping de indicadores
let indicatorsMap: any = null
try {
  const mapPath = join(process.cwd(), 'config', 'indicators-map.json')
  indicatorsMap = JSON.parse(readFileSync(mapPath, 'utf-8'))
} catch (error) {
  // Si no existe el archivo, usar valores por defecto
  indicatorsMap = { indicators: [] }
}

/**
 * Check if a value is a placeholder (suspicious 0 or null)
 */
function isPlaceholderValue(value: number | null | undefined, indicatorKey?: string): boolean {
  if (value === null || value === undefined) return true
  
  // Si el valor es 0, puede ser placeholder para ciertos indicadores
  if (value === 0) {
    // Indicadores críticos donde 0 es sospechoso
    const criticalIndicators = [
      'payems_delta', 'payems', 'PAYEMS',
      'gdp_qoq', 'gdp_qoq_annualized', 'GDPC1',
      'unrate', 'UNRATE',
      'nfp_change', 'nfp'
    ]
    
    if (indicatorKey) {
      // Verificar si el key coincide con indicadores críticos
      const keyLower = indicatorKey.toLowerCase()
      if (criticalIndicators.some(crit => keyLower.includes(crit.toLowerCase()))) {
        return true
      }
      
      // Buscar en el mapping si este indicador tiene valores placeholder definidos
      try {
        if (indicatorsMap && indicatorsMap.indicators) {
          const indicator = indicatorsMap.indicators.find(
            (ind: any) => 
              ind.id_interno === indicatorKey || 
              ind.id_interno === keyLower ||
              ind.series_id === indicatorKey ||
              ind.series_id === keyLower
          )
          
          if (indicator && indicator.valores_placeholder && indicator.valores_placeholder.length > 0) {
            // Verificar si el valor está en la lista de placeholders
            return indicator.valores_placeholder.includes(value)
          }
        }
      } catch (error) {
        // Si hay error cargando el mapping, usar heurística
        console.warn('[format-indicator-value] Error loading indicators map:', error)
      }
    }
    
    // Por defecto, si es 0 y no tenemos información, no asumir placeholder
    // (algunos indicadores pueden tener 0 como valor real)
    return false
  }
  
  return false
}

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
  if (value === null || value === undefined) return 'Dato pendiente'
  
  // Detectar placeholders
  if (isPlaceholderValue(value, indicatorKey)) {
    return 'Dato pendiente'
  }
  
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
  if (value === null || value === undefined) return 'Dato pendiente'
  
  // Detectar placeholders
  if (isPlaceholderValue(value, indicatorKey)) {
    return 'Dato pendiente'
  }
  
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

