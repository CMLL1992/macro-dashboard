/**
 * Macro Snapshot Parser
 * 
 * Convierte datos de BiasState, MacroDiagnosis, CorrelationState
 * al formato MacroSnapshot validado.
 * 
 * Usage:
 *   import { parseMacroSnapshot } from '@/domain/macro-snapshot/parser'
 *   const result = parseMacroSnapshot({ biasState, correlationState, ... })
 *   if (result.ok) {
 *     // Use result.data (type-safe MacroSnapshot)
 *   }
 */

import { z } from 'zod'
import type { BiasState } from '@/domain/macro-engine/bias'
import type { CorrelationState } from '@/domain/macro-engine/correlations'
import type { MacroSnapshot, ParseResult, UpcomingDate, CorrelationRow, Narrative } from './schema'
import type { BiasDriver } from './schema' // Use schema type, not lib/bias/types
import { MacroSnapshotSchema } from './schema'
import { logger } from '@/lib/obs/logger'
import { extractUpcomingDates } from './adapters/calendar'
// Narrativas eliminadas
// import { extractNarrative } from './adapters/narratives'

/**
 * Normalize USD bias label
 */
function normalizeUSDBias(usdDirection: string): 'Fuerte' | 'Débil' | 'Neutral' {
  const lower = usdDirection.toLowerCase()
  if (lower.includes('fuerte') || lower.includes('strong') || lower.includes('hawkish')) {
    return 'Fuerte'
  }
  if (lower.includes('débil') || lower.includes('weak') || lower.includes('dovish')) {
    return 'Débil'
  }
  return 'Neutral'
}

/**
 * Extract drivers from BiasState table
 */
function extractDrivers(biasState: BiasState): BiasDriver[] {
  const drivers: BiasDriver[] = []
  
  // Extract from table rows (BiasRow from domain/bias.ts has: par, sesgoMacro, accion, motivo)
  // Note: BiasRow in domain/macro-engine/bias.ts has different structure (key, label, value, etc.)
  // We need to check which structure we're dealing with
  for (const row of biasState.table) {
    // Check if it's the legacy BiasRow format (from domain/bias.ts)
    const legacyRow = row as Record<string, unknown>
    if (legacyRow.motivo || legacyRow.par) {
      const driver: BiasDriver = {
        key: String(legacyRow.par || legacyRow.key || 'unknown'), // MacroSnapshot uses string, not BiasDriverKey
        name: String(legacyRow.par || legacyRow.label || 'unknown'),
        direction: legacyRow.accion === 'Buscar compras' ? 'long' : legacyRow.accion === 'Buscar ventas' ? 'short' : 'neutral',
        weight: typeof legacyRow.weight === 'number' ? legacyRow.weight : 1,
        note: legacyRow.motivo ? String(legacyRow.motivo) : legacyRow.motive ? String(legacyRow.motive) : undefined,
      }
      drivers.push(driver)
    } else if (legacyRow.label) {
      // New format (from domain/macro-engine/bias.ts)
      const driver: BiasDriver = {
        key: String(legacyRow.key || 'unknown'), // MacroSnapshot uses string, not BiasDriverKey
        name: String(legacyRow.label || 'unknown'),
        direction: 'neutral', // Default, can be enhanced
        weight: typeof legacyRow.weight === 'number' ? legacyRow.weight : 1,
        note: legacyRow.trend ? String(legacyRow.trend) : undefined,
      }
      drivers.push(driver)
    }
  }
  
  return drivers
}

// extractUpcomingDates is now imported from adapters/calendar

/**
 * Convert CorrelationState to CorrelationRow[]
 */
function extractCorrelations(correlationState: CorrelationState): CorrelationRow[] {
  const correlations: CorrelationRow[] = []
  
  for (const shift of correlationState.shifts) {
    correlations.push({
      symbol: shift.symbol,
      benchmark: shift.benchmark || 'DXY',
      corr12m: shift.corr12m ?? null,
      corr6m: null, // Not available in CorrelationShift
      corr3m: shift.corr3m ?? null,
      corrRef: shift.regime || undefined,
    })
  }
  
  return correlations
}

