/**
 * Simple in-memory cache for data source responses
 * TTL: 6-24 hours (configurable per source)
 * Key: source:indicator_key:country
 */

interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
}

const cache = new Map<string, CacheEntry>()

// TTL in milliseconds
const TTL_FRED = 6 * 60 * 60 * 1000 // 6 hours
const TTL_OECD = 24 * 60 * 60 * 1000 // 24 hours
const TTL_DEFAULT = 12 * 60 * 60 * 1000 // 12 hours

function getTTL(source: 'fred' | 'oecd' | 'trading_economics'): number {
  switch (source) {
    case 'fred':
      return TTL_FRED
    case 'oecd':
      return TTL_OECD
    default:
      return TTL_DEFAULT
  }
}

function getCacheKey(source: string, indicatorKey: string, country?: string): string {
  return `${source}:${indicatorKey}${country ? `:${country}` : ''}`
}

/**
 * Get cached data if available and not expired
 */
export function getCached(
  source: 'fred' | 'oecd' | 'trading_economics',
  indicatorKey: string,
  country?: string
): any | null {
  const key = getCacheKey(source, indicatorKey, country)
  const entry = cache.get(key)

  if (!entry) {
    return null
  }

  const age = Date.now() - entry.timestamp
  if (age > entry.ttl) {
    // Expired, remove it
    cache.delete(key)
    return null
  }

  return entry.data
}

/**
 * Set cache entry
 */
export function setCached(
  source: 'fred' | 'oecd' | 'trading_economics',
  indicatorKey: string,
  data: any,
  country?: string
): void {
  const key = getCacheKey(source, indicatorKey, country)
  const ttl = getTTL(source)

  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  })

  // Simple cleanup: if cache gets too large (> 1000 entries), remove oldest 20%
  if (cache.size > 1000) {
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, Math.floor(entries.length * 0.2))
    toRemove.forEach(([key]) => cache.delete(key))
  }
}

/**
 * Clear cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    age: Date.now() - entry.timestamp,
    ttl: entry.ttl,
  }))

  return {
    size: cache.size,
    entries: entries.slice(0, 10), // Return first 10 for debugging
  }
}
