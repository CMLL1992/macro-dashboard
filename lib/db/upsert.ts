/**
 * Upsert utilities for idempotent persistence
 * Works with both Turso (async) and better-sqlite3 (sync)
 */

import { getDB } from './schema'
import { getUnifiedDB, isUsingTurso } from './unified-db'
import type { MacroSeries } from '@/lib/types/macro'
import type { MacroBias } from '@/lib/bias/types'
import type { BiasNarrative } from '@/lib/bias/explain'

/**
 * Upsert macro series and observations
 * Automatically uses Turso if configured, otherwise better-sqlite3
 */
export async function upsertMacroSeries(series: MacroSeries): Promise<void> {
  // Log input data
  console.log(
    JSON.stringify({
      level: "debug",
      message: "upsertMacroSeries input",
      series_id: series.id,
      points: series.data.length,
      firstDate: series.data[0]?.date,
      lastDate: series.data[series.data.length - 1]?.date,
    })
  )

  try {
    if (isUsingTurso()) {
      // Use Turso (async)
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
      
      // Upsert observations (date = realtime_start, observation_period = observation_date)
      const insertObs = db.prepare(`
        INSERT INTO macro_observations (series_id, date, value, observation_period)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(series_id, date) DO UPDATE SET 
          value = excluded.value,
          observation_period = COALESCE(excluded.observation_period, observation_period)
      `)
      
      // Insert/update all observations
      let inserted = 0
      for (const point of series.data) {
        await insertObs.run(
          series.id, 
          point.date, // realtime_start (fecha de publicación)
          point.value,
          (point as any).observation_period || null // observation_date (periodo del dato)
        )
        inserted++
      }
      
      console.log(
        JSON.stringify({
          level: "info",
          message: "upsertMacroSeries finished (Turso)",
          series_id: series.id,
          inserted,
        })
      )
      
      // Note: We don't delete old observations when using Turso to preserve historical data
      // The ON CONFLICT clause ensures we update existing dates and insert new ones
    } else {
      // Use better-sqlite3 (sync)
      const db = getDB()

      // Check current state in DB before insert
      const checkStmt = db.prepare(
        `SELECT COUNT(*) as n, MAX(date) as max_date 
         FROM macro_observations 
         WHERE series_id = ?`
      )
      const beforeState = checkStmt.get(series.id) as { n: number; max_date: string | null } | undefined

      // Upsert series
      const insertSeries = db.prepare(`
        INSERT INTO macro_series (series_id, source, name, frequency, unit, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(series_id) DO UPDATE SET
          name = excluded.name,
          frequency = excluded.frequency,
          unit = excluded.unit,
          last_updated = excluded.last_updated
      `)

      insertSeries.run(
        series.id,
        series.source,
        series.name,
        series.frequency,
        series.unit || null,
        series.lastUpdated || null
      )

      // Upsert observations (date = realtime_start, observation_period = observation_date)
      const insertObs = db.prepare(`
        INSERT INTO macro_observations (series_id, date, value, observation_period)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(series_id, date) DO UPDATE SET 
          value = excluded.value,
          observation_period = COALESCE(excluded.observation_period, observation_period)
      `)

      // Insert/update observations directly (no transaction needed for better-sqlite3)
      // Insert in batches to avoid SQLite parameter limits
      const batchSize = 1000
      let inserted = 0
      for (let i = 0; i < series.data.length; i += batchSize) {
        const batch = series.data.slice(i, i + batchSize)
        for (const point of batch) {
          const result = insertObs.run(
            series.id, 
            point.date, // realtime_start (fecha de publicación)
            point.value,
            (point as any).observation_period || point.date || null // observation_date (periodo del dato), fallback to date if not available
          )
          inserted++
        }
      }
      
      // Check state after insert
      const afterState = checkStmt.get(series.id) as { n: number; max_date: string | null } | undefined
      
      console.log(
        JSON.stringify({
          level: "info",
          message: "upsertMacroSeries finished (SQLite)",
          series_id: series.id,
          inserted,
          beforeState: beforeState || { n: 0, max_date: null },
          afterState: afterState || { n: 0, max_date: null },
        })
      )
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "upsertMacroSeries failed",
        series_id: series.id,
        error: String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    )
    throw err
  }
}

