/**
 * Performance Logger
 * 
 * Helper para medir y loguear tiempos de ejecución de funciones críticas.
 * Útil para identificar cuellos de botella en producción.
 */

import { logger } from '@/lib/obs/logger'

export interface PerformanceTimer {
  start: number
  label: string
  requestId?: string
}

/**
 * Start a performance timer
 */
export function startTimer(label: string, requestId?: string): PerformanceTimer {
  return {
    start: Date.now(),
    label,
    requestId,
  }
}

/**
 * End a performance timer and log the duration
 */
export function endTimer(timer: PerformanceTimer, metadata?: Record<string, unknown>): number {
  const duration = Date.now() - timer.start
  
  logger.info('performance.timing', {
    label: timer.label,
    durationMs: duration,
    requestId: timer.requestId,
    ...metadata,
  })
  
  return duration
}

/**
 * Measure async function execution time
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  requestId?: string,
  metadata?: Record<string, unknown>
): Promise<T> {
  const timer = startTimer(label, requestId)
  try {
    const result = await fn()
    endTimer(timer, { ...metadata, success: true })
    return result
  } catch (error) {
    endTimer(timer, { ...metadata, success: false, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

/**
 * Measure sync function execution time
 */
export function measureSync<T>(
  label: string,
  fn: () => T,
  requestId?: string,
  metadata?: Record<string, unknown>
): T {
  const timer = startTimer(label, requestId)
  try {
    const result = fn()
    endTimer(timer, { ...metadata, success: true })
    return result
  } catch (error) {
    endTimer(timer, { ...metadata, success: false, error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

