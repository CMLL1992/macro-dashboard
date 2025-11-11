let DB_READY = false
let BOOTSTRAP_TS: string | null = null
let BOOTSTRAP_LOCK = false
let BOOTSTRAP_STARTED_AT: string | null = null
let FALLBACK_COUNT = 0
let LAST_BIAS_UPDATE_TS: string | null = null

export function setDbReady(ready: boolean) {
  DB_READY = ready
  if (ready && !BOOTSTRAP_TS) {
    BOOTSTRAP_TS = new Date().toISOString()
  }
}

export function isDbReady() {
  return DB_READY
}

export function getBootstrapTimestamp() {
  return BOOTSTRAP_TS
}

export function acquireBootstrapLock(): boolean {
  if (BOOTSTRAP_LOCK) {
    // Check if lock is stale (older than 10 minutes)
    if (BOOTSTRAP_STARTED_AT) {
      const started = new Date(BOOTSTRAP_STARTED_AT)
      const now = new Date()
      const durationMs = now.getTime() - started.getTime()
      if (durationMs > 10 * 60 * 1000) {
        // Lock is stale, release it
        BOOTSTRAP_LOCK = false
        BOOTSTRAP_STARTED_AT = null
      } else {
        return false // Lock is active
      }
    }
  }
  BOOTSTRAP_LOCK = true
  BOOTSTRAP_STARTED_AT = new Date().toISOString()
  return true
}

export function releaseBootstrapLock() {
  BOOTSTRAP_LOCK = false
  BOOTSTRAP_STARTED_AT = null
}

export function isBootstrapLocked() {
  return BOOTSTRAP_LOCK
}

export function getBootstrapStartedAt() {
  return BOOTSTRAP_STARTED_AT
}

export function incrementFallbackCount() {
  FALLBACK_COUNT++
}

export function getFallbackCount() {
  return FALLBACK_COUNT
}

export function setLastBiasUpdateTimestamp(timestamp: string) {
  LAST_BIAS_UPDATE_TS = timestamp
}

export function getLastBiasUpdateTimestamp() {
  return LAST_BIAS_UPDATE_TS
}
