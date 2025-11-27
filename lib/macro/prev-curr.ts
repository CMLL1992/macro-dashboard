/**
 * Robust calculation of previous and current values for macro indicators
 * Based on actual dates, not value comparisons
 */

export type Observation = {
  date: string
  value: number
}

export type PrevCurrResult = {
  previous: Observation | null
  current: Observation | null
}

/**
 * Compute previous and current values from observations
 * 
 * Requirements:
 * - Sort by date ascending (real Date, not string)
 * - current = last valid observation
 * - previous = last valid observation with different date than current.date
 * - If no previous, return null
 */
export function computePrevCurr(obs: Observation[]): PrevCurrResult {
  // Filter out invalid values and add date objects for sorting
  const sorted = obs
    .filter(o => o.value != null && Number.isFinite(o.value))
    .map(o => ({
      ...o,
      dateObj: new Date(o.date),
    }))
    .filter(o => !isNaN(o.dateObj.getTime())) // Filter invalid dates
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

  if (sorted.length === 0) {
    return { previous: null, current: null }
  }

  // Current is the last observation by date
  const current = sorted.at(-1)!

  // Find previous: last observation with different date AND different value than current
  // This ensures we show the last value that actually changed, not just a different date
  let previous: Observation | null = null
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i].date !== current.date && sorted[i].value !== current.value) {
      previous = sorted[i]
      break
    }
  }
  
  // If no previous with different value found, try to find any with different date
  // (fallback for cases where all recent values are the same)
  if (!previous) {
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i].date !== current.date) {
        previous = sorted[i]
        break
      }
    }
  }

  // Debug logging for specific indicators (only when DEBUG_DASHBOARD is enabled)
  if (process.env.DEBUG_DASHBOARD === 'true' || process.env.DEBUG_INDICATOR === 'true') {
    console.log('[debug-indicator] computePrevCurr', {
      totalObservations: sorted.length,
      latestDates: sorted.slice(-3).map(o => o.date),
      latestValues: sorted.slice(-3).map(o => o.value),
      prev: previous ? { date: previous.date, value: previous.value } : null,
      curr: { date: current.date, value: current.value },
    })
  }

  return {
    previous: previous ? { date: previous.date, value: previous.value } : null,
    current: { date: current.date, value: current.value },
  }
}

/**
 * Calculate if a series is stale based on its frequency
 * 
 * Thresholds:
 * - daily: 5 days
 * - weekly: 14 days
 * - monthly: 45 days
 * - quarterly: 120 days
 * - default: 30 days
 */
const STALE_BY_FREQ: Record<string, number> = {
  daily: 5,
  d: 5,
  weekly: 14,
  w: 14,
  monthly: 45,
  m: 45,
  quarterly: 120,
  q: 120,
  annual: 365,
  a: 365,
}

export function isStale(currentDate: string | null, frequency: string): boolean {
  if (!currentDate) return true

  const threshold = STALE_BY_FREQ[frequency.toLowerCase()] ?? 30
  const last = new Date(currentDate).getTime()
  
  if (isNaN(last)) return true

  const now = Date.now()
  const daysOld = (now - last) / (1000 * 60 * 60 * 24)

  return daysOld > threshold
}

/**
 * Get frequency from series metadata or infer from observations
 */
export function getFrequency(seriesFrequency?: string | null): string {
  if (!seriesFrequency) return 'monthly'
  
  const freq = seriesFrequency.toLowerCase()
  if (freq in STALE_BY_FREQ) return freq
  
  // Map common frequency codes
  const freqMap: Record<string, string> = {
    'd': 'daily',
    'w': 'weekly',
    'm': 'monthly',
    'q': 'quarterly',
    'a': 'annual',
  }
  
  return freqMap[freq] || 'monthly'
}

