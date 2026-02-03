/**
 * Job execution summary and alerting
 * Tracks errors by type, source, and indicator for quick diagnosis
 */

import { logger } from '@/lib/obs/logger'
import { getCircuitBreakerState } from '@/lib/datasources/oecd-rate-limiter'

export interface JobSummary {
  runId: string
  job: string
  country?: string
  durationMs: number
  okCount: number
  errorCount: number
  breakdownByErrorType: Record<string, number>
  breakdownBySource: Record<string, { success: number; failed: number }>
  topFailingIndicators: Array<{ indicatorKey: string; errorCount: number; errorTypes: string[] }>
  circuitBreakerState?: {
    oecd?: { isOpen: boolean; failures: number }
  }
}

export interface ErrorEntry {
  indicatorId: string
  error?: string
  errorType?: string
  status: string
}

interface IndicatorResult {
  indicator: { id: string }
  sourceUsed: string
  status: string
  errorEntry?: ErrorEntry
}

/**
 * Build job summary from results
 */
export function buildJobSummary(
  runId: string,
  job: string,
  country: string | undefined,
  durationMs: number,
  results: IndicatorResult[]
): JobSummary {
  const okCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status !== 'success' && r.status !== 'not_migrated' && r.status !== 'not_available').length

  // Breakdown by error type
  const breakdownByErrorType: Record<string, number> = {}
  results.forEach(r => {
    if (r.errorEntry?.errorType) {
      breakdownByErrorType[r.errorEntry.errorType] = (breakdownByErrorType[r.errorEntry.errorType] || 0) + 1
    }
  })

  // Breakdown by source
  const breakdownBySource: Record<string, { success: number; failed: number }> = {}
  results.forEach(r => {
    const source = r.sourceUsed || 'none'
    if (!breakdownBySource[source]) {
      breakdownBySource[source] = { success: 0, failed: 0 }
    }
    if (r.status === 'success') {
      breakdownBySource[source].success++
    } else if (r.status !== 'not_migrated' && r.status !== 'not_available') {
      breakdownBySource[source].failed++
    }
  })

  // Top 5 failing indicators (track across runs)
  const indicatorErrors = new Map<string, { count: number; errorTypes: Set<string> }>()
  results.forEach(r => {
    if (r.errorEntry) {
      const key = r.indicator.id
      if (!indicatorErrors.has(key)) {
        indicatorErrors.set(key, { count: 0, errorTypes: new Set() })
      }
      const entry = indicatorErrors.get(key)!
      entry.count++
      if (r.errorEntry.errorType) {
        entry.errorTypes.add(r.errorEntry.errorType)
      }
    }
  })

  const topFailingIndicators = Array.from(indicatorErrors.entries())
    .map(([indicatorKey, data]) => ({
      indicatorKey,
      errorCount: data.count,
      errorTypes: Array.from(data.errorTypes),
    }))
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5)

  // Circuit breaker state
  const circuitBreakerState = {
    oecd: getCircuitBreakerState('oecd'),
  }

  return {
    runId,
    job,
    country,
    durationMs,
    okCount,
    errorCount,
    breakdownByErrorType,
    breakdownBySource,
    topFailingIndicators,
    circuitBreakerState: circuitBreakerState.oecd ? { oecd: circuitBreakerState.oecd } : undefined,
  }
}

/**
 * Log job summary with structured format
 */
export function logJobSummary(summary: JobSummary): void {
  logger.info('job.summary', {
    runId: summary.runId,
    job: summary.job,
    country: summary.country,
    durationMs: summary.durationMs,
    okCount: summary.okCount,
    errorCount: summary.errorCount,
    breakdownByErrorType: summary.breakdownByErrorType,
    breakdownBySource: summary.breakdownBySource,
    topFailingIndicators: summary.topFailingIndicators,
    circuitBreakerState: summary.circuitBreakerState,
  })
}

/**
 * Check for alerts and log them
 */
export function checkAndLogAlerts(summary: JobSummary): void {
  const alerts: string[] = []

  // Alert: Too many rate limited
  if (summary.breakdownByErrorType.RATE_LIMITED && summary.breakdownByErrorType.RATE_LIMITED > 10) {
    alerts.push(`RATE_LIMITED > 10 (${summary.breakdownByErrorType.RATE_LIMITED})`)
  }

  // Alert: Too many source down
  if (summary.breakdownByErrorType.SOURCE_DOWN && summary.breakdownByErrorType.SOURCE_DOWN > 5) {
    alerts.push(`SOURCE_DOWN > 5 (${summary.breakdownByErrorType.SOURCE_DOWN})`)
  }

  // Alert: Circuit breaker open
  if (summary.circuitBreakerState?.oecd?.isOpen) {
    alerts.push(`OECD circuit breaker OPEN (failures: ${summary.circuitBreakerState.oecd.failures})`)
  }

  // Alert: High error rate (> 50% of indicators)
  const total = summary.okCount + summary.errorCount
  if (total > 0 && summary.errorCount / total > 0.5) {
    alerts.push(`High error rate: ${((summary.errorCount / total) * 100).toFixed(1)}%`)
  }

  if (alerts.length > 0) {
    logger.error('job.alert', {
      runId: summary.runId,
      job: summary.job,
      country: summary.country,
      alerts,
      summary: {
        okCount: summary.okCount,
        errorCount: summary.errorCount,
        breakdownByErrorType: summary.breakdownByErrorType,
      },
    })
  }
}
