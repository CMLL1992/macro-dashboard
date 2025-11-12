/**
 * Database schema for automation
 * Using SQLite with better-sqlite3
 */

import 'server-only'

import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'macro.db')

// Ensure data directory exists
const dbDir = join(process.cwd(), 'data')
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

let db: Database.Database | null = null

export function getDB(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    initializeSchema(db)
  }
  return db
}

function initializeSchema(database: Database.Database) {
  // Macro series
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_series (
      series_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      unit TEXT,
      last_updated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Macro observations
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_observations (
      series_id TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL,
      PRIMARY KEY (series_id, date),
      FOREIGN KEY (series_id) REFERENCES macro_series(series_id) ON DELETE CASCADE
    )
  `)

  // Macro bias
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_bias (
      symbol TEXT PRIMARY KEY,
      score REAL NOT NULL,
      direction TEXT NOT NULL,
      confidence REAL NOT NULL,
      drivers_json TEXT NOT NULL,
      narrative_json TEXT,
      computed_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)


  // Secure settings (encrypted)
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_encrypted TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Correlations table
  database.exec(`
    CREATE TABLE IF NOT EXISTS correlations (
      symbol TEXT NOT NULL,
      base TEXT NOT NULL DEFAULT 'DXY',
      window TEXT NOT NULL CHECK(window IN ('12m', '3m')),
      value REAL,
      asof TEXT NOT NULL,
      n_obs INTEGER NOT NULL,
      last_asset_date TEXT,
      last_base_date TEXT,
      PRIMARY KEY (symbol, base, window)
    )
  `)

  // Correlations history (optional, for auditing)
  database.exec(`
    CREATE TABLE IF NOT EXISTS correlations_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      base TEXT NOT NULL,
      window TEXT NOT NULL,
      value REAL,
      n_obs INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Indicator history (for current vs previous comparison)
  database.exec(`
    CREATE TABLE IF NOT EXISTS indicator_history (
      indicator_key TEXT PRIMARY KEY,
      value_current REAL,
      value_previous REAL,
      date_current TEXT,
      date_previous TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // News items (Caso A - Noticia nueva)
  database.exec(`
    CREATE TABLE IF NOT EXISTS news_items (
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
    )
  `)

  // Narrative state (Caso B - Cambio de narrativa)
  database.exec(`
    CREATE TABLE IF NOT EXISTS narrative_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      narrativa_actual TEXT NOT NULL CHECK(narrativa_actual IN ('RISK_ON', 'RISK_OFF', 'INFLACION_ARRIBA', 'INFLACION_ABAJO', 'NEUTRAL')),
      narrativa_anterior TEXT,
      cambiado_en TEXT,
      cooldown_hasta TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Macro calendar (Caso C - Previa semanal)
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_calendar (
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
    )
  `)

  // Notification history (transversal)
  database.exec(`
    CREATE TABLE IF NOT EXISTS notification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK(tipo IN ('news', 'narrative', 'weekly')),
      mensaje TEXT NOT NULL,
      chat_id TEXT,
      message_id INTEGER,
      status TEXT CHECK(status IN ('sent', 'failed', 'queued')),
      error TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

    // Weekly sent tracking (para deduplicación semanal)
    database.exec(`
      CREATE TABLE IF NOT EXISTS weekly_sent (
        semana TEXT PRIMARY KEY,
        sent_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Notification settings (adjustable parameters)
    database.exec(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        min_value REAL,
        max_value REAL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Daily digest tracking
    database.exec(`
      CREATE TABLE IF NOT EXISTS daily_digest_sent (
        fecha TEXT PRIMARY KEY,
        sent_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Notification metrics (counters)
    database.exec(`
      CREATE TABLE IF NOT EXISTS notification_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value INTEGER NOT NULL DEFAULT 0,
        labels TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(metric_name, labels)
      )
    `)

  // Indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_observations_series_date ON macro_observations(series_id, date);
    CREATE INDEX IF NOT EXISTS idx_correlations_symbol ON correlations(symbol);
    CREATE INDEX IF NOT EXISTS idx_correlations_asof ON correlations(asof);
    CREATE INDEX IF NOT EXISTS idx_correlations_history_symbol ON correlations_history(symbol, base, window);
    CREATE INDEX IF NOT EXISTS idx_indicator_history_key ON indicator_history(indicator_key);
    CREATE INDEX IF NOT EXISTS idx_news_fuente_id ON news_items(fuente, id_fuente);
    CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_items(published_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_fecha ON macro_calendar(fecha);
    CREATE INDEX IF NOT EXISTS idx_calendar_importancia ON macro_calendar(importancia);
    CREATE INDEX IF NOT EXISTS idx_notification_tipo ON notification_history(tipo);
    CREATE INDEX IF NOT EXISTS idx_notification_sent_at ON notification_history(sent_at);
  `)
}

export function closeDB() {
  if (db) {
    db.close()
    db = null
  }
}

