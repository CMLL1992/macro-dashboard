/**
 * Economic Events and Releases Management
 * Handles calendar events, releases, and surprise calculations
 */

import { getUnifiedDB, isUsingTurso } from './unified-db'
import { getDB } from './schema'

const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value))

export type EconomicEvent = {
  id: number
  source_event_id: string | null
  country: string
  currency: string
  name: string
  category: string | null
  importance: 'low' | 'medium' | 'high' | null
  series_id: string | null
  indicator_key: string | null
  scheduled_time_utc: string
  scheduled_time_local: string | null
  previous_value: number | null
  consensus_value: number | null
  consensus_range_min: number | null
  consensus_range_max: number | null
  directionality: 'higher_is_positive' | 'lower_is_positive' | null
  notified_at: string | null
  notify_lead_minutes: number
  created_at: string
  updated_at: string
}

export type EconomicRelease = {
  id: number
  event_id: number
  release_time_utc: string
  release_time_local: string | null
  actual_value: number | null
  previous_value: number | null
  consensus_value: number | null
  surprise_raw: number | null
  surprise_pct: number | null
  surprise_score: number | null
  surprise_direction: 'positive' | 'negative' | null
  revision_flag: number
  notes: string | null
  created_at: string
}

export type MacroEventImpact = {
  id: number
  release_id: number
  currency: string
  total_score_before: number | null
  total_score_after: number | null
  regime_before: string | null
  regime_after: string | null
  usd_direction_before: string | null
  usd_direction_after: string | null
  created_at: string
}

/**
 * Calculate surprise metrics from actual vs consensus
 */
export function calculateSurprise(
  actual: number,
  consensus: number,
  directionality?: 'higher_is_positive' | 'lower_is_positive' | null
): {
  surprise_raw: number
  surprise_pct: number
  surprise_score: number
  surprise_direction: 'positive' | 'negative'
} {
  const surprise_raw = actual - consensus

  // Sorpresa relativa
  const surprise_pct = consensus !== 0
    ? (actual - consensus) / Math.abs(consensus)
    : 0

  // Normalizar a score [-1, 1]
  // ±10% sobre consenso = extremos
  const surprise_score = clamp(surprise_pct / 0.1, -1, 1)

  // Determinar dirección desde el punto de vista de la moneda
  let surprise_direction: 'positive' | 'negative' = 'positive'

  if (directionality === 'higher_is_positive') {
    surprise_direction = actual >= consensus ? 'positive' : 'negative'
  } else if (directionality === 'lower_is_positive') {
    surprise_direction = actual <= consensus ? 'positive' : 'negative'
  } else {
    // Por defecto: sorpresa positiva si actual > consenso
    surprise_direction = surprise_raw > 0 ? 'positive' : 'negative'
  }

  return {
    surprise_raw,
    surprise_pct,
    surprise_score,
    surprise_direction,
  }
}

/**
 * Upsert economic event (create or update)
 */
