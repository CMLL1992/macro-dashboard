/**
 * Dashboard Adapter
 * 
 * Convierte DashboardData a MacroSnapshot.
 * 
 * This is the critical adapter that ensures the dashboard
 * consumes MacroSnapshot (not BiasState loose + CorrelationState loose + ad-hoc things).
 * A central mapper prevents UI and API from "inventing fields" on their own.
 */

import type { DashboardData } from '@/lib/dashboard-data'
import type { MacroSnapshot } from '../schema'
import { parseMacroSnapshot } from '../parser'
import { getBiasState } from '@/domain/macro-engine/bias'
import { getCorrelationState } from '@/domain/macro-engine/correlations'
import { extractUpcomingDates } from './calendar'
// Narrativas eliminadas - extractNarrative ya no se usa
import { logger } from '@/lib/obs/logger'

/**
 * Convert DashboardData to MacroSnapshot
 * 
 * This adapter ensures consistency: the dashboard must consume MacroSnapshot,
 * not loose BiasState + CorrelationState + ad-hoc fields.
 * 
 * @param dashboardData - DashboardData from getDashboardData()
 * @param options - Optional: pre-fetched biasState and correlationState to avoid duplicate calls
 * @returns MacroSnapshot or null if conversion fails
 */
export async function dashboardToSnapshot(
  dashboardData: DashboardData,
  options?: {
    biasState?: Awaited<ReturnType<typeof getBiasState>>
    correlationState?: Awaited<ReturnType<typeof getCorrelationState>>
  }
): Promise<MacroSnapshot | null> {
  try {
    logger.debug('snapshot.build.start', {
      source: 'dashboard',
    })
    
    // OPTIMIZACIÓN: Reutilizar BiasState y CorrelationState si se pasan como opciones
    // Esto evita duplicar llamadas a getBiasState() y getCorrelationState()
    let biasState: Awaited<ReturnType<typeof getBiasState>>
    let correlationState: Awaited<ReturnType<typeof getCorrelationState>> | undefined

    if (options?.biasState && options?.correlationState) {
      // Usar estados pre-fetched (más rápido, evita duplicar llamadas)
      biasState = options.biasState
      correlationState = options.correlationState
      logger.debug('snapshot.build.reusing_prefetched_states', {
        source: 'dashboard',
      })
    } else {
      // Fallback: fetch fresh (más lento pero necesario si no se pasan)
      const [freshBiasState, freshCorrelationState] = await Promise.all([
        getBiasState(),
        getCorrelationState(),
      ])
      biasState = freshBiasState
      correlationState = freshCorrelationState
    }
    
    // Extract upcoming dates (narrativas eliminadas)
    const upcomingDates = await extractUpcomingDates(14) // Next 14 days
    const narrative = undefined // Narrativas eliminadas
    
    // Build snapshot using parser
    const result = await parseMacroSnapshot({
      biasState,
      correlationState,
      nowTs: dashboardData.updatedAt || new Date().toISOString(),
    })
    
    if (!result.ok) {
      logger.error('snapshot.build.failed', {
        source: 'dashboard',
        issues: result.issues,
      })
      return null
    }
    
    // Enhance snapshot with upcoming dates and narrative
    const snapshot: MacroSnapshot = {
      ...result.data,
      upcomingDates,
      narrative,
      updatedAt: dashboardData.updatedAt || result.data.updatedAt,
      biasUpdatedAt: dashboardData.biasUpdatedAt || result.data.updatedAt,
      correlationUpdatedAt: dashboardData.correlationUpdatedAt || result.data.updatedAt,
    }
    
    // Validate enhanced snapshot
    const { MacroSnapshotSchema } = await import('../schema')
    const validation = MacroSnapshotSchema.safeParse(snapshot)
    
    if (!validation.success) {
      logger.error('snapshot.build.validation_failed', {
        source: 'dashboard',
        issues: validation.error.issues,
      })
      return null
    }
    
    logger.info('snapshot.build.done', {
      source: 'dashboard',
      upcomingDatesCount: upcomingDates.length,
      hasNarrative: !!narrative,
    })
    
    return validation.data
  } catch (error) {
    logger.error('snapshot.build.error', {
      source: 'dashboard',
      error,
      cause: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Convert DashboardData to MacroSnapshot (fallback: extract from DashboardData directly)
 * 
 * This is a fallback method that extracts data directly from DashboardData
 * if the primary method (using fresh BiasState/CorrelationState) fails.
 * 
 * @param dashboardData - DashboardData from getDashboardData()
 * @returns MacroSnapshot or null if conversion fails
 */
export async function dashboardToSnapshotFallback(dashboardData: DashboardData): Promise<MacroSnapshot | null> {
  try {
    logger.debug('snapshot.build.fallback.start', {
      source: 'dashboard',
    })
    
    // Extract upcoming dates (narrativas eliminadas)
    const upcomingDates = await extractUpcomingDates(14)
    const narrative = undefined // Narrativas eliminadas
    
    // Build snapshot from DashboardData
    const snapshot: MacroSnapshot = {
      nowTs: dashboardData.updatedAt || new Date().toISOString(),
      regime: {
        overall: dashboardData.regime.overall,
        usd_direction: dashboardData.regime.usd_direction,
        usd_label: dashboardData.regime.usd_label,
        quad: dashboardData.regime.quad,
        liquidity: dashboardData.regime.liquidity,
        credit: dashboardData.regime.credit,
        risk: dashboardData.regime.risk,
      },
      usdBias: dashboardData.regime.usd_label || 'Neutral',
      score: dashboardData.metrics.usdScore, // Use usdScore as primary score
      drivers: [], // TODO: Extract from dashboardData.indicators or tacticalRows
      upcomingDates,
      correlations: dashboardData.correlations.shifts.map(shift => ({
        symbol: shift.symbol,
        benchmark: shift.benchmark || 'DXY',
        corr12m: shift.corr12m ?? null,
        corr6m: null, // Not available in CorrelationShift
        corr3m: shift.corr3m ?? null,
        corrRef: shift.regime || undefined,
      })),
      narrative,
      metrics: {
        usdScore: dashboardData.metrics.usdScore,
        quadScore: dashboardData.metrics.quadScore,
        liquidityScore: dashboardData.metrics.liquidityScore,
        creditScore: dashboardData.metrics.creditScore,
        riskScore: dashboardData.metrics.riskScore,
        score: dashboardData.metrics.usdScore,
      },
      currencyRegimes: dashboardData.currencyRegimes,
      updatedAt: dashboardData.updatedAt || undefined,
      biasUpdatedAt: dashboardData.biasUpdatedAt || undefined,
      correlationUpdatedAt: dashboardData.correlationUpdatedAt || undefined,
    }
    
    // Validate
    const { MacroSnapshotSchema } = await import('../schema')
    const validation = MacroSnapshotSchema.safeParse(snapshot)
    
    if (!validation.success) {
      logger.error('snapshot.build.fallback.validation_failed', {
        source: 'dashboard',
        issues: validation.error.issues,
      })
      return null
    }
    
    logger.info('snapshot.build.fallback.done', {
      source: 'dashboard',
      upcomingDatesCount: upcomingDates.length,
      hasNarrative: !!narrative,
    })
    
    return validation.data
  } catch (error) {
    logger.error('snapshot.build.fallback.error', {
      source: 'dashboard',
      error,
      cause: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

