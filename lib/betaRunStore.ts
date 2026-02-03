/**
 * Global run status store for BETA phase
 * Uses globalThis to persist across HMR and module reloads
 */

interface RunStatus {
  runId: string
  job: string
  country?: string
  status: 'running' | 'complete' | 'error'
  startTime: number
  durationMs?: number
  summary?: {
    ingested: number
    failed: number
    notMigrated: number
    notAvailable: number
    total: number
    okCount?: number
    errorCount?: number
    breakdownByErrorType?: Record<string, number>
    breakdownBySource?: Record<string, { success: number; failed: number }>
    topFailingIndicators?: Array<{ indicatorKey: string; errorCount: number; errorTypes: string[] }>
    circuitBreakerState?: {
      oecd?: { isOpen: boolean; failures: number }
    }
  }
  error?: string
}

// Use globalThis to persist across HMR reloads
declare global {
  // eslint-disable-next-line no-var
  var __BETA_LATEST_RUN__: Map<string, RunStatus> | undefined
}

function getStore(): Map<string, RunStatus> {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__BETA_LATEST_RUN__) {
      globalThis.__BETA_LATEST_RUN__ = new Map<string, RunStatus>()
    }
    return globalThis.__BETA_LATEST_RUN__
  }
  // Fallback for environments without globalThis (shouldn't happen in Node.js)
  return new Map<string, RunStatus>()
}

/**
 * Store a run status
 */
export function storeRunStatus(run: RunStatus): void {
  const store = getStore()
  const key = run.country?.toLowerCase() || 'all'
  store.set(key, run)
  
  // Keep only last 10 runs per key
  if (store.size > 10) {
    const entries = Array.from(store.entries())
    entries.slice(0, -10).forEach(([k]) => store.delete(k))
  }
}

/**
 * Get latest run status for a country (or 'all')
 */
export function getLatestRunStatus(country?: string): RunStatus | null {
  const store = getStore()
  const key = country?.toLowerCase() || 'all'
  return store.get(key) || null
}

/**
 * Get all stored runs
 */
export function getAllRuns(): Map<string, RunStatus> {
  return getStore()
}

/**
 * Clear all runs (useful for testing)
 */
export function clearAllRuns(): void {
  const store = getStore()
  store.clear()
}
