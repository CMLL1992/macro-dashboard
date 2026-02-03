/**
 * Global event store for BETA phase
 * Stores system events for monitoring dashboard
 * Uses globalThis to persist across HMR and module reloads
 */

export interface SystemEvent {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  meta?: {
    job?: string
    country?: string
    indicatorId?: string
    runId?: string
    [key: string]: any
  }
}

const MAX_EVENTS = 500 // Keep last 500 events

// Use globalThis to persist across HMR reloads
declare global {
  // eslint-disable-next-line no-var
  var __BETA_EVENT_STORE__: SystemEvent[] | undefined
}

function getStore(): SystemEvent[] {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__BETA_EVENT_STORE__) {
      globalThis.__BETA_EVENT_STORE__ = []
    }
    return globalThis.__BETA_EVENT_STORE__
  }
  return []
}

/**
 * Emit an event to the store
 */
export function emitEvent(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  meta?: SystemEvent['meta']
): void {
  const store = getStore()
  const event: SystemEvent = {
    timestamp: Date.now(),
    level,
    message,
    meta: meta || {},
  }

  store.push(event)

  // Keep only last MAX_EVENTS
  if (store.length > MAX_EVENTS) {
    store.shift() // Remove oldest
  }
}

/**
 * Get events filtered by criteria
 */
export function getEvents(filters?: {
  since?: number
  country?: string
  level?: 'info' | 'warn' | 'error' | 'debug'
  indicatorId?: string
  limit?: number
}): SystemEvent[] {
  const store = getStore()
  let filtered = [...store] // Copy array

  // Filter by timestamp
  if (filters?.since) {
    filtered = filtered.filter(e => e.timestamp >= filters.since!)
  }

  // Filter by country
  if (filters?.country) {
    filtered = filtered.filter(e => 
      e.meta?.country?.toLowerCase() === filters.country?.toLowerCase()
    )
  }

  // Filter by level
  if (filters?.level) {
    filtered = filtered.filter(e => e.level === filters.level)
  }

  // Filter by indicatorId
  if (filters?.indicatorId) {
    filtered = filtered.filter(e => e.meta?.indicatorId === filters.indicatorId)
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp - a.timestamp)

  // Limit results
  if (filters?.limit) {
    filtered = filtered.slice(0, filters.limit)
  }

  return filtered
}

/**
 * Clear all events (useful for testing)
 */
export function clearEvents(): void {
  const store = getStore()
  store.length = 0
}

/**
 * Get event count
 */
export function getEventCount(): number {
  return getStore().length
}
