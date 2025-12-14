/**
 * Unified Database Interface
 * Supports both Turso (production) and better-sqlite3 (local)
 * Automatically detects which to use based on environment variables
 */

import 'server-only'
import { createClient, type Client } from '@libsql/client'
import Database from 'better-sqlite3'
import type { Database as BetterSQLite3Database } from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN
const USE_TURSO = !!(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN)

const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)

function getDBPath(): string {
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH
  }
  if (isVercel) {
    return '/tmp/macro.db'
  }
  return join(process.cwd(), 'macro.db')
}

let tursoClient: Client | null = null
let sqliteDb: BetterSQLite3Database | null = null

/**
 * Unified database interface
 * Returns a wrapper that works with both Turso and better-sqlite3
 */
export interface UnifiedDB {
  prepare(sql: string): UnifiedStmt
  transaction<T>(fn: () => T): T | Promise<T>
  exec(sql: string): void | Promise<void>
  pragma(key: string, value?: string): any
}

export interface UnifiedStmt {
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } | Promise<{ changes: number; lastInsertRowid: number | bigint }>
  get(...params: any[]): any | Promise<any>
  all(...params: any[]): any[] | Promise<any[]>
}

/**
 * Get Turso client (singleton)
 */
function getTursoClient(): Client {
  if (!tursoClient) {
    if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set to use Turso')
    }
    tursoClient = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN,
    })
    console.log('[db] Using Turso database:', {
      env: process.env.NODE_ENV || 'development',
      url: TURSO_DATABASE_URL,
      hasToken: !!TURSO_AUTH_TOKEN,
      tokenLength: TURSO_AUTH_TOKEN?.length || 0,
    })
  }
  return tursoClient
}

/**
 * Get better-sqlite3 database (singleton)
 */
function getSQLiteDB(): BetterSQLite3Database {
  if (!sqliteDb) {
    const DB_PATH = getDBPath()
    sqliteDb = new Database(DB_PATH)
    
    // Use WAL mode in local, DELETE mode in Vercel
    if (isVercel) {
      sqliteDb.pragma('journal_mode = DELETE')
    } else {
      sqliteDb.pragma('journal_mode = WAL')
    }
    console.log('[db] Using SQLite database:', DB_PATH)
  }
  return sqliteDb
}

/**
 * Create unified database wrapper
 */
function createUnifiedDB(): UnifiedDB {
  if (USE_TURSO) {
    const client = getTursoClient()
    
    return {
      prepare(sql: string): UnifiedStmt {
        return {
          async run(...params: any[]) {
            const result = await client.execute({ sql, args: params })
            return {
              changes: result.rowsAffected,
              lastInsertRowid: result.lastInsertRowid || 0,
            }
          },
          async get(...params: any[]) {
            const result = await client.execute({ sql, args: params })
            return result.rows[0] || null
          },
          async all(...params: any[]) {
            const result = await client.execute({ sql, args: params })
            return result.rows
          },
        }
      },
      async transaction<T>(fn: () => T): Promise<T> {
        // Turso doesn't support transactions the same way, so we execute sequentially
        // For now, just execute the function (Turso handles transactions internally)
        return fn()
      },
      async exec(sql: string) {
        await client.execute({ sql })
      },
      pragma(key: string, value?: string): any {
        // Turso doesn't support PRAGMA, return empty
        return null
      },
    }
  } else {
    const db = getSQLiteDB()
    
    return {
      prepare(sql: string): UnifiedStmt {
        const stmt = db.prepare(sql)
        return {
          // Make all methods async for consistency, even with SQLite
          async run(...params: any[]) {
            return stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint }
          },
          async get(...params: any[]) {
            return stmt.get(...params)
          },
          async all(...params: any[]) {
            return stmt.all(...params) as any[]
          },
        }
      },
      async transaction<T>(fn: () => T): Promise<T> {
        const tx = db.transaction(fn)
        return tx()
      },
      async exec(sql: string) {
        db.exec(sql)
      },
      pragma(key: string, value?: string): any {
        if (value) {
          return db.pragma(`${key} = ${value}`)
        }
        return db.pragma(key)
      },
    }
  }
}

let unifiedDb: UnifiedDB | null = null
let dbTypeLogged = false

/**
 * Get unified database instance
 * Automatically uses Turso if configured, otherwise better-sqlite3
 */
export function getUnifiedDB(): UnifiedDB {
  if (!unifiedDb) {
    unifiedDb = createUnifiedDB()
  }
  
  // Log which database is being used (only once to avoid spam)
  if (!dbTypeLogged) {
    console.log('[db] getUnifiedDB() - Using DB', {
      env: process.env.NODE_ENV || 'development',
      url: process.env.TURSO_DATABASE_URL || 'NO_TURSO_URL',
      tokenLength: process.env.TURSO_AUTH_TOKEN?.length || 0,
      isTurso: USE_TURSO,
      isVercel: isVercel,
    })
    dbTypeLogged = true
  }
  
  return unifiedDb
}