export async function upsertEconomicEvent(params: {
  source_event_id: string
  country: string
  currency: string
  name: string
  category?: string | null
  importance: 'low' | 'medium' | 'high'
  series_id?: string | null
  indicator_key?: string | null
  directionality?: 'higher_is_positive' | 'lower_is_positive' | null
  scheduled_time_utc: string
  scheduled_time_local?: string | null
  previous_value?: number | null
  consensus_value?: number | null
  consensus_range_min?: number | null
  consensus_range_max?: number | null
  notify_lead_minutes?: number
}): Promise<EconomicEvent> {
  const {
    source_event_id,
    country,
    currency,
    name,
    category,
    importance,
    series_id,
    indicator_key,
    directionality,
    scheduled_time_utc,
    scheduled_time_local,
    previous_value,
    consensus_value,
    consensus_range_min,
    consensus_range_max,
  } = params

  const now = new Date().toISOString()

  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const stmt = db.prepare(`
      INSERT INTO economic_events (
        source_event_id, country, currency, name, category, importance,
        series_id, indicator_key, directionality,
        scheduled_time_utc, scheduled_time_local,
        previous_value, consensus_value, consensus_range_min, consensus_range_max,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_event_id) DO UPDATE SET
        country = excluded.country,
        currency = excluded.currency,
        name = excluded.name,
        category = excluded.category,
        importance = excluded.importance,
        series_id = excluded.series_id,
        indicator_key = excluded.indicator_key,
        directionality = excluded.directionality,
        scheduled_time_utc = excluded.scheduled_time_utc,
        scheduled_time_local = excluded.scheduled_time_local,
        previous_value = excluded.previous_value,
        consensus_value = excluded.consensus_value,
        consensus_range_min = excluded.consensus_range_min,
        consensus_range_max = excluded.consensus_range_max,
        updated_at = excluded.updated_at
      RETURNING *
    `)
    const result = await stmt.get(
      source_event_id,
      country,
      currency,
      name,
      category || null,
      importance,
      series_id || null,
      indicator_key || null,
      directionality || null,
      scheduled_time_utc,
      scheduled_time_local || null,
      previous_value || null,
      consensus_value || null,
      consensus_range_min || null,
      consensus_range_max || null,
      now,
      now
    ) as EconomicEvent
    return result
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO economic_events (
        source_event_id, country, currency, name, category, importance,
        series_id, indicator_key, directionality,
        scheduled_time_utc, scheduled_time_local,
        previous_value, consensus_value, consensus_range_min, consensus_range_max,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_event_id) DO UPDATE SET
        country = excluded.country,
        currency = excluded.currency,
        name = excluded.name,
        category = excluded.category,
        importance = excluded.importance,
        series_id = excluded.series_id,
        indicator_key = excluded.indicator_key,
        directionality = excluded.directionality,
        scheduled_time_utc = excluded.scheduled_time_utc,
        scheduled_time_local = excluded.scheduled_time_local,
        previous_value = excluded.previous_value,
        consensus_value = excluded.consensus_value,
        consensus_range_min = excluded.consensus_range_min,
        consensus_range_max = excluded.consensus_range_max,
        updated_at = excluded.updated_at
    `)
    stmt.run(
      source_event_id,
      country,
      currency,
      name,
      category || null,
      importance,
      series_id || null,
      indicator_key || null,
      directionality || null,
      scheduled_time_utc,
      scheduled_time_local || null,
      previous_value || null,
      consensus_value || null,
      consensus_range_min || null,
      consensus_range_max || null,
      now,
      now
    )
    const stmt2 = db.prepare('SELECT * FROM economic_events WHERE source_event_id = ?')
    return stmt2.get(source_event_id) as EconomicEvent
  }
}

/**
 * Create or update an economic release
 */
export async function upsertEconomicRelease(params: {
  event_id: number
  release_time_utc: string
  release_time_local?: string | null
  actual_value: number
  previous_value?: number | null
  consensus_value?: number | null
  directionality?: 'higher_is_positive' | 'lower_is_positive' | null
  revision_flag?: number
  notes?: string | null
}): Promise<EconomicRelease> {
  const {
    event_id,
    release_time_utc,
    release_time_local,
    actual_value,
    previous_value,
    consensus_value,
    directionality,
    revision_flag = 0,
    notes,
  } = params

  // Validate that actual_value and consensus_value are numbers before calculating surprise
  let surprise: {
    surprise_raw: number | null
    surprise_pct: number | null
    surprise_score: number | null
    surprise_direction: 'positive' | 'negative' | null
  }
  
  if (actual_value != null && consensus_value != null && typeof actual_value === 'number' && typeof consensus_value === 'number') {
    surprise = calculateSurprise(actual_value, consensus_value, directionality)
  } else {
    // If values are missing, set surprise to null
    surprise = {
      surprise_raw: null,
      surprise_pct: null,
      surprise_score: null,
      surprise_direction: null,
    }
  }

  if (isUsingTurso()) {
    const db = getUnifiedDB()
    // Verificar si ya existe un release para este event_id
    const existing = await db.prepare('SELECT id FROM economic_releases WHERE event_id = ?').get(event_id) as { id: number } | undefined
    
    if (existing) {
      // Actualizar release existente
      const stmt = db.prepare(`
        UPDATE economic_releases SET
          release_time_utc = ?,
          release_time_local = ?,
          actual_value = ?,
          previous_value = ?,
          consensus_value = ?,
          surprise_raw = ?,
          surprise_pct = ?,
          surprise_score = ?,
          surprise_direction = ?,
          revision_flag = ?,
          notes = ?
        WHERE event_id = ?
        RETURNING *
      `)
      const result = await stmt.get(
        release_time_utc,
        release_time_local || null,
        actual_value,
        previous_value || null,
        consensus_value,
        surprise.surprise_raw,
        surprise.surprise_pct,
        surprise.surprise_score,
        surprise.surprise_direction,
        revision_flag,
        notes || null,
        event_id
      ) as EconomicRelease
      return result
    } else {
      // Insertar nuevo release
      const stmt = db.prepare(`
        INSERT INTO economic_releases (
          event_id, release_time_utc, release_time_local,
          actual_value, previous_value, consensus_value,
          surprise_raw, surprise_pct, surprise_score, surprise_direction,
          revision_flag, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *
      `)
      const result = await stmt.get(
        event_id,
        release_time_utc,
        release_time_local || null,
        actual_value,
        previous_value || null,
        consensus_value,
        surprise.surprise_raw,
        surprise.surprise_pct,
        surprise.surprise_score,
        surprise.surprise_direction,
        revision_flag,
        notes || null,
        new Date().toISOString()
      ) as EconomicRelease
      return result
    }
  } else {
    const db = getDB()
    // Verificar si ya existe un release para este event_id
    const existing = db.prepare('SELECT id FROM economic_releases WHERE event_id = ?').get(event_id) as { id: number } | undefined
    
    if (existing) {
      // Actualizar release existente
      const stmt = db.prepare(`
        UPDATE economic_releases SET
          release_time_utc = ?,
          release_time_local = ?,
          actual_value = ?,
          previous_value = ?,
          consensus_value = ?,
          surprise_raw = ?,
          surprise_pct = ?,
          surprise_score = ?,
          surprise_direction = ?,
          revision_flag = ?,
          notes = ?
        WHERE event_id = ?
      `)
      stmt.run(
        release_time_utc,
        release_time_local || null,
        actual_value,
        previous_value || null,
        consensus_value,
        surprise.surprise_raw,
        surprise.surprise_pct,
        surprise.surprise_score,
        surprise.surprise_direction,
        revision_flag,
        notes || null,
        event_id
      )
      const result = await getEconomicReleaseById(existing.id)
      if (!result) {
        throw new Error(`Failed to retrieve economic release with id ${existing.id}`)
      }
      return result
    } else {
      // Insertar nuevo release
      const stmt = db.prepare(`
        INSERT INTO economic_releases (
          event_id, release_time_utc, release_time_local,
          actual_value, previous_value, consensus_value,
          surprise_raw, surprise_pct, surprise_score, surprise_direction,
          revision_flag, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        event_id,
        release_time_utc,
        release_time_local || null,
        actual_value,
        previous_value || null,
        consensus_value,
        surprise.surprise_raw,
        surprise.surprise_pct,
        surprise.surprise_score,
        surprise.surprise_direction,
        revision_flag,
        notes || null,
        new Date().toISOString()
      )
      const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }
      const result = await getEconomicReleaseById(lastId.id)
      if (!result) {
        throw new Error(`Failed to retrieve economic release with id ${lastId.id}`)
      }
      return result
    }
  }
}

