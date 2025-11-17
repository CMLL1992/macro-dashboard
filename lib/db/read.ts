/**
 * Read utilities for cached data
 */

import { getDB } from './schema'
import type { MacroSeries } from '@/lib/types/macro'
import type { MacroBias, BiasDirection, BiasDriver } from '@/lib/bias/types'
import type { BiasNarrative } from '@/lib/bias/explain'

/**
 * Get macro series from cache
 */
export function getMacroSeries(seriesId: string): MacroSeries | null {
  const db = getDB()

  const series = db
    .prepare('SELECT * FROM macro_series WHERE series_id = ?')
    .get(seriesId) as any

  if (!series) return null

  const observations = db
    .prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date ASC')
    .all(seriesId) as Array<{ date: string; value: number | null }>

  return {
    id: series.series_id,
    source: series.source as any,
    indicator: series.series_id,
    nativeId: series.series_id,
    name: series.name,
    frequency: series.frequency as any,
    unit: series.unit || undefined,
    data: observations,
    lastUpdated: series.last_updated || undefined,
  }
}

/**
 * Get latest macro bias from cache
 */
export function getMacroBias(symbol: string): {
  bias: MacroBias
  narrative: BiasNarrative | null
} | null {
  const db = getDB()

  const row = db
    .prepare('SELECT * FROM macro_bias WHERE symbol = ?')
    .get(symbol.toUpperCase()) as any

  if (!row) return null

  const bias: MacroBias = {
    score: row.score,
    direction: row.direction as any,
    confidence: row.confidence,
    drivers: JSON.parse(row.drivers_json),
    timestamp: row.computed_at,
    asset: symbol.toUpperCase(),
  }

  const narrative: BiasNarrative | null = row.narrative_json
    ? JSON.parse(row.narrative_json)
    : null

  return { bias, narrative }
}

/**
 * Get correlation from cache
 */
export function getCorrelation(
  symbol: string,
  base: string = 'DXY',
  window: '12m' | '3m' = '12m'
): {
  value: number | null
  asof: string
  n_obs: number
  last_asset_date: string | null
  last_base_date: string | null
} | null {
  const db = getDB()

  const row = db
    .prepare('SELECT * FROM correlations WHERE symbol = ? AND base = ? AND window = ?')
    .get(symbol.toUpperCase(), base.toUpperCase(), window) as any

  if (!row) return null

  return {
    value: row.value,
    asof: row.asof,
    n_obs: row.n_obs,
    last_asset_date: row.last_asset_date,
    last_base_date: row.last_base_date,
  }
}

/**
 * Get all correlations for a symbol
 */
export function getCorrelationsForSymbol(symbol: string, base: string = 'DXY'): {
  corr12m: number | null
  corr3m: number | null
  asof12m: string | null
  asof3m: string | null
  n_obs12m: number
  n_obs3m: number
} {
  const db = getDB()

  const rows = db
    .prepare('SELECT * FROM correlations WHERE symbol = ? AND base = ?')
    .all(symbol.toUpperCase(), base.toUpperCase()) as any[]

  const result = {
    corr12m: null as number | null,
    corr3m: null as number | null,
    asof12m: null as string | null,
    asof3m: null as string | null,
    n_obs12m: 0,
    n_obs3m: 0,
  }

  for (const row of rows) {
    if (row.window === '12m') {
      result.corr12m = row.value
      result.asof12m = row.asof
      result.n_obs12m = row.n_obs
    } else if (row.window === '3m') {
      result.corr3m = row.value
      result.asof3m = row.asof
      result.n_obs3m = row.n_obs
    }
  }

  return result
}

/**
 * Get correlations for multiple symbols at once (batch query to avoid N+1)
 * Returns a Map<symbol, {corr12m, corr3m, ...}>
 */
export function getCorrelationsForSymbols(symbols: string[], base: string = 'DXY'): Map<string, {
  corr12m: number | null
  corr3m: number | null
  asof12m: string | null
  asof3m: string | null
  n_obs12m: number
  n_obs3m: number
}> {
  const db = getDB()
  const result = new Map<string, {
    corr12m: number | null
    corr3m: number | null
    asof12m: string | null
    asof3m: string | null
    n_obs12m: number
    n_obs3m: number
  }>()

  if (symbols.length === 0) {
    return result
  }

  // Initialize all symbols with null values
  for (const symbol of symbols) {
    result.set(symbol.toUpperCase(), {
      corr12m: null,
      corr3m: null,
      asof12m: null,
      asof3m: null,
      n_obs12m: 0,
      n_obs3m: 0,
    })
  }

  // Single query for all symbols
  const placeholders = symbols.map(() => '?').join(',')
  const upperSymbols = symbols.map(s => s.toUpperCase())
  const rows = db
    .prepare(`SELECT * FROM correlations WHERE symbol IN (${placeholders}) AND base = ?`)
    .all(...upperSymbols, base.toUpperCase()) as any[]

  // Group by symbol
  for (const row of rows) {
    const symbol = row.symbol.toUpperCase()
    const existing = result.get(symbol)
    if (!existing) continue

    if (row.window === '12m') {
      existing.corr12m = row.value
      existing.asof12m = row.asof
      existing.n_obs12m = row.n_obs
    } else if (row.window === '3m') {
      existing.corr3m = row.value
      existing.asof3m = row.asof
      existing.n_obs3m = row.n_obs
    }
  }

  return result
}