/**
 * Check if using Turso
 */
export function isUsingTurso(): boolean {
  return USE_TURSO
}

/**
 * Initialize schema (works with both)
 * Includes ALL tables from the full schema
 */
export async function initializeSchemaUnified(): Promise<void> {
  const db = getUnifiedDB()
  
  // Complete schema with all tables
  const statements = [
    `CREATE TABLE IF NOT EXISTS macro_series (
      series_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      unit TEXT,
      last_updated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS macro_observations (
      series_id TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL,
      observation_period TEXT,
      PRIMARY KEY (series_id, date),
      FOREIGN KEY (series_id) REFERENCES macro_series(series_id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS macro_bias (
      symbol TEXT PRIMARY KEY,
      score REAL NOT NULL,
      direction TEXT NOT NULL,
      confidence REAL NOT NULL,
      drivers_json TEXT NOT NULL,
      narrative_json TEXT,
      computed_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_encrypted TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS asset_prices (
      symbol TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      source TEXT,
      PRIMARY KEY (symbol, date)
    )`,
    `CREATE TABLE IF NOT EXISTS asset_metadata (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('forex', 'crypto', 'index', 'stock', 'metal', 'commodity')),
      source TEXT,
      yahoo_symbol TEXT,
      last_updated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS correlations (
      symbol TEXT NOT NULL,
      base TEXT NOT NULL DEFAULT 'DXY',
      window TEXT NOT NULL CHECK(window IN ('12m', '3m')),
      value REAL,
      asof TEXT NOT NULL,
      n_obs INTEGER NOT NULL,
      last_asset_date TEXT,
      last_base_date TEXT,
      PRIMARY KEY (symbol, base, window)
    )`,
    `CREATE TABLE IF NOT EXISTS correlations_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      base TEXT NOT NULL,
      window TEXT NOT NULL,
      value REAL,
      n_obs INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS indicator_history (
      indicator_key TEXT PRIMARY KEY,
      value_current REAL,
      value_previous REAL,
      date_current TEXT,
      date_previous TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS macro_signals (
      date TEXT PRIMARY KEY,
      usd_score REAL,
      usd_bias TEXT,
      usd_confidence TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pair_signals (
      date TEXT,
      symbol TEXT,
      action TEXT,
      confidence TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (date, symbol)
    )`,
    `CREATE TABLE IF NOT EXISTS macro_events (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      time TEXT,
      country TEXT NOT NULL,
      indicator_key TEXT NOT NULL,
      title TEXT NOT NULL,
      previous REAL,
      consensus REAL,
      impact TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_fuente TEXT NOT NULL,
      fuente TEXT NOT NULL,
      pais TEXT,
      tema TEXT,
      titulo TEXT NOT NULL,
      impacto TEXT CHECK(impacto IN ('low', 'med', 'high')),
      published_at TEXT NOT NULL,
      resumen TEXT,
      valor_publicado REAL,
      valor_esperado REAL,
      notificado_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(fuente, id_fuente)
    )`,
    `CREATE TABLE IF NOT EXISTS narrative_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      narrativa_actual TEXT NOT NULL CHECK(narrativa_actual IN ('RISK_ON', 'RISK_OFF', 'INFLACION_ARRIBA', 'INFLACION_ABAJO', 'NEUTRAL')),
      narrativa_anterior TEXT,
      cambiado_en TEXT,
      cooldown_hasta TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS macro_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      hora_local TEXT,
      pais TEXT,
      tema TEXT NOT NULL,
      evento TEXT NOT NULL,
      importancia TEXT CHECK(importancia IN ('low', 'med', 'high')),
      consenso TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('news', 'narrative', 'weekly')),
      mensaje TEXT NOT NULL,
      chat_id TEXT,
      message_id INTEGER,
      status TEXT CHECK(status IN ('sent', 'failed', 'queued')),
      error TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS weekly_sent (
      semana TEXT PRIMARY KEY,
      sent_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_notification_preferences (
      chat_id TEXT PRIMARY KEY,
      preferences_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS job_state (
      job_name TEXT PRIMARY KEY,
      cursor TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_run_status TEXT,
      last_run_duration_ms INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS notification_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      min_value REAL,
      max_value REAL,
      description TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS daily_digest_sent (
      fecha TEXT PRIMARY KEY,
      sent_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notification_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_name TEXT NOT NULL,
      metric_value INTEGER NOT NULL DEFAULT 0,
      labels TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(metric_name, labels)
    )`,
    `CREATE TABLE IF NOT EXISTS ingest_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      updated_series_count INTEGER NOT NULL DEFAULT 0,
      errors_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL,
      errors_json TEXT,
      finished_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS economic_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_event_id TEXT,
      country TEXT NOT NULL,
      currency TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      importance TEXT CHECK(importance IN ('low', 'medium', 'high')),
      series_id TEXT,
      indicator_key TEXT,
      scheduled_time_utc TEXT NOT NULL,
      scheduled_time_local TEXT,
      previous_value REAL,
      consensus_value REAL,
      consensus_range_min REAL,
      consensus_range_max REAL,
      directionality TEXT CHECK(directionality IN ('higher_is_positive', 'lower_is_positive')),
      notified_at TEXT NULL,
      notify_lead_minutes INTEGER DEFAULT 30,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS economic_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      release_time_utc TEXT NOT NULL,
      release_time_local TEXT,
      actual_value REAL,
      previous_value REAL,
      consensus_value REAL,
      surprise_raw REAL,
      surprise_pct REAL,
      surprise_score REAL,
      surprise_direction TEXT CHECK(surprise_direction IN ('positive', 'negative')),
      revision_flag INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS macro_event_impact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      release_id INTEGER NOT NULL,
      currency TEXT NOT NULL,
      total_score_before REAL,
      total_score_after REAL,
      regime_before TEXT,
      regime_after TEXT,
      usd_direction_before TEXT,
      usd_direction_after TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS job_status (
      job_name TEXT PRIMARY KEY,
      last_run_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error_message TEXT,
      runs_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_observations_series_date ON macro_observations(series_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_asset_prices_symbol_date ON asset_prices(symbol, date)`,
    `CREATE INDEX IF NOT EXISTS idx_asset_prices_date ON asset_prices(date)`,
    `CREATE INDEX IF NOT EXISTS idx_asset_metadata_category ON asset_metadata(category)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_symbol ON correlations(symbol)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_asof ON correlations(asof)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_history_symbol ON correlations_history(symbol, base, window)`,
    `CREATE INDEX IF NOT EXISTS idx_indicator_history_key ON indicator_history(indicator_key)`,
    `CREATE INDEX IF NOT EXISTS idx_macro_signals_date ON macro_signals(date)`,
    `CREATE INDEX IF NOT EXISTS idx_pair_signals_date ON pair_signals(date)`,
    `CREATE INDEX IF NOT EXISTS idx_pair_signals_symbol ON pair_signals(symbol)`,
    `CREATE INDEX IF NOT EXISTS idx_macro_events_date ON macro_events(date)`,
    `CREATE INDEX IF NOT EXISTS idx_macro_events_indicator ON macro_events(indicator_key)`,
    `CREATE INDEX IF NOT EXISTS idx_news_fuente_id ON news_items(fuente, id_fuente)`,
    `CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_items(published_at)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_fecha ON macro_calendar(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_importancia ON macro_calendar(importancia)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_tipo ON notification_history(tipo)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON notification_history(sent_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ingest_history_finished_at ON ingest_history(finished_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ingest_history_job_type ON ingest_history(job_type)`,
    `CREATE INDEX IF NOT EXISTS idx_economic_events_currency ON economic_events(currency)`,
    `CREATE INDEX IF NOT EXISTS idx_economic_events_scheduled_time ON economic_events(scheduled_time_utc)`,
    `CREATE INDEX IF NOT EXISTS idx_economic_events_series_id ON economic_events(series_id)`,
    `CREATE INDEX IF NOT EXISTS idx_economic_releases_event_id ON economic_releases(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_economic_releases_release_time ON economic_releases(release_time_utc)`,
    `CREATE INDEX IF NOT EXISTS idx_macro_event_impact_release_id ON macro_event_impact(release_id)`,
    `CREATE INDEX IF NOT EXISTS idx_macro_event_impact_currency ON macro_event_impact(currency)`,
    `CREATE INDEX IF NOT EXISTS idx_job_status_updated_at ON job_status(updated_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_events_source_event_id ON economic_events(source_event_id)`,
  ]
  
  // Execute each statement
  for (const statement of statements) {
    try {
      await db.exec(statement)
    } catch (error: any) {
      // Log but don't fail - some tables might already exist
      console.warn('[db] Error creating table/index (may already exist):', error.message)
    }
  }
  
  // Migrations: Add new columns to existing tables
  const migrations = [
    `ALTER TABLE economic_events ADD COLUMN notified_at TEXT NULL`,
    `ALTER TABLE economic_events ADD COLUMN notify_lead_minutes INTEGER DEFAULT 30`,
  ]
  
  for (const migration of migrations) {
    try {
      await db.exec(migration)
    } catch (error: any) {
      // Column already exists, ignore
      if (!error.message?.includes('duplicate column') && !error.message?.includes('already exists')) {
        console.warn('[db] Migration error (may already be applied):', error.message)
      }
    }
  }
  
  console.log('[db] Turso schema initialized with all tables')
}

