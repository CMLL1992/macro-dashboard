/**
 * Async Upsert utilities that work with both Turso and better-sqlite3
 * Automatically detects which database to use
 */

import { getUnifiedDB, isUsingTurso } from './unified-db'
import { getDB } from './schema'
import type { MacroSeries } from '@/lib/types/macro'
import type { MacroBias } from '@/lib/bias/types'
import type { BiasNarrative } from '@/lib/bias/explain'

/**
 * Upsert macro series and observations (async - works with both Turso and better-sqlite3)
 */
export async function upsertMacroSeriesAsync(series: MacroSeries): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    
    // Upsert series
    await db.prepare(`
      INSERT INTO macro_series (series_id, source, name, frequency, unit, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        name = excluded.name,
        frequency = excluded.frequency,
        unit = excluded.unit,
        last_updated = excluded.last_updated
    `).run(
      series.id,
      series.source,
      series.name,
      series.frequency,
      series.unit || null,
      series.lastUpdated || null
    )
    
    // Upsert observations
    const insertObs = db.prepare(`
      INSERT INTO macro_observations (series_id, date, value)
      VALUES (?, ?, ?)
      ON CONFLICT(series_id, date) DO UPDATE SET value = excluded.value
    `)
    
    // Insert/update all observations
    for (const point of series.data) {
      await insertObs.run(series.id, point.date, point.value)
    }
  } else {
    // Use sync version for better-sqlite3
    const { upsertMacroSeries } = await import('./upsert')
    upsertMacroSeries(series)
  }
}

/**
 * Upsert macro bias (async - works with both Turso and better-sqlite3)
 */
export async function upsertMacroBiasAsync(
  bias: MacroBias,
  narrative?: BiasNarrative
): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    
    await db.prepare(`
      INSERT INTO macro_bias (symbol, score, direction, confidence, drivers_json, narrative_json, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        score = excluded.score,
        direction = excluded.direction,
        confidence = excluded.confidence,
        drivers_json = excluded.drivers_json,
        narrative_json = excluded.narrative_json,
        computed_at = excluded.computed_at
    `).run(
      bias.symbol.toUpperCase(),
      bias.score,
      bias.direction,
      bias.confidence,
      JSON.stringify(bias.drivers),
      narrative ? JSON.stringify(narrative) : null,
      new Date().toISOString()
    )
  } else {
    // Use sync version for better-sqlite3
    const { upsertMacroBias } = await import('./upsert')
    upsertMacroBias(bias, narrative)
  }
}

/**
 * Upsert correlation (async - works with both Turso and better-sqlite3)
 */
export async function upsertCorrelationAsync(params: {
  symbol: string
  base: string
  window: '12m' | '3m'
  value: number | null
  asof: string
  n_obs: number
  last_asset_date?: string | null
  last_base_date?: string | null
}): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    
    await db.prepare(`
      INSERT INTO correlations (symbol, base, window, value, asof, n_obs, last_asset_date, last_base_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, base, window) DO UPDATE SET
        value = excluded.value,
        asof = excluded.asof,
        n_obs = excluded.n_obs,
        last_asset_date = excluded.last_asset_date,
        last_base_date = excluded.last_base_date
    `).run(
      params.symbol,
      params.base,
      params.window,
      params.value,
      params.asof,
      params.n_obs,
      params.last_asset_date || null,
      params.last_base_date || null
    )
  } else {
    // Use sync version for better-sqlite3
    const { upsertCorrelation } = await import('./upsert')
    upsertCorrelation(params)
  }
}

