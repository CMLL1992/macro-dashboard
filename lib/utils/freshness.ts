/**
 * Utility functions for calculating data freshness
 */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'

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
}

/**
 * SLA by frequency (in days)
 */
export const SLA_BY_FREQUENCY: Record<Frequency, { maxDays: number; useBusinessDays: boolean }> = {
  daily: { maxDays: 3, useBusinessDays: true },      // ≤ 3 días hábiles
  weekly: { maxDays: 10, useBusinessDays: false },    // ≤ 10 días naturales
  monthly: { maxDays: 60, useBusinessDays: false },   // ≤ 60 días naturales
  quarterly: { maxDays: 150, useBusinessDays: false }, // ≤ 150 días naturales
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
 * Check if a date is stale based on frequency-specific SLA
 */
export function isStaleByFrequency(
  dateStr: string | null | undefined,
  indicatorKey: string
): { isStale: boolean; daysDiff: number; frequency: Frequency; reason: string } {
  if (!dateStr) {
    return { isStale: true, daysDiff: Infinity, frequency: 'monthly', reason: 'No date' }
  }

  const frequency = INDICATOR_FREQUENCY[indicatorKey] ?? 'monthly' // Default to monthly if unknown
  const sla = SLA_BY_FREQUENCY[frequency]
  
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(23, 59, 59, 999) // End of day
  
  const daysDiff = sla.useBusinessDays
    ? businessDaysBetween(date, today)
    : calendarDaysBetween(date, today)
  
  const isStale = daysDiff > sla.maxDays
  
  const reason = sla.useBusinessDays ? 'business_days' : 'calendar_days'
  
  return { isStale, daysDiff, frequency, reason }
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

