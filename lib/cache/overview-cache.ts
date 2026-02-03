/**
 * Simple in-memory cache for overview data
 * Used to share prefetched data between OverviewPrefetch and MacroOverviewDashboard
 */

interface CachedOverview {
  data: any
  timestamp: number
  horizon: string
}

const CACHE_TTL = 120000 // 120 seconds (2 minutos) - balance entre frescura y reutilización
const cache = new Map<string, CachedOverview>()

export function setOverviewCache(horizon: string, data: any) {
  cache.set(horizon, {
    data,
    timestamp: Date.now(),
    horizon,
  })
}

export function getOverviewCache(horizon: string): any | null {
  const cached = cache.get(horizon)
  if (!cached) return null
  
  const age = Date.now() - cached.timestamp
  if (age > CACHE_TTL) {
    cache.delete(horizon)
    return null
  }
  
  return cached.data
}

export function clearOverviewCache() {
  cache.clear()
}