/**
 * Get economic release by ID
 */
export async function getEconomicReleaseById(id: number): Promise<EconomicRelease | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const stmt = db.prepare('SELECT * FROM economic_releases WHERE id = ?')
    const result = await stmt.get(id) as EconomicRelease | null
    return result || null
  } else {
    const db = getDB()
    const stmt = db.prepare('SELECT * FROM economic_releases WHERE id = ?')
    const result = stmt.get(id) as EconomicRelease | null
    return result || null
  }
}

/**
 * Get recent economic releases (last N hours)
 */
export async function getRecentReleases(params: {
  hours?: number
  currency?: string
  importance?: 'low' | 'medium' | 'high'
  min_surprise_score?: number
}): Promise<Array<EconomicRelease & { event: EconomicEvent }>> {
  const {
    hours = 24,
    currency,
    importance,
    min_surprise_score,
  } = params

  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let query = `
    SELECT 
      er.*,
      ee.id as event_id,
      ee.source_event_id,
      ee.country,
      ee.currency,
      ee.name,
      ee.category,
      ee.importance,
      ee.series_id,
      ee.indicator_key,
      ee.scheduled_time_utc,
      ee.scheduled_time_local,
      ee.previous_value as event_previous_value,
      ee.consensus_value as event_consensus_value,
      ee.consensus_range_min as event_consensus_range_min,
      ee.consensus_range_max as event_consensus_range_max,
      ee.directionality,
      ee.notified_at as event_notified_at,
      ee.notify_lead_minutes as event_notify_lead_minutes,
      ee.created_at as event_created_at,
      ee.updated_at as event_updated_at
    FROM economic_releases er
    INNER JOIN economic_events ee ON er.event_id = ee.id
    WHERE er.release_time_utc >= ?
  `

  const params_array: any[] = [cutoffTime]

  if (currency) {
    query += ' AND ee.currency = ?'
    params_array.push(currency)
  }

  if (importance) {
    query += ' AND ee.importance = ?'
    params_array.push(importance)
  }

  if (min_surprise_score != null) {
    query += ' AND ABS(er.surprise_score) >= ?'
    params_array.push(min_surprise_score)
  }

  query += ' ORDER BY er.release_time_utc DESC LIMIT 50'

  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const stmt = db.prepare(query)
    const rows = await stmt.all(...params_array) as any[]
    return rows.map(row => ({
      id: row.id,
      event_id: row.event_id,
      release_time_utc: row.release_time_utc,
      release_time_local: row.release_time_local,
      actual_value: row.actual_value,
      previous_value: row.previous_value,
      consensus_value: row.consensus_value,
      surprise_raw: row.surprise_raw,
      surprise_pct: row.surprise_pct,
      surprise_score: row.surprise_score,
      surprise_direction: row.surprise_direction,
      revision_flag: row.revision_flag,
      notes: row.notes,
      created_at: row.created_at,
      event: {
        id: row.event_id,
        source_event_id: row.source_event_id,
        country: row.country,
        currency: row.currency,
        name: row.name,
        category: row.category,
        importance: row.importance,
        series_id: row.series_id,
        indicator_key: row.indicator_key,
        scheduled_time_utc: row.scheduled_time_utc,
        scheduled_time_local: row.scheduled_time_local,
        previous_value: row.event_previous_value,
        consensus_value: row.event_consensus_value,
        consensus_range_min: row.event_consensus_range_min,
        consensus_range_max: row.event_consensus_range_max,
        directionality: row.directionality,
        notified_at: row.event_notified_at,
        notify_lead_minutes: row.event_notify_lead_minutes ?? 30,
        created_at: row.event_created_at,
        updated_at: row.event_updated_at,
      },
    }))
  } else {
    const db = getDB()
    const stmt = db.prepare(query)
    const rows = stmt.all(...params_array) as any[]
    return rows.map(row => ({
      id: row.id,
      event_id: row.event_id,
      release_time_utc: row.release_time_utc,
      release_time_local: row.release_time_local,
      actual_value: row.actual_value,
      previous_value: row.previous_value,
      consensus_value: row.consensus_value,
      surprise_raw: row.surprise_raw,
      surprise_pct: row.surprise_pct,
      surprise_score: row.surprise_score,
      surprise_direction: row.surprise_direction,
      revision_flag: row.revision_flag,
      notes: row.notes,
      created_at: row.created_at,
      event: {
        id: row.event_id,
        source_event_id: row.source_event_id,
        country: row.country,
        currency: row.currency,
        name: row.name,
        category: row.category,
        importance: row.importance,
        series_id: row.series_id,
        indicator_key: row.indicator_key,
        scheduled_time_utc: row.scheduled_time_utc,
        scheduled_time_local: row.scheduled_time_local,
        previous_value: row.event_previous_value,
        consensus_value: row.event_consensus_value,
        consensus_range_min: row.event_consensus_range_min,
        consensus_range_max: row.event_consensus_range_max,
        directionality: row.directionality,
        notified_at: row.event_notified_at,
        notify_lead_minutes: row.event_notify_lead_minutes ?? 30,
        created_at: row.event_created_at,
        updated_at: row.event_updated_at,
      },
    }))
  }
}

