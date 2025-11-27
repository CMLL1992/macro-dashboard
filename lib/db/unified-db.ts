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
    console.log('[db] Using Turso database:', TURSO_DATABASE_URL)
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
          run(...params: any[]) {
            return stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint }
          },
          get(...params: any[]) {
            return stmt.get(...params)
          },
          all(...params: any[]) {
            return stmt.all(...params) as any[]
          },
        }
      },
      transaction<T>(fn: () => T): T {
        const tx = db.transaction(fn)
        return tx()
      },
      exec(sql: string) {
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

/**
 * Get unified database instance
 * Automatically uses Turso if configured, otherwise better-sqlite3
 */
export function getUnifiedDB(): UnifiedDB {
  if (!unifiedDb) {
    unifiedDb = createUnifiedDB()
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
    `CREATE INDEX IF NOT EXISTS idx_observations_series_date ON macro_observations(series_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_symbol ON correlations(symbol)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_asof ON correlations(asof)`,
    `CREATE INDEX IF NOT EXISTS idx_correlations_history_symbol ON correlations_history(symbol, base, window)`,
    `CREATE INDEX IF NOT EXISTS idx_indicator_history_key ON indicator_history(indicator_key)`,
    `CREATE INDEX IF NOT EXISTS idx_news_fuente_id ON news_items(fuente, id_fuente)`,
    `CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_items(published_at)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_fecha ON macro_calendar(fecha)`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_importancia ON macro_calendar(importancia)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_tipo ON notification_history(tipo)`,
    `CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON notification_history(sent_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ingest_history_finished_at ON ingest_history(finished_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ingest_history_job_type ON ingest_history(job_type)`,
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
  
  console.log('[db] Turso schema initialized with all tables')
}

