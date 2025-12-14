/**
 * Utility functions for calculating data freshness
 */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'irregular'

/**
 * Freshness status
 */
export type Freshness = 'FRESH' | 'STALE' | 'PENDING'

/**
 * Frequency metadata for each indicator key
 */
export const INDICATOR_FREQUENCY: Record<string, Frequency> = {
  // Diaria
  t10y2y: 'daily',
  vix: 'daily',
  // Semanal
  claims_4w: 'weekly',
  // Mensual
  cpi_yoy: 'monthly',
  corecpi_yoy: 'monthly',
  pce_yoy: 'monthly',
  corepce_yoy: 'monthly',
  ppi_yoy: 'monthly',
  unrate: 'monthly',
  payems_delta: 'monthly',
  indpro_yoy: 'monthly',
  retail_yoy: 'monthly',
  fedfunds: 'monthly',
  // Trimestral
  gdp_yoy: 'quarterly',
  gdp_qoq: 'quarterly',
  // Indicadores europeos - Crecimiento / Actividad
  eu_gdp_qoq: 'quarterly',
  eu_gdp_yoy: 'quarterly',
  eu_pmi_manufacturing: 'monthly',
  eu_pmi_services: 'monthly',
  eu_pmi_composite: 'monthly',
  eu_retail_sales_yoy: 'monthly',
  eu_retail_sales_mom: 'monthly',
  eu_industrial_production_yoy: 'monthly',
  eu_consumer_confidence: 'monthly',
  eu_zew_sentiment: 'monthly',
  // Mercado laboral
  eu_unemployment: 'monthly',
  // Precios / Inflación
  eu_cpi_yoy: 'monthly',
  eu_cpi_core_yoy: 'monthly',
  // Otros
  eu_ecb_rate: 'irregular',
}

/**
 * Maximum lag days (tolerance) for each indicator before marking as stale
 * These values account for natural publication lags in macroeconomic data
 */
export const INDICATOR_MAX_LAG_DAYS: Record<string, number> = {
  // EEUU / Global - Daily
  t10y2y: 7,
  vix: 7,
  // EEUU / Global - Weekly
  claims_4w: 14,
  // EEUU / Global - Monthly
  unrate: 60,
  payems_delta: 60, // NFP
  cpi_yoy: 60,
  corecpi_yoy: 60,
  pce_yoy: 75,
  corepce_yoy: 75,
  ppi_yoy: 75,
  indpro_yoy: 90,
  retail_yoy: 75,
  fedfunds: 60,
  // EEUU / Global - Quarterly
  gdp_yoy: 150,
  gdp_qoq: 150,
  // Indicadores europeos - Crecimiento / Actividad
  eu_gdp_qoq: 150,
  eu_gdp_yoy: 150,
  eu_pmi_manufacturing: 45,
  eu_pmi_services: 45,
  eu_pmi_composite: 45,
  eu_retail_sales_yoy: 75,
  eu_retail_sales_mom: 75,
  eu_industrial_production_yoy: 90,
  eu_consumer_confidence: 60,
  eu_zew_sentiment: 60,
  // Mercado laboral
  eu_unemployment: 75,
  // Precios / Inflación
  eu_cpi_yoy: 60,
  eu_cpi_core_yoy: 60,
  // Otros
  eu_ecb_rate: 120, // Irregular - puede pasar tiempo sin cambios
}

/**
 * SLA by frequency (in days)
 * Note: This is kept for backward compatibility, but computeFreshness uses INDICATOR_MAX_LAG_DAYS instead
 */
export const SLA_BY_FREQUENCY: Record<Frequency, { maxDays: number; useBusinessDays: boolean }> = {
  daily: { maxDays: 3, useBusinessDays: true },      // ≤ 3 días hábiles
  weekly: { maxDays: 10, useBusinessDays: false },    // ≤ 10 días naturales
  monthly: { maxDays: 60, useBusinessDays: false },   // ≤ 60 días naturales
  quarterly: { maxDays: 150, useBusinessDays: false }, // ≤ 150 días naturales
  irregular: { maxDays: 120, useBusinessDays: false }, // ≤ 120 días naturales (para indicadores irregulares como ECB rate)
}

/**
 * Calculate business days between two dates (excluding weekends)
 */
export function businessDaysBetween(date1: Date, date2: Date): number {
  let count = 0
  const start = new Date(date1)
  const end = new Date(date2)
  
  // Ensure start <= end
  if (start > end) {
    const temp = start
    start.setTime(end.getTime())
    end.setTime(temp.getTime())
  }
  
  while (start <= end) {
    const dayOfWeek = start.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday (6) or Sunday (0)
      count++
    }
    start.setDate(start.getDate() + 1)
  }
  
  return count
}

/**
 * Calculate calendar days between two dates
 */
export function calendarDaysBetween(date1: Date, date2: Date): number {
  const start = new Date(date1)
  const end = new Date(date2)
  
  // Ensure start <= end
  if (start > end) {
    const temp = start
    start.setTime(end.getTime())
    end.setTime(temp.getTime())
  }
  
  const diffTime = end.getTime() - start.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calculate difference in days between two dates
 */
function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

/**
 * Compute freshness status for an indicator
 * This is the centralized function for freshness calculation
 * 
 * @param indicatorId - The indicator ID (e.g., 'eu_gdp_qoq', 'cpi_yoy')
 * @param lastDate - The last date of the indicator data (or null if no data)
 * @param today - Optional current date (defaults to now)
 * @returns Freshness status: 'FRESH', 'STALE', or 'PENDING'
 */
export function computeFreshness(
  indicatorId: string,
  lastDate: Date | null,
  today: Date = new Date()
): Freshness {
  if (!lastDate) {
    return 'PENDING'
  }
  
  const maxLagDays = INDICATOR_MAX_LAG_DAYS[indicatorId.toLowerCase()] ?? 60 // Default to 60 days if unknown
  const daysSinceLast = diffDays(today, lastDate)
  
  return daysSinceLast > maxLagDays ? 'STALE' : 'FRESH'
}

/**
 * Check if a date is stale based on frequency-specific SLA
 * @deprecated Use computeFreshness instead for per-indicator maxLagDays
 */
export function isStaleByFrequency(
  dateStr: string | null | undefined,
  indicatorKey: string
): { isStale: boolean; daysDiff: number; frequency: Frequency; reason: string } {
  if (!dateStr) {
    return { isStale: true, daysDiff: Infinity, frequency: 'monthly', reason: 'No date' }
  }

  // Use new computeFreshness function for consistency
  const lastDate = new Date(dateStr)
  const freshness = computeFreshness(indicatorKey, lastDate)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of day
  
  const daysDiff = calendarDaysBetween(lastDate, today)
  const frequency = INDICATOR_FREQUENCY[indicatorKey.toLowerCase()] ?? 'monthly'
  
  return { 
    isStale: freshness === 'STALE', 
    daysDiff, 
    frequency, 
    reason: 'calendar_days' 
  }
}

/**
 * Get frequency label for display
 */
export function getFrequencyLabel(frequency: Frequency): string {
  const labels: Record<Frequency, string> = {
    daily: 'diaria',
    weekly: 'semanal',
    monthly: 'mensual',
    quarterly: 'trimestral',
    irregular: 'irregular',
  }
  return labels[frequency]
}

/**
 * Legacy function for backward compatibility (deprecated, use isStaleByFrequency)
 */
export function isStale(dateStr: string | null | undefined, maxBusinessDays: number = 3): boolean {
  if (!dateStr) return true
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of day
  const businessDays = businessDaysBetween(date, today)
  return businessDays > maxBusinessDays
}

