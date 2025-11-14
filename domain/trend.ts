/**
 * Trend calculation for macroeconomic indicators
 * Determines if an indicator is improving, deteriorating, or stable
 */

// Indicadores que mejoran cuando BAJAN (lower is better)
const LOWER_IS_BETTER: Set<string> = new Set([
  'CPIAUCSL', // Inflación CPI (YoY)
  'CPILFESL', // Core CPI (YoY)
  'PCEPI',    // Inflación PCE (YoY)
  'PCEPILFE', // Core PCE (YoY)
  'PPIACO',   // PPI (YoY)
  'UNRATE',   // Tasa de Desempleo U3
  'ICSA',     // Solicitudes Iniciales (aunque este es más complejo)
])

// Indicadores que mejoran cuando SUBEN (higher is better)
const HIGHER_IS_BETTER: Set<string> = new Set([
  'GDPC1',    // GDP YoY y QoQ
  'INDPRO',   // Producción Industrial YoY
  'RSXFS',    // Ventas Minoristas YoY
  'PAYEMS',   // NFP Δ miles
  'USPMI',    // ISM Manufacturero (PMI)
  'PMI_SERV', // ISM Servicios (PMI)
])

export type Trend = 'Mejora' | 'Empeora' | 'Estable' | null

/**
 * Calculate trend for an indicator
 * @param indicatorKey The indicator key (e.g., 'CPIAUCSL', 'GDPC1')
 * @param currentValue Current value
 * @param previousValue Previous value
 * @returns Trend label or null if insufficient data
 */
export function calculateTrend(
  indicatorKey: string,
  currentValue: number | null,
  previousValue: number | null
): Trend {
  // No data available
  if (currentValue == null || previousValue == null) {
    return null
  }

  // Check if values are effectively the same (±1% relative change)
  const change = currentValue - previousValue
  const percentChange = previousValue !== 0 ? Math.abs(change / previousValue) : Math.abs(change)
  
  // If change is less than 1%, consider it stable
  if (percentChange < 0.01) {
    return 'Estable'
  }

  // Determine direction based on indicator type
  const isLowerBetter = LOWER_IS_BETTER.has(indicatorKey)
  const isHigherBetter = HIGHER_IS_BETTER.has(indicatorKey)

  // If indicator is not in either set, use default logic (higher is better)
  if (!isLowerBetter && !isHigherBetter) {
    // Default: higher is better
    return change > 0 ? 'Mejora' : 'Empeora'
  }

  // Lower is better (inflation, unemployment)
  if (isLowerBetter) {
    return change < 0 ? 'Mejora' : 'Empeora'
  }

  // Higher is better (GDP, production, employment)
  if (isHigherBetter) {
    return change > 0 ? 'Mejora' : 'Empeora'
  }

  return 'Estable'
}

/**
 * Get trend color for UI
 */
export function getTrendColor(trend: Trend): string {
  switch (trend) {
    case 'Mejora':
      return 'text-green-600'
    case 'Empeora':
      return 'text-red-600'
    case 'Estable':
      return 'text-gray-500'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Get trend badge class for UI
 */
export function getTrendBadgeClass(trend: Trend): string {
  switch (trend) {
    case 'Mejora':
      return 'bg-green-600/10 text-green-700'
    case 'Empeora':
      return 'bg-red-600/10 text-red-700'
    case 'Estable':
      return 'bg-gray-500/10 text-gray-700'
    default:
      return 'bg-gray-500/10 text-gray-500'
  }
}