/**
 * Upsert macro bias
 * GUARDRAIL: Only allows symbols from tactical-pairs.json
 */
export async function upsertMacroBias(
  bias: MacroBias,
  narrative?: BiasNarrative
): Promise<void> {
  // Guardrail: Filter by allowlist before inserting
  const { isAllowedPair } = await import('@/config/tactical-pairs')
  if (!isAllowedPair(bias.asset)) {
    console.warn(`[upsertMacroBias] Rejected non-allowed symbol: ${bias.asset}`)
    return // Silently skip - don't insert non-allowed symbols
  }
  
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
      bias.asset,
      bias.score,
      bias.direction,
      bias.confidence,
      JSON.stringify(bias.drivers),
      narrative ? JSON.stringify(narrative) : null,
      bias.timestamp
    )
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO macro_bias (symbol, score, direction, confidence, drivers_json, narrative_json, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        score = excluded.score,
        direction = excluded.direction,
        confidence = excluded.confidence,
        drivers_json = excluded.drivers_json,
        narrative_json = excluded.narrative_json,
        computed_at = excluded.computed_at
    `)
    stmt.run(
      bias.asset,
      bias.score,
      bias.direction,
      bias.confidence,
      JSON.stringify(bias.drivers),
      narrative ? JSON.stringify(narrative) : null,
      bias.timestamp
    )
  }
}

/**
 * Upsert correlation
 * GUARDRAIL: Only allows symbols from tactical-pairs.json
 */
export async function upsertCorrelation(params: {
  symbol: string
  base: string
  window: '12m' | '3m'
  value: number | null
  asof: string
  n_obs: number
  last_asset_date?: string | null
  last_base_date?: string | null
}): Promise<void> {
  // Guardrail: Filter by allowlist before inserting
  const { isAllowedPair } = await import('@/config/tactical-pairs')
  const normalizedSymbol = params.symbol.toUpperCase()
  if (!isAllowedPair(normalizedSymbol)) {
    console.warn(`[upsertCorrelation] Rejected non-allowed symbol: ${normalizedSymbol}`)
    return // Silently skip - don't insert non-allowed symbols
  }
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
      params.symbol.toUpperCase(),
      params.base.toUpperCase(),
      params.window,
      params.value,
      params.asof,
      params.n_obs,
      params.last_asset_date || null,
      params.last_base_date || null
    )

    // Optional: insert into history
    if (params.value != null) {
      await db.prepare(`
        INSERT INTO correlations_history (symbol, base, window, value, n_obs)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        params.symbol.toUpperCase(),
        params.base.toUpperCase(),
        params.window,
        params.value,
        params.n_obs
      )
    }
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO correlations (symbol, base, window, value, asof, n_obs, last_asset_date, last_base_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, base, window) DO UPDATE SET
        value = excluded.value,
        asof = excluded.asof,
        n_obs = excluded.n_obs,
        last_asset_date = excluded.last_asset_date,
        last_base_date = excluded.last_base_date
    `)
    stmt.run(
      params.symbol.toUpperCase(),
      params.base.toUpperCase(),
      params.window,
      params.value,
      params.asof,
      params.n_obs,
      params.last_asset_date || null,
      params.last_base_date || null
    )

    // Optional: insert into history
    if (params.value != null) {
      const histStmt = db.prepare(`
        INSERT INTO correlations_history (symbol, base, window, value, n_obs)
        VALUES (?, ?, ?, ?, ?)
      `)
      histStmt.run(
        params.symbol.toUpperCase(),
        params.base.toUpperCase(),
        params.window,
        params.value,
        params.n_obs
      )
    }
  }
}

/**
 * Upsert indicator history (current vs previous)
 * When a new value arrives, the current becomes previous
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function upsertIndicatorHistory(params: {
  indicatorKey: string
  value: number | null
  date: string
}): Promise<void> {
  const normalizedKey = params.indicatorKey.toUpperCase()

  if (isUsingTurso()) {
    const db = getUnifiedDB()

    // Get current value if exists
    const existing = await db
      .prepare('SELECT * FROM indicator_history WHERE indicator_key = ?')
      .get(normalizedKey) as any

    let valueCurrent = params.value
    let valuePrevious = existing?.value_current ?? null
    let dateCurrent = params.date
    let datePrevious = existing?.date_current ?? null

    // If new value is different from current, move current to previous
    if (existing && existing.value_current != null && params.value != null) {
      if (existing.value_current !== params.value || existing.date_current !== params.date) {
        valuePrevious = existing.value_current
        datePrevious = existing.date_current
        valueCurrent = params.value
        dateCurrent = params.date
      }
    }

    await db.prepare(`
      INSERT INTO indicator_history (indicator_key, value_current, value_previous, date_current, date_previous)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(indicator_key) DO UPDATE SET
        value_current = excluded.value_current,
        value_previous = excluded.value_previous,
        date_current = excluded.date_current,
        date_previous = excluded.date_previous,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      normalizedKey,
      valueCurrent,
      valuePrevious,
      dateCurrent,
      datePrevious
    )
  } else {
    const db = getDB()

    // Get current value if exists
    const existing = db
      .prepare('SELECT * FROM indicator_history WHERE indicator_key = ?')
      .get(normalizedKey) as any

    let valueCurrent = params.value
    let valuePrevious = existing?.value_current ?? null
    let dateCurrent = params.date
    let datePrevious = existing?.date_current ?? null

    // If new value is different from current, move current to previous
    if (existing && existing.value_current != null && params.value != null) {
      if (existing.value_current !== params.value || existing.date_current !== params.date) {
        valuePrevious = existing.value_current
        datePrevious = existing.date_current
        valueCurrent = params.value
        dateCurrent = params.date
      }
    }

    const stmt = db.prepare(`
      INSERT INTO indicator_history (indicator_key, value_current, value_previous, date_current, date_previous)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(indicator_key) DO UPDATE SET
        value_current = excluded.value_current,
        value_previous = excluded.value_previous,
        date_current = excluded.date_current,
        date_previous = excluded.date_previous,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(
      normalizedKey,
      valueCurrent,
      valuePrevious,
      dateCurrent,
      datePrevious
    )
  }
}

/**
 * Save ingest history for tracking and auditing
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function saveIngestHistory(params: {
  jobType: string
  updatedSeriesCount: number
  errorsCount: number
  durationMs: number
  errors?: Array<{ seriesId?: string; error: string }>
  finishedAt: string
}): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    await db.prepare(`
      INSERT INTO ingest_history (job_type, updated_series_count, errors_count, duration_ms, errors_json, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.jobType,
      params.updatedSeriesCount,
      params.errorsCount,
      params.durationMs,
      params.errors ? JSON.stringify(params.errors) : null,
      params.finishedAt
    )
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO ingest_history (job_type, updated_series_count, errors_count, duration_ms, errors_json, finished_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      params.jobType,
      params.updatedSeriesCount,
      params.errorsCount,
      params.durationMs,
      params.errors ? JSON.stringify(params.errors) : null,
      params.finishedAt
    )
  }
}

