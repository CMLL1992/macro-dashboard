/**
 * Multi-source resolver for macroeconomic indicators
 * Attempts to fetch data from sources in priority order: FRED → OECD
 * 
 * This resolver ensures we can get data for CAD/NZD/CHF and other currencies
 * without relying solely on TradingEconomics (which requires paid plans).
 */

import type { MacroSeries, Frequency } from '@/lib/types/macro'

function toFrequency(f: 'A' | 'Q' | 'M' | 'W' | 'D' | 'B' | undefined): Frequency {
  return f === 'B' ? 'D' : (f ?? 'M')
}
import { fetchFredSeries } from '@/lib/fred'
import { fetchOECDSeries, type OECDSeriesParams } from '@/lib/datasources/oecd'
import { logger } from '@/lib/obs/logger'
import { applySeriesTransformation } from '@/lib/utils/series-transforms'
import { isSourceEnabled, getSourceDisabledReason } from '@/lib/datasources/source-killswitch'

export interface IndicatorSourceConfig {
  /** Source priority: 'fred' | 'oecd' | 'trading_economics' */
  source: 'fred' | 'oecd' | 'trading_economics'
  /** FRED series ID (if source is 'fred') */
  fredSeriesId?: string
  /** OECD dataset and filter (if source is 'oecd') */
  oecdDataset?: string
  oecdFilter?: string
  /** TradingEconomics endpoint (if source is 'trading_economics') */
  tradingEconomicsEndpoint?: string
  tradingEconomicsCountry?: string
  /** Indicator metadata */
  indicatorId: string
  indicatorName: string
  frequency?: 'A' | 'Q' | 'M' | 'W' | 'D' | 'B'
  unit?: string
  /** Optional run identifier for logging/tracing */
  runId?: string
}

export interface ResolverResult {
  success: boolean
  macroSeries: MacroSeries | null
  sourceUsed: string | null
  error?: string
  errorType?: string
  sourceAttempts?: Array<{
    source: string
    attempted: boolean
    reason: string
    error?: string
    httpStatus?: number
    candidateCount?: number
  }>
}

/**
 * Resolve indicator data from multiple sources in priority order
 * 
 * Priority: FRED → OECD → (TradingEconomics as fallback if configured)
 * 
 * @param config Indicator source configuration
 * @returns ResolverResult with macroSeries and source used
 */
