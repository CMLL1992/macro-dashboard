/**
 * Dashboard Snapshot Helpers
 * 
 * Helpers para extraer datos del MacroSnapshot para usar en el dashboard.
 * Estos helpers permiten migrar secciones legacy a usar snapshot como single source of truth.
 */

import type { MacroSnapshot } from '@/domain/macro-snapshot/schema'
import type { DashboardData } from '@/lib/dashboard-data'

/**
 * Extract drivers from snapshot (for indicators table)
 */
export function getDriversFromSnapshot(snapshot: MacroSnapshot) {
  // Return drivers as-is (already in correct format)
  return snapshot.drivers
}

/**
 * Extract upcoming dates from snapshot (for calendar section)
 */
export function getUpcomingDatesFromSnapshot(snapshot: MacroSnapshot) {
  return snapshot.upcomingDates.map(date => ({
    name: date.name,
    date: date.date,
    importance: date.importance,
    country: date.country,
    currency: date.currency,
  }))
}

/**
 * Extract correlations from snapshot (for correlations section)
 */
export function getCorrelationsFromSnapshot(snapshot: MacroSnapshot) {
  return snapshot.correlations.map(corr => ({
    symbol: corr.symbol,
    benchmark: corr.benchmark || 'DXY',
    corr12m: corr.corr12m,
    corr6m: corr.corr6m,
    corr3m: corr.corr3m,
  }))
}

/**
 * Extract narrative from snapshot (for narrative section)
 */
export function getNarrativeFromSnapshot(snapshot: MacroSnapshot) {
  if (!snapshot.narrative) {
    return null
  }

  return {
    headline: snapshot.narrative.headline,
    bullets: snapshot.narrative.bullets,
    confidence: snapshot.narrative.confidence,
    tags: snapshot.narrative.tags || [],
  }
}

/**
 * Extract regime data from snapshot
 */
export function getRegimeFromSnapshot(snapshot: MacroSnapshot) {
  return {
    overall: snapshot.regime.overall,
    usd_direction: snapshot.regime.usd_direction,
    usd_label: snapshot.regime.usd_label || snapshot.usdBias,
    quad: snapshot.regime.quad,
    liquidity: snapshot.regime.liquidity,
    credit: snapshot.regime.credit,
    risk: snapshot.regime.risk,
  }
}

/**
 * Get USD bias from snapshot
 */
export function getUSDBiasFromSnapshot(snapshot: MacroSnapshot) {
  return snapshot.usdBias
}

/**
 * Get score from snapshot
 */
export function getScoreFromSnapshot(snapshot: MacroSnapshot) {
  return snapshot.score
}

/**
 * Merge snapshot data with legacy data (fallback pattern)
 * 
 * Priority: snapshot > legacy
 */
export function mergeSnapshotWithLegacy(
  snapshot: MacroSnapshot,
  legacyData: DashboardData
): {
  regime: ReturnType<typeof getRegimeFromSnapshot>
  usdBias: string
  score: number
  drivers: ReturnType<typeof getDriversFromSnapshot>
  upcomingDates: ReturnType<typeof getUpcomingDatesFromSnapshot>
  correlations: ReturnType<typeof getCorrelationsFromSnapshot>
  narrative: ReturnType<typeof getNarrativeFromSnapshot>
  // Legacy data as fallback
  indicators: DashboardData['indicators']
  tacticalRows: DashboardData['tacticalRows']
  scenarios: DashboardData['scenarios']
  recentEvents: DashboardData['recentEvents']
} {
  return {
    // From snapshot (priority)
    regime: getRegimeFromSnapshot(snapshot),
    usdBias: getUSDBiasFromSnapshot(snapshot),
    score: getScoreFromSnapshot(snapshot),
    drivers: getDriversFromSnapshot(snapshot),
    upcomingDates: getUpcomingDatesFromSnapshot(snapshot),
    correlations: getCorrelationsFromSnapshot(snapshot),
    narrative: getNarrativeFromSnapshot(snapshot),
    // Legacy data (fallback for sections not yet migrated)
    indicators: legacyData.indicators,
    tacticalRows: legacyData.tacticalRows,
    scenarios: legacyData.scenarios,
    recentEvents: legacyData.recentEvents,
  }
}