/**
 * Get last ingest timestamp
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function getLastIngestAt(jobType: string = 'warmup'): Promise<string | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const result = await db.prepare(`
      SELECT finished_at FROM ingest_history
      WHERE job_type = ?
      ORDER BY finished_at DESC
      LIMIT 1
    `).get(jobType) as { finished_at: string } | undefined
    return result?.finished_at || null
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      SELECT finished_at FROM ingest_history
      WHERE job_type = ?
      ORDER BY finished_at DESC
      LIMIT 1
    `)
    const result = stmt.get(jobType) as { finished_at: string } | undefined
    return result?.finished_at || null
  }
}

/**
 * Get last warmup result summary
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function getLastWarmupResult(): Promise<{
  updatedSeriesCount: number
  errorsCount: number
  durationMs: number
  finishedAt: string | null
} | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const result = await db.prepare(`
      SELECT updated_series_count, errors_count, duration_ms, finished_at
      FROM ingest_history
      WHERE job_type = 'warmup'
      ORDER BY finished_at DESC
      LIMIT 1
    `).get() as {
      updated_series_count: number
      errors_count: number
      duration_ms: number
      finished_at: string
    } | undefined

    if (!result) return null

    return {
      updatedSeriesCount: result.updated_series_count,
      errorsCount: result.errors_count,
      durationMs: result.duration_ms,
      finishedAt: result.finished_at,
    }
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      SELECT updated_series_count, errors_count, duration_ms, finished_at
      FROM ingest_history
      WHERE job_type = 'warmup'
      ORDER BY finished_at DESC
      LIMIT 1
    `)

    const result = stmt.get() as {
      updated_series_count: number
      errors_count: number
      duration_ms: number
      finished_at: string
    } | undefined

    if (!result) return null

    return {
      updatedSeriesCount: result.updated_series_count,
      errorsCount: result.errors_count,
      durationMs: result.duration_ms,
      finishedAt: result.finished_at,
    }
  }
}

/**
 * Upsert asset price data
 */