export async function resolveIndicatorFromMultipleSources(
  config: IndicatorSourceConfig
): Promise<ResolverResult> {
  const { indicatorId, indicatorName, frequency = 'M', unit } = config
  const requestId = `resolve-${indicatorId}-${Date.now()}`

  // Try FRED first (if configured)
  if (config.source === 'fred' && config.fredSeriesId) {
    try {
      logger.info('multi-source-resolver: trying FRED', {
        runId: config.runId,
        requestId,
        indicator_key: indicatorId,
        indicatorId,
        country: indicatorId.split('_')[0],
        source: 'fred',
        level: 'debug',
        event: 'fred_attempt',
        fredSeriesId: config.fredSeriesId,
      })

      const observations = await fetchFredSeries(config.fredSeriesId, {
        observation_start: '2010-01-01',
        observation_end: new Date().toISOString().slice(0, 10),
      })

      if (observations && observations.length > 0) {
        const macroSeries: MacroSeries = {
          id: indicatorId,
          source: 'FRED',
          indicator: indicatorId,
          nativeId: config.fredSeriesId,
          name: indicatorName,
          frequency: toFrequency(frequency),
          unit,
          data: observations.map(obs => ({
            date: obs.date,
            value: obs.value ?? null,
          })),
          lastUpdated: observations.length > 0 
            ? observations[observations.length - 1].date 
            : undefined,
          meta: {
            series_id: config.fredSeriesId,
          },
        }

        logger.info('multi-source-resolver: FRED success', {
          requestId,
          indicatorId,
          source: 'FRED',
          observations: observations.length,
          lastUpdated: macroSeries.lastUpdated,
        })

        return {
          success: true,
          macroSeries,
          sourceUsed: 'FRED',
        }
      } else {
        logger.warn('multi-source-resolver: FRED returned empty data', {
          requestId,
          indicatorId,
          fredSeriesId: config.fredSeriesId,
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.warn('multi-source-resolver: FRED failed', {
        requestId,
        indicatorId,
        fredSeriesId: config.fredSeriesId,
        error: errorMsg,
      })
      // Continue to next source
    }
  }

  // Try OECD second (if configured)
  if (config.source === 'oecd' && config.oecdDataset && config.oecdFilter) {
    try {
      logger.info('multi-source-resolver: trying OECD', {
        requestId,
        indicatorId,
        oecdDataset: config.oecdDataset,
        oecdFilter: config.oecdFilter,
      })

      const oecdParams: OECDSeriesParams = {
        dataset: config.oecdDataset,
        filter: config.oecdFilter,
        startPeriod: '2010-01',
        endPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM
      }

      let macroSeries: MacroSeries | null = null
      try {
        macroSeries = await fetchOECDSeries(oecdParams)
      } catch (error) {
        // If fetchOECDSeries throws, it might have tried fallback internally
        // Log and continue to check if we got a series
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.warn('multi-source-resolver: OECD fetch threw error (may have fallback)', {
          requestId,
          indicatorId,
          error: errorMsg,
        })
        // Don't return error yet - fallback might have succeeded
      }

      if (macroSeries && macroSeries.data && macroSeries.data.length > 0) {
        // Apply transformation if needed (YoY/QoQ from level series)
        let transformedData = macroSeries.data
        const transformType = (config as any).needsTransform || 'none'
        
        if (transformType === 'yoy' || transformType === 'qoq') {
          const originalLength = transformedData.length
          transformedData = applySeriesTransformation(
            macroSeries.data,
            macroSeries.frequency as Exclude<import('@/lib/types/macro').Frequency, 'B'>,
            transformType
          )
          
          logger.info('multi-source-resolver: applied transformation', {
            requestId,
            indicatorId,
            transformType,
            originalLength,
            transformedLength: transformedData.length,
            frequency: macroSeries.frequency,
          })
        }

        // Override id and name with our indicator metadata
        const normalizedSeries: MacroSeries = {
          ...macroSeries,
          id: indicatorId,
          indicator: indicatorId,
          name: indicatorName,
          frequency: toFrequency((frequency ?? macroSeries.frequency) as 'A' | 'Q' | 'M' | 'W' | 'D' | 'B' | undefined),
          unit,
          data: transformedData,
          lastUpdated: transformedData.length > 0 
            ? transformedData[transformedData.length - 1].date 
            : macroSeries.lastUpdated,
        }

        logger.info('multi-source-resolver: OECD success', {
          requestId,
          indicatorId,
          source: 'OECD',
          observations: transformedData.length,
          lastUpdated: normalizedSeries.lastUpdated,
          transformApplied: transformType !== 'none',
        })

        return {
          success: true,
          macroSeries: normalizedSeries,
          sourceUsed: 'OECD',
        }
      } else {
        logger.warn('multi-source-resolver: OECD returned empty data', {
          requestId,
          indicatorId,
          oecdDataset: config.oecdDataset,
          oecdFilter: config.oecdFilter,
        })
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // Check if it's a rate limit or block
      // IMPORTANT: Don't fail fast here - let the caller (resolveIndicatorWithFallback) 
      // try other sources (FRED) if available
      if (errorMsg.includes('OECD_RATE_LIMIT_429') || errorMsg.includes('OECD_BLOCKED_403')) {
        logger.warn('multi-source-resolver: OECD rate limit/block (will try other sources)', {
          requestId,
          indicatorId,
          oecdDataset: config.oecdDataset,
          oecdFilter: config.oecdFilter,
          error: errorMsg,
        })
        // Return error but don't block - let fallback try other sources
        return {
          success: false,
          macroSeries: null,
          sourceUsed: null,
          error: errorMsg,
          errorType: errorMsg.includes('RATE_LIMIT') ? 'rate_limit' : 'blocked',
        }
      }
      
      // Check if indicator is not available in source (404/400 after all fallbacks)
      if (errorMsg.includes('All fallback filters failed') || 
          (errorMsg.includes('404') && !errorMsg.includes('RATE_LIMIT'))) {
        logger.warn('multi-source-resolver: OECD indicator not available', {
          requestId,
          indicatorId,
          oecdDataset: config.oecdDataset,
          oecdFilter: config.oecdFilter,
          error: errorMsg,
        })
        return {
          success: false,
          macroSeries: null,
          sourceUsed: null,
          error: `Indicator not available in OECD dataset: ${errorMsg}`,
          errorType: 'not_available_in_source',
        }
      }
      
      logger.warn('multi-source-resolver: OECD failed', {
        requestId,
        indicatorId,
        oecdDataset: config.oecdDataset,
        oecdFilter: config.oecdFilter,
        error: errorMsg,
      })
      // Continue to next source (or return error)
    }
  }

  // If we have multiple sources configured, try fallback order
  // For now, we only support explicit source priority
  // Future: could implement automatic fallback (FRED → OECD → TE)

  // All sources failed
  return {
    success: false,
    macroSeries: null,
    sourceUsed: null,
    error: 'No data source available or all sources failed',
    errorType: 'no_data_source',
  }
}

/**
 * Resolve indicator with automatic fallback (FRED → OECD)
 * 
 * This is a convenience function that tries FRED first, then OECD,
 * based on available configuration.
 */
export async function resolveIndicatorWithFallback(
  config: {
    indicatorId: string
    indicatorName: string
    frequency?: 'A' | 'Q' | 'M' | 'W' | 'D' | 'B'
    unit?: string
    fredSeriesId?: string
    oecdDataset?: string
    oecdFilter?: string
    needsTransform?: 'yoy' | 'qoq' | 'none' // Indica si necesita calcular YoY/QoQ desde nivel
    runId?: string
  }
): Promise<ResolverResult> {
  const requestId = `resolver-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Track which sources were attempted and why they failed
  const sourceAttempts: Array<{
    source: string
    attempted: boolean
    reason: string
    error?: string
    httpStatus?: number
    candidateCount?: number
  }> = []
  
  // Try FRED first if available
  // Validate FRED series ID format (alphanumeric, optional _ and ., <= 25 chars)
  // More lenient: accepts A-Z, 0-9, _, . (but not spaces or special chars)
  let isValidFredId = false
  let fredValidationError: string | null = null

  if (config.fredSeriesId) {
    const fredId = config.fredSeriesId
    const fredIdType = typeof fredId
    const fredIdValue = String(fredId).trim()

    // Check type
    if (fredIdType !== 'string') {
      fredValidationError = `fredSeriesId is not a string (type: ${fredIdType})`
      isValidFredId = false
    } else if (fredIdValue.length === 0) {
      fredValidationError = 'fredSeriesId is empty string'
      isValidFredId = false
    } else if (fredIdValue.length > 25) {
      fredValidationError = `fredSeriesId too long (${fredIdValue.length} chars, max 25)`
      isValidFredId = false
    } else if (!/^[A-Za-z0-9_.]+$/.test(fredIdValue)) {
      fredValidationError = `fredSeriesId contains invalid characters (must be alphanumeric, _, or .)`
      isValidFredId = false
    } else {
      isValidFredId = true
    }

    // Log validation details for debugging
    if (!isValidFredId) {
      logger.warn('multi-source-resolver: Invalid FRED series ID format', {
        requestId,
        indicatorId: config.indicatorId,
        indicator_key: config.indicatorId,
        fredSeriesId: fredId,
        fredSeriesId_received: fredId,
        typeof_fredSeriesId: fredIdType,
        fredSeriesId_length: String(fredId).length,
        validationError: fredValidationError,
      })
    }
  }

  if (config.fredSeriesId && isValidFredId) {
    // Check kill-switch
    if (!isSourceEnabled('fred')) {
      const reason = getSourceDisabledReason('fred')
      sourceAttempts.push({
        source: 'fred',
        attempted: false,
        reason: reason || 'FRED disabled via DISABLE_FRED',
        error: 'SOURCE_DISABLED',
      })
      logger.warn('multi-source-resolver: FRED disabled via kill-switch', {
        requestId,
        indicatorId: config.indicatorId,
        reason,
      })
    } else {
      try {
        sourceAttempts.push({
          source: 'fred',
          attempted: true,
          reason: 'fredSeriesId configured and valid',
        })
        
        const fredResult = await resolveIndicatorFromMultipleSources({
          source: 'fred',
          indicatorId: config.indicatorId,
          indicatorName: config.indicatorName,
          frequency: config.frequency,
          unit: config.unit,
          fredSeriesId: config.fredSeriesId,
          runId: config.runId,
        })

      if (fredResult.success) {
        logger.info('multi-source-resolver: FRED success', {
          requestId,
          indicatorId: config.indicatorId,
          source: 'FRED',
        })
        return fredResult
      } else {
        sourceAttempts[sourceAttempts.length - 1].error = fredResult.error || 'Unknown FRED error'
        sourceAttempts[sourceAttempts.length - 1].reason = `FRED failed: ${fredResult.errorType || 'unknown'}`
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      sourceAttempts[sourceAttempts.length - 1].error = errorMsg
      sourceAttempts[sourceAttempts.length - 1].reason = `FRED exception: ${errorMsg}`
      logger.warn('multi-source-resolver: FRED exception', {
        requestId,
        indicatorId: config.indicatorId,
        error: errorMsg,
      })
      }
    }
  } else if (config.fredSeriesId && !isValidFredId) {
    // Invalid FRED series ID format - mark as MISCONFIG
    sourceAttempts.push({
      source: 'fred',
      attempted: false,
      reason: `fredSeriesId invalid format: "${config.fredSeriesId}" - ${fredValidationError || 'unknown error'}`,
      error: 'MISCONFIG: Invalid FRED series ID format',
    })
    logger.warn('multi-source-resolver: Invalid FRED series ID format (MISCONFIG)', {
      runId: config.runId,
      requestId,
      indicator_key: config.indicatorId,
      indicatorId: config.indicatorId,
      country: config.indicatorId.split('_')[0],
      source: 'fred',
      level: 'warn',
      event: 'fred_misconfig',
      errorType: 'MISCONFIG',
      fredSeriesId: config.fredSeriesId,
      typeof_fredSeriesId: typeof config.fredSeriesId,
      validationError: fredValidationError,
    })
  } else {
    sourceAttempts.push({
      source: 'fred',
      attempted: false,
      reason: 'fredSeriesId not configured',
    })
  }

  // Try OECD as fallback if available
  if (config.oecdDataset && config.oecdFilter) {
    // Check kill-switch
    if (!isSourceEnabled('oecd')) {
      const reason = getSourceDisabledReason('oecd')
      sourceAttempts.push({
        source: 'oecd',
        attempted: false,
        reason: reason || 'OECD disabled via DISABLE_OECD',
        error: 'SOURCE_DISABLED',
      })
      logger.warn('multi-source-resolver: OECD disabled via kill-switch', {
        requestId,
        indicatorId: config.indicatorId,
        reason,
      })
    } else {
      try {
        sourceAttempts.push({
          source: 'oecd',
          attempted: true,
          reason: 'oecdDataset and oecdFilter configured',
        })
        
        const oecdResult = await resolveIndicatorFromMultipleSources({
          source: 'oecd',
          indicatorId: config.indicatorId,
          indicatorName: config.indicatorName,
          frequency: config.frequency,
          unit: config.unit,
          oecdDataset: config.oecdDataset,
          oecdFilter: config.oecdFilter,
          needsTransform: config.needsTransform,
        } as any)

      if (oecdResult.success) {
        logger.info('multi-source-resolver: OECD success', {
          requestId,
          indicatorId: config.indicatorId,
          source: 'OECD',
        })
        return oecdResult
      } else {
        // Extract HTTP status and candidate info from error message if available
        const errorMsg = oecdResult.error || ''
        const httpStatusMatch = errorMsg.match(/HTTP (\d+)/) || errorMsg.match(/status[:\s]+(\d+)/i)
        const httpStatus = httpStatusMatch ? parseInt(httpStatusMatch[1]) : undefined
        
        sourceAttempts[sourceAttempts.length - 1].error = errorMsg
        sourceAttempts[sourceAttempts.length - 1].reason = `OECD failed: ${oecdResult.errorType || 'unknown'}`
        sourceAttempts[sourceAttempts.length - 1].httpStatus = httpStatus
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const httpStatusMatch = errorMsg.match(/429|403|404|400/)
      const httpStatus = httpStatusMatch ? parseInt(httpStatusMatch[0]) : undefined
      
      sourceAttempts[sourceAttempts.length - 1].error = errorMsg
      sourceAttempts[sourceAttempts.length - 1].reason = `OECD exception: ${errorMsg.substring(0, 100)}`
      sourceAttempts[sourceAttempts.length - 1].httpStatus = httpStatus
      
      logger.warn('multi-source-resolver: OECD exception', {
        runId: config.runId,
        requestId,
        indicator_key: config.indicatorId,
        indicatorId: config.indicatorId,
        country: config.indicatorId.split('_')[0],
        source: 'oecd',
        level: 'warn',
        event: 'oecd_exception',
        error: errorMsg,
        errorType: httpStatus === 429 ? 'RATE_LIMITED' : httpStatus === 500 ? 'SOURCE_DOWN' : 'unknown',
        httpStatus,
      })
      }
    }
  } else {
    sourceAttempts.push({
      source: 'oecd',
      attempted: false,
      reason: 'oecdDataset or oecdFilter not configured',
    })
  }

  // Determine final error type based on source attempts
  const hasMisconfig = sourceAttempts.some(s => s.error?.includes('MISCONFIG') || s.reason?.includes('invalid format'))
  const hasRateLimit = sourceAttempts.some(s => s.error?.includes('RATE_LIMIT') || s.httpStatus === 429)
  const hasSourceDown = sourceAttempts.some(s => s.error?.includes('HTTP_ERROR_500') || s.httpStatus === 500)
  const hasNoData = sourceAttempts.some(s => s.reason?.includes('empty') || s.reason?.includes('no data') || s.reason?.includes('No valid observations'))
  const hasBlocked = sourceAttempts.some(s => s.error?.includes('BLOCKED') || s.httpStatus === 403)
  const allNotFound = sourceAttempts.filter(s => s.attempted).every(s => s.httpStatus === 404 || s.httpStatus === 400)
  
  let finalErrorType: 'no_data_source' | 'MISCONFIG' | 'RATE_LIMITED' | 'SOURCE_DOWN' | 'NO_DATA' | 'blocked' | 'not_available_in_source' = 'no_data_source'
  let finalErrorReason: string = 'All sources failed or not configured'
  
  if (hasMisconfig) {
    finalErrorType = 'MISCONFIG'
    finalErrorReason = 'FRED series ID misconfigured'
  } else if (hasRateLimit) {
    finalErrorType = 'RATE_LIMITED'
    finalErrorReason = 'OECD rate limit exceeded'
  } else if (hasSourceDown) {
    finalErrorType = 'SOURCE_DOWN'
    finalErrorReason = 'OECD returning 500 errors'
  } else if (hasNoData) {
    finalErrorType = 'NO_DATA'
    finalErrorReason = 'Valid response but no data available'
  } else if (hasBlocked) {
    finalErrorType = 'blocked'
    finalErrorReason = 'OECD access blocked (403)'
  } else if (allNotFound) {
    finalErrorType = 'not_available_in_source'
    finalErrorReason = 'Indicator not found in configured sources'
  }

  // Log summary of all source attempts
  logger.error('multi-source-resolver: all sources failed', {
    requestId,
    indicatorId: config.indicatorId,
    sourceAttempts,
    finalErrorType,
    finalErrorReason,
    summary: {
      totalAttempted: sourceAttempts.filter(s => s.attempted).length,
      totalFailed: sourceAttempts.filter(s => s.attempted && s.error).length,
      rateLimited: sourceAttempts.some(s => s.httpStatus === 429),
      blocked: sourceAttempts.some(s => s.httpStatus === 403),
      notFound: sourceAttempts.some(s => s.httpStatus === 404),
    },
  })
  
  // Both failed
  return {
    success: false,
    macroSeries: null,
    sourceUsed: null,
    error: finalErrorReason,
    errorType: finalErrorType,
    sourceAttempts, // Include in result for detailed logging
  }
}
