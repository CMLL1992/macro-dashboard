/**
 * OECD Rate Limiter and Circuit Breaker
 * Controls concurrency, implements exponential backoff, and circuit breaker pattern
 */

import { logger } from '@/lib/obs/logger'

interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  isOpen: boolean
  timeoutMs?: number
}

// Circuit breaker state per source
const circuitBreakers = new Map<string, CircuitBreakerState>()

// Concurrency limiter: max concurrent requests per source
const MAX_CONCURRENT_OECD = 2
const activeRequests = new Map<string, number>()

// Backoff configuration
const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2
const CIRCUIT_BREAKER_THRESHOLD = 3 // Open circuit after 3 failures
const CIRCUIT_BREAKER_TIMEOUT_MS = 60000 // 60 seconds

/**
 * Get jittered backoff delay
 */
function getBackoffDelay(attempt: number): number {
  const baseDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_BACKOFF_MS
  )
  // Add jitter (±20%)
  const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1)
  return Math.max(100, baseDelay + jitter)
}

/**
 * Get circuit breaker state (for UI/logs visibility)
 */
export function getCircuitBreakerState(source: string = 'oecd'): CircuitBreakerState | null {
  const state = circuitBreakers.get(source)
  if (!state) return null

  return {
    isOpen: state.isOpen,
    failures: state.failures,
    lastFailureTime: state.lastFailureTime,
    timeoutMs: CIRCUIT_BREAKER_TIMEOUT_MS,
  }
}

/**
 * Check if circuit breaker is open for a source
 */
export function isCircuitOpen(source: string = 'oecd'): boolean {
  const state = circuitBreakers.get(source)
  if (!state) return false

  if (state.isOpen) {
    const timeSinceLastFailure = Date.now() - state.lastFailureTime
    if (timeSinceLastFailure > CIRCUIT_BREAKER_TIMEOUT_MS) {
      // Reset circuit breaker after timeout
      circuitBreakers.set(source, {
        failures: 0,
        lastFailureTime: 0,
        isOpen: false,
      })
      logger.info('oecd.circuit_breaker.reset', {
        source,
        timeSinceLastFailure,
      })
      return false
    }
    return true
  }

  return false
}

/**
 * Record a failure and update circuit breaker
 */
export function recordFailure(source: string = 'oecd', errorType: 'rate_limit' | 'http_500' | 'other' = 'other'): void {
  const state = circuitBreakers.get(source) || {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  }

  state.failures++
  state.lastFailureTime = Date.now()

  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    state.isOpen = true
    logger.warn('oecd.circuit_breaker.opened', {
      source,
      failures: state.failures,
      errorType,
      timeoutMs: CIRCUIT_BREAKER_TIMEOUT_MS,
    })
  }

  circuitBreakers.set(source, state)
}

/**
 * Record a success and reset circuit breaker
 */
export function recordSuccess(source: string = 'oecd'): void {
  const state = circuitBreakers.get(source)
  if (state && state.failures > 0) {
    state.failures = 0
    state.isOpen = false
    circuitBreakers.set(source, state)
    logger.info('oecd.circuit_breaker.success', { source })
  }
}

/**
 * Wait for available slot in concurrency limiter
 */
export async function waitForConcurrencySlot(source: string = 'oecd'): Promise<void> {
  const current = activeRequests.get(source) || 0
  
  if (current >= MAX_CONCURRENT_OECD) {
    // Wait a bit and retry
    await new Promise(resolve => setTimeout(resolve, 100))
    return waitForConcurrencySlot(source)
  }

  activeRequests.set(source, current + 1)
}

/**
 * Release concurrency slot
 */
export function releaseConcurrencySlot(source: string = 'oecd'): void {
  const current = activeRequests.get(source) || 0
  activeRequests.set(source, Math.max(0, current - 1))
}

/**
 * Execute with exponential backoff and retry limit
 */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  source: string = 'oecd'
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn()
      recordSuccess(source)
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const errorMsg = lastError.message

      // Don't retry on rate limit or circuit breaker
      if (errorMsg.includes('OECD_RATE_LIMIT_429') || errorMsg.includes('OECD_BLOCKED_403')) {
        recordFailure(source, 'rate_limit')
        throw lastError
      }

      // Don't retry if circuit is open
      if (isCircuitOpen(source)) {
        throw new Error(`OECD_CIRCUIT_OPEN: Circuit breaker is open for ${source}`)
      }

      // Record failure for 500 errors
      if (errorMsg.includes('OECD_HTTP_ERROR_500')) {
        recordFailure(source, 'http_500')
      } else {
        recordFailure(source, 'other')
      }

      // If this was the last attempt, throw
      if (attempt >= maxRetries) {
        throw lastError
      }

      // Calculate backoff delay
      const delay = getBackoffDelay(attempt)
      logger.info('oecd.backoff', {
        source,
        attempt: attempt + 1,
        maxRetries,
        delayMs: delay,
        error: errorMsg.substring(0, 100),
      })

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Unknown error in withBackoff')
}