export async function upsertAssetPrice(params: {
  symbol: string
  date: string
  open?: number | null
  high?: number | null
  low?: number | null
  close: number
  volume?: number | null
  source?: string
}): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    await db.prepare(`
      INSERT INTO asset_prices (symbol, date, open, high, low, close, volume, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, date) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        source = excluded.source
    `).run(
      params.symbol.toUpperCase(),
      params.date,
      params.open ?? null,
      params.high ?? null,
      params.low ?? null,
      params.close,
      params.volume ?? null,
      params.source || 'YAHOO'
    )
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO asset_prices (symbol, date, open, high, low, close, volume, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol, date) DO UPDATE SET
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        volume = excluded.volume,
        source = excluded.source
    `)
    stmt.run(
      params.symbol.toUpperCase(),
      params.date,
      params.open ?? null,
      params.high ?? null,
      params.low ?? null,
      params.close,
      params.volume ?? null,
      params.source || 'YAHOO'
    )
  }
}

/**
 * Upsert asset metadata
 */
export async function upsertAssetMetadata(params: {
  symbol: string
  name: string
  category: 'forex' | 'crypto' | 'index' | 'stock' | 'metal' | 'commodity'
  source?: string
  yahoo_symbol?: string
}): Promise<void> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    await db.prepare(`
      INSERT INTO asset_metadata (symbol, name, category, source, yahoo_symbol, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        source = excluded.source,
        yahoo_symbol = excluded.yahoo_symbol,
        last_updated = excluded.last_updated
    `).run(
      params.symbol.toUpperCase(),
      params.name,
      params.category,
      params.source || 'MANUAL',
      params.yahoo_symbol || null,
      new Date().toISOString()
    )
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO asset_metadata (symbol, name, category, source, yahoo_symbol, last_updated)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        source = excluded.source,
        yahoo_symbol = excluded.yahoo_symbol,
        last_updated = excluded.last_updated
    `)
    stmt.run(
      params.symbol.toUpperCase(),
      params.name,
      params.category,
      params.source || 'MANUAL',
      params.yahoo_symbol || null,
      new Date().toISOString()
    )
  }
}