/**
 * Record macro event impact (before/after snapshot)
 */
export async function recordMacroEventImpact(params: {
  release_id: number
  currency: string
  total_score_before: number | null
  total_score_after: number | null
  regime_before: string | null
  regime_after: string | null
  usd_direction_before?: string | null
  usd_direction_after?: string | null
}): Promise<MacroEventImpact> {
  const {
    release_id,
    currency,
    total_score_before,
    total_score_after,
    regime_before,
    regime_after,
    usd_direction_before,
    usd_direction_after,
  } = params

  if (isUsingTurso()) {
    const db = getUnifiedDB()
    const stmt = db.prepare(`
      INSERT INTO macro_event_impact (
        release_id, currency,
        total_score_before, total_score_after,
        regime_before, regime_after,
        usd_direction_before, usd_direction_after,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `)
    const result = await stmt.get(
      release_id,
      currency,
      total_score_before,
      total_score_after,
      regime_before,
      regime_after,
      usd_direction_before || null,
      usd_direction_after || null,
      new Date().toISOString()
    ) as MacroEventImpact
    return result
  } else {
    const db = getDB()
    const stmt = db.prepare(`
      INSERT INTO macro_event_impact (
        release_id, currency,
        total_score_before, total_score_after,
        regime_before, regime_after,
        usd_direction_before, usd_direction_after,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      release_id,
      currency,
      total_score_before,
      total_score_after,
      regime_before,
      regime_after,
      usd_direction_before || null,
      usd_direction_after || null,
      new Date().toISOString()
    )
    const lastId = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }
    const stmt2 = db.prepare('SELECT * FROM macro_event_impact WHERE id = ?')
    return stmt2.get(lastId.id) as MacroEventImpact
  }
}