// Narrativas eliminadas - extractNarrative ya no se usa

/**
 * Calculate unified score from metrics
 */
function calculateUnifiedScore(metrics: BiasState['metrics']): number {
  // Simple average of available scores
  const scores: number[] = [metrics.usdScore]
  
  if (metrics.quadScore != null) scores.push(metrics.quadScore)
  if (metrics.liquidityScore != null) scores.push(metrics.liquidityScore)
  if (metrics.creditScore != null) scores.push(metrics.creditScore)
  if (metrics.riskScore != null) scores.push(metrics.riskScore)
  
  return scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : 0
}

/**
 * Parse Macro Snapshot from BiasState and CorrelationState
 * 
 * @param params - Input data
 * @returns ParseResult with validated MacroSnapshot or validation errors
 */
export async function parseMacroSnapshot(params: {
  biasState: BiasState
  correlationState?: CorrelationState
  nowTs?: string
}): Promise<ParseResult<MacroSnapshot>> {
  const { biasState, correlationState, nowTs = new Date().toISOString() } = params
  
  try {
    // Normalize USD bias
    const usdBias = normalizeUSDBias(biasState.regime.usd_direction)
    
    // Extract components (narrativas eliminadas)
    const drivers = extractDrivers(biasState)
    const upcomingDates = await extractUpcomingDates(14) // Next 14 days
    const narrative = undefined // Narrativas eliminadas
    const correlations = correlationState ? extractCorrelations(correlationState) : []
    
    // Calculate unified score
    const score = calculateUnifiedScore(biasState.metrics)
    
    // Build snapshot
    const snapshot: MacroSnapshot = {
      nowTs,
      regime: {
        overall: biasState.regime.overall,
        usd_direction: biasState.regime.usd_direction,
        usd_label: usdBias,
        quad: biasState.regime.quad,
        liquidity: biasState.regime.liquidity,
        credit: biasState.regime.credit,
        risk: biasState.regime.risk,
      },
      usdBias,
      score,
      drivers,
      upcomingDates,
      correlations,
      narrative,
      metrics: {
        usdScore: biasState.metrics.usdScore,
        quadScore: biasState.metrics.quadScore,
        liquidityScore: biasState.metrics.liquidityScore,
        creditScore: biasState.metrics.creditScore,
        riskScore: biasState.metrics.riskScore,
        score,
      },
      currencyRegimes: biasState.currencyRegimes,
      updatedAt: biasState.updatedAt.toISOString(),
    }
    
    // Validate with Zod
    const result = MacroSnapshotSchema.safeParse(snapshot)
    
    if (result.success) {
      return { ok: true, data: result.data }
    } else {
      logger.warn('macro-snapshot.parse_failed', {
        issues: result.error.issues,
        snapshot: JSON.stringify(snapshot).substring(0, 500),
      })
      return { ok: false, issues: result.error.issues }
    }
  } catch (error) {
    logger.error('macro-snapshot.parse_error', {
      error,
      cause: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: false,
      issues: [{
        code: z.ZodIssueCode.custom,
        path: [],
        message: error instanceof Error ? error.message : 'Unknown error',
      }],
    }
  }
}

/**
 * Parse Macro Snapshot from raw data (for API responses)
 * 
 * @param raw - Raw data object
 * @returns ParseResult with validated MacroSnapshot or validation errors
 */
export function parseMacroSnapshotFromRaw(raw: unknown): ParseResult<MacroSnapshot> {
  const result = MacroSnapshotSchema.safeParse(raw)
  
  if (result.success) {
    return { ok: true, data: result.data }
  } else {
    return { ok: false, issues: result.error.issues }
  }
}