/**
 * Get all correlations from database (fast, reads from cached table)
 * Returns array compatible with CorrRow format
 */
export function getAllCorrelationsFromDB(base: string = 'DXY'): Array<{
  activo: string
  corr12: number | null
  corr3: number | null
  corr6: number | null
  corr24: number | null
}> {
  const db = getDB()
  const rows = db
    .prepare('SELECT symbol, window, value FROM correlations WHERE base = ? AND value IS NOT NULL')
    .all(base.toUpperCase()) as Array<{ symbol: string; window: string; value: number }>

  // Group by symbol
  const bySymbol = new Map<string, {
    corr12: number | null
    corr3: number | null
    corr6: number | null
    corr24: number | null
  }>()

  for (const row of rows) {
    const symbol = row.symbol
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, { corr12: null, corr3: null, corr6: null, corr24: null })
    }
    const entry = bySymbol.get(symbol)!
    if (row.window === '12m') {
      entry.corr12 = row.value
    } else if (row.window === '3m') {
      entry.corr3 = row.value
    }
    // Note: 6m and 24m are not stored in DB, only 12m and 3m
  }

  // Convert to array format
  return Array.from(bySymbol.entries()).map(([activo, corr]) => ({
    activo,
    corr12: corr.corr12,
    corr3: corr.corr3,
    corr6: null, // Not stored in DB
    corr24: null, // Not stored in DB
  }))
}

export type MacroBiasRecord = {
  symbol: string
  score: number
  direction: BiasDirection
  confidence: number
  drivers: BiasDriver[]
  computed_at: string
}

export function getMacroTacticalBias(): MacroBiasRecord[] {
  const db = getDB()
  try {
    const rows = db
      .prepare('SELECT symbol, score, direction, confidence, drivers_json, computed_at FROM macro_bias ORDER BY symbol ASC')
      .all() as Array<{
        symbol: string
        score: number
        direction: string
        confidence: number
        drivers_json: string
        computed_at: string
      }>

    return rows.map((row) => ({
      symbol: row.symbol,
      score: row.score,
      direction: row.direction as BiasDirection,
      confidence: row.confidence,
      drivers: safeParseDrivers(row.drivers_json),
      computed_at: row.computed_at,
    }))
  } catch (error) {
    console.warn('[getMacroTacticalBias] Error reading macro_bias table:', error)
    return []
  }
}

function safeParseDrivers(json: string | null): BiasDriver[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed as BiasDriver[]
  } catch {}
  return []
}

export type LatestObservationSnapshot = {
  seriesId: string
  latestValue: number | null
  previousValue: number | null
  latestDate: string | null
  previousDate: string | null
}

export type LatestMacroObservations = {
  latestDate: string | null
  series: Map<string, LatestObservationSnapshot>
}

export function getLatestMacroObservations(): LatestMacroObservations {
  const db = getDB()
  const rows = db
    .prepare('SELECT series_id, date, value FROM macro_observations ORDER BY series_id, date DESC')
    .all() as Array<{ series_id: string; date: string; value: number | null }>

  const series = new Map<string, LatestObservationSnapshot>()
  let globalLatest: string | null = null

  for (const row of rows) {
    const current = series.get(row.series_id)
    if (!current) {
      series.set(row.series_id, {
        seriesId: row.series_id,
        latestValue: row.value,
        previousValue: null,
        latestDate: row.date,
        previousDate: null,
      })
      if (!globalLatest || row.date > globalLatest) {
        globalLatest = row.date
      }
    } else if (!current.previousDate) {
      current.previousDate = row.date
      current.previousValue = row.value
    }
  }

  return { latestDate: globalLatest, series }
}

/**
 * Get indicator history (current and previous values)
 */
export function getIndicatorHistory(indicatorKey: string): {
  value_current: number | null
  value_previous: number | null
  date_current: string | null
  date_previous: string | null
} | null {
  const db = getDB()

  const row = db
    .prepare('SELECT * FROM indicator_history WHERE indicator_key = ?')
    .get(indicatorKey.toUpperCase()) as any

  if (!row) return null

  return {
    value_current: row.value_current,
    value_previous: row.value_previous,
    date_current: row.date_current,
    date_previous: row.date_previous,
  }
}

/**
 * Get all indicator histories
 */
export function getAllIndicatorHistories(): Map<string, {
  value_current: number | null
  value_previous: number | null
  date_current: string | null
  date_previous: string | null
}> {
  const db = getDB()
  const rows = db.prepare('SELECT * FROM indicator_history').all() as any[]
  const map = new Map()

  for (const row of rows) {
    map.set(row.indicator_key, {
      value_current: row.value_current,
      value_previous: row.value_previous,
      date_current: row.date_current,
      date_previous: row.date_previous,
    })
  }

  return map
}




