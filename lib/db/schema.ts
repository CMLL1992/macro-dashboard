/**
 * Database schema for automation
 * Using SQLite with better-sqlite3 (local) or Turso (production)
 * 
 * Automatically detects Turso if TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are set
 * Falls back to better-sqlite3 if Turso is not configured
 * 
 * For persistent database in production, configure Turso (see CONFIGURAR-TURSO.md)
 */

import 'server-only'

import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getUnifiedDB, initializeSchemaUnified, isUsingTurso } from './unified-db'

// Detectar Vercel de forma robusta: Vercel siempre proporciona VERCEL, VERCEL_ENV o VERCEL_URL
// En Vercel (producción/preview): usar /tmp (único directorio escribible)
// En desarrollo local: usar ./macro.db
const isVercel = !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
const isProduction = process.env.NODE_ENV === 'production' || isVercel

// Función para detectar si estamos en un entorno serverless (Vercel) por el path de process.cwd()
// En Vercel, process.cwd() es /var/task, que es de solo lectura
function detectServerless(): boolean {
  try {
    const cwd = process.cwd()
    return cwd === '/var/task' || cwd.startsWith('/var/task')
  } catch {
    return false
  }
}

// Función para obtener el path de la BD
function getDBPath(): string {
  // Si hay variable de entorno, usarla
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH
  }
  
  // Detectar serverless en runtime
  const isServerless = detectServerless()
  const cwd = process.cwd()
  
  // Si estamos en serverless (process.cwd() es /var/task), SIEMPRE usar /tmp
  // Esto es crítico porque /var/task es de solo lectura en Vercel
  if (isServerless || cwd === '/var/task' || cwd.startsWith('/var/task')) {
    return '/tmp/macro.db'
  }
  
  // Si detectamos Vercel por variables de entorno, usar /tmp
  if (isVercel) {
    return '/tmp/macro.db'
  }
  
  // Desarrollo local: usar ./macro.db
  return join(process.cwd(), 'macro.db')
}

// NOTA: Los logs se hacen dentro de getDB() para evitar ejecución durante el build

let db: Database.Database | null = null
let schemaInitialized = false

/**
 * Get database instance
 * Automatically uses Turso if configured, otherwise better-sqlite3
 * 
 * @deprecated En código de servidor (APIs, loaders, helpers), usa siempre getUnifiedDB() + await.
 * Esta función solo debe usarse en scripts locales o código que nunca se ejecute en producción con Turso.
 * 
 * NOTE: If using Turso, this returns a wrapper that simulates better-sqlite3 API
 * but uses Turso internally. All operations are async when using Turso.
 */
export function getDB(): Database.Database {
  // Check if Turso is configured
  if (isUsingTurso()) {
    // ⚠️ ERROR: getDB() no se puede usar con Turso en producción
    // En producción con Turso, siempre usar getUnifiedDB() + await
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      const error = new Error(
        'getDB() no se puede usar con Turso en producción. Usa getUnifiedDB() y await el resultado.\n' +
        'Stack trace:\n' + new Error().stack
      )
      console.error('[DB] ERROR CRÍTICO:', error.message)
      throw error
    }
    
    // ⚠️ Solo para debug en desarrollo: loguear quién sigue llamando a getDB
    console.trace('[DB] getDB() CALLED (esto no debería ocurrir en Turso)')
    // Initialize schema if not already done
    if (!schemaInitialized) {
      // Initialize synchronously during build - this will be called during static generation
      // For runtime, we'll initialize on first use
      initializeSchemaUnified().catch(err => {
        console.error('[db] Error initializing Turso schema:', err)
      })
      schemaInitialized = true
    }
    
    // Return a wrapper that simulates better-sqlite3 API but uses Turso
    // This is a compatibility layer - actual Turso operations are async
    const unifiedDb = getUnifiedDB()
    
    return {
      prepare(sql: string) {
        const stmt = unifiedDb.prepare(sql)
        return {
          run(...params: any[]) {
            const result = stmt.run(...params)
            // If result is a Promise, we need to handle it synchronously
            // This is a limitation - we'll throw an error to indicate async is needed
            if (result instanceof Promise) {
              throw new Error('Turso requires async operations. Use getUnifiedDB() and await the result.')
            }
            return result
          },
          get(...params: any[]) {
            const result = stmt.get(...params)
            if (result instanceof Promise) {
              throw new Error('Turso requires async operations. Use getUnifiedDB() and await the result.')
            }
            return result
          },
          all(...params: any[]) {
            const result = stmt.all(...params)
            if (result instanceof Promise) {
              throw new Error('Turso requires async operations. Use getUnifiedDB() and await the result.')
            }
            return result
          },
        } as any
      },
      transaction(fn: () => void) {
        const result = unifiedDb.transaction(fn)
        if (result instanceof Promise) {
          throw new Error('Turso requires async operations. Use getUnifiedDB() and await the result.')
        }
        return { default: fn } as any
      },
      exec(sql: string) {
        const result = unifiedDb.exec(sql)
        if (result instanceof Promise) {
          throw new Error('Turso requires async operations. Use getUnifiedDB() and await the result.')
        }
      },
      pragma(key: string, value?: string) {
        return unifiedDb.pragma(key, value)
      },
      close() {
        // Turso doesn't need explicit close
      },
    } as any as Database.Database
  }
  
  // Fallback to better-sqlite3
  if (!db) {
    try {
      // ========================================
      // LOGS CLAROS DEL PATH REAL QUE SE ESTÁ USANDO
      // ========================================
      console.log('[db] ========================================')
      console.log('[db] getDB() called - Using better-sqlite3 (local)')
      console.log('[db] process.cwd():', process.cwd())
      
      // Calcular path y detección de serverless en runtime
      const isServerless = detectServerless()
      const DB_PATH = getDBPath()
      
      // Logs críticos: ¿estoy en Vercel? y ruta exacta
      console.log('[db] ========================================')
      console.log('[db] DETECCIÓN DE ENTORNO:')
      console.log('[db]   isVercel (por env vars):', isVercel)
      console.log('[db]   isServerless (por process.cwd()):', isServerless)
      console.log('[db]   process.cwd():', process.cwd())
      console.log('[db]   DATABASE_PATH env:', process.env.DATABASE_PATH || 'NOT SET')
      console.log('[db]   TURSO_DATABASE_URL:', process.env.TURSO_DATABASE_URL ? 'SET' : 'NOT SET')
      console.log('[db] ========================================')
      console.log('[db] RUTA DE BASE DE DATOS QUE SE VA A USAR:')
      console.log('[db]   DB_PATH:', DB_PATH)
      console.log('[db] ========================================')
      
      // En Vercel/serverless, verificar que /tmp existe y es accesible
      if (isVercel || isServerless) {
        if (!DB_PATH.startsWith('/tmp')) {
          console.error('[db] ERROR: In Vercel/serverless, DB_PATH must be in /tmp, got:', DB_PATH)
          throw new Error(`In Vercel/serverless, database must be in /tmp, but got: ${DB_PATH}`)
        }
        // Verificar que /tmp existe (debería existir siempre en Vercel)
        if (!existsSync('/tmp')) {
          console.error('[db] ERROR: /tmp does not exist in Vercel/serverless environment!')
          throw new Error('Cannot access /tmp directory in Vercel/serverless')
        }
        console.log('[db] Verified /tmp exists and is accessible')
      }
      
      // Verificar si el archivo ya existe
      const dbExists = existsSync(DB_PATH)
      console.log('[db] Database file exists:', dbExists, 'at:', DB_PATH)
      
      // Intentar crear la base de datos
      // better-sqlite3 creará el archivo automáticamente si no existe
      // En Vercel (serverless), usar opciones que funcionen mejor
      const options = (isVercel || isServerless) ? { 
        // En serverless, no usar WAL mode ya que puede causar problemas
      } : {}
      
      console.log('[db] Attempting to open database with options:', JSON.stringify(options))
      db = new Database(DB_PATH, options)
      console.log('[db] Database opened successfully')
      
      // Solo usar WAL mode en desarrollo local (no en Vercel/serverless)
      if (!isVercel && !isServerless) {
        db.pragma('journal_mode = WAL')
      } else {
        // En Vercel/serverless, usar DELETE mode (más compatible con serverless)
        db.pragma('journal_mode = DELETE')
      }
      
      // SIEMPRE ejecutar migraciones/esquema antes de cualquier consulta
      initializeSchema(db)
      console.log('[db] Database initialized successfully at:', DB_PATH)
    } catch (error: any) {
      // Recalcular para logging de error
      const isServerless = detectServerless()
      const DB_PATH = getDBPath()
      
      console.error('[db] ========================================')
      console.error('[db] ERROR opening database at:', DB_PATH)
      console.error('[db] Error message:', error?.message)
      console.error('[db] Error code:', error?.code)
      console.error('[db] DATABASE_PATH env:', process.env.DATABASE_PATH || 'NOT SET')
      console.error('[db] NODE_ENV:', process.env.NODE_ENV || 'NOT SET')
      console.error('[db] isVercel:', isVercel)
      console.error('[db] isServerless:', isServerless)
      console.error('[db] isProduction:', isProduction)
      console.error('[db] VERCEL:', process.env.VERCEL || 'NOT SET')
      console.error('[db] VERCEL_ENV:', process.env.VERCEL_ENV || 'NOT SET')
      console.error('[db] VERCEL_URL:', process.env.VERCEL_URL || 'NOT SET')
      console.error('[db] process.cwd():', process.cwd())
      console.error('[db] ========================================')
      throw error
    }
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
      observation_period TEXT,
      PRIMARY KEY (series_id, date),
      FOREIGN KEY (series_id) REFERENCES macro_series(series_id) ON DELETE CASCADE
    )
  `)
  
  // Añadir columna observation_period si no existe (migración)
  try {
    database.exec(`ALTER TABLE macro_observations ADD COLUMN observation_period TEXT`)
  } catch {
    // Columna ya existe, ignorar error
  }

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

  // Asset prices table (for storing historical prices of forex, stocks, crypto)
  database.exec(`
    CREATE TABLE IF NOT EXISTS asset_prices (
      symbol TEXT NOT NULL,
      date TEXT NOT NULL,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume REAL,
      source TEXT,
      PRIMARY KEY (symbol, date)
    )
  `)

  // Asset metadata table
  database.exec(`
    CREATE TABLE IF NOT EXISTS asset_metadata (
      symbol TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('forex', 'crypto', 'index', 'stock', 'metal', 'commodity')),
      source TEXT,
      yahoo_symbol TEXT,
      last_updated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  // Macro signals history (for backtesting)
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_signals (
      date TEXT PRIMARY KEY,
      usd_score REAL,
      usd_bias TEXT,
      usd_confidence TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Pair signals history (for backtesting)
  database.exec(`
    CREATE TABLE IF NOT EXISTS pair_signals (
      date TEXT,
      symbol TEXT,
      action TEXT,
      confidence TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (date, symbol)
    )
  `)

  // Macro events calendar (for news page)
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_events (
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

    // User notification preferences
    database.exec(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        chat_id TEXT PRIMARY KEY,
        preferences_json TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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

    // Ingest history tracking
    database.exec(`
      CREATE TABLE IF NOT EXISTS ingest_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_type TEXT NOT NULL,
        updated_series_count INTEGER NOT NULL DEFAULT 0,
        errors_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL,
        errors_json TEXT,
        finished_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)

  // Economic events calendar (calendario estático/futuro)
  database.exec(`
    CREATE TABLE IF NOT EXISTS economic_events (
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
    )
  `)
  
  // Add new columns if they don't exist (migration)
  try {
    database.exec(`ALTER TABLE economic_events ADD COLUMN notified_at TEXT NULL`)
  } catch (e: any) {
    // Column already exists, ignore
    if (!e.message?.includes('duplicate column')) {
      console.warn('[schema] Error adding notified_at column:', e.message)
    }
  }
  try {
    database.exec(`ALTER TABLE economic_events ADD COLUMN notify_lead_minutes INTEGER DEFAULT 30`)
  } catch (e: any) {
    // Column already exists, ignore
    if (!e.message?.includes('duplicate column')) {
      console.warn('[schema] Error adding notify_lead_minutes column:', e.message)
    }
  }

  // Economic releases (dato real + sorpresa)
  database.exec(`
    CREATE TABLE IF NOT EXISTS economic_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES economic_events(id),
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
    )
  `)

  // Macro event impact (link directo a sesgos - opcional)
  database.exec(`
    CREATE TABLE IF NOT EXISTS macro_event_impact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      release_id INTEGER NOT NULL REFERENCES economic_releases(id),
      currency TEXT NOT NULL,
      total_score_before REAL,
      total_score_after REAL,
      regime_before TEXT,
      regime_after TEXT,
      usd_direction_before TEXT,
      usd_direction_after TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Job status tracking (monitoreo de jobs)
  database.exec(`
    CREATE TABLE IF NOT EXISTS job_status (
      job_name TEXT PRIMARY KEY,
      last_run_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error_at TEXT,
      last_error_message TEXT,
      runs_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Indexes for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_observations_series_date ON macro_observations(series_id, date);
    CREATE INDEX IF NOT EXISTS idx_asset_prices_symbol_date ON asset_prices(symbol, date);
    CREATE INDEX IF NOT EXISTS idx_asset_prices_date ON asset_prices(date);
    CREATE INDEX IF NOT EXISTS idx_asset_metadata_category ON asset_metadata(category);
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
    CREATE INDEX IF NOT EXISTS idx_ingest_history_finished_at ON ingest_history(finished_at);
    CREATE INDEX IF NOT EXISTS idx_ingest_history_job_type ON ingest_history(job_type);
    CREATE INDEX IF NOT EXISTS idx_economic_events_currency ON economic_events(currency);
    CREATE INDEX IF NOT EXISTS idx_economic_events_scheduled_time ON economic_events(scheduled_time_utc);
    CREATE INDEX IF NOT EXISTS idx_economic_events_series_id ON economic_events(series_id);
    CREATE INDEX IF NOT EXISTS idx_economic_releases_event_id ON economic_releases(event_id);
    CREATE INDEX IF NOT EXISTS idx_economic_releases_release_time ON economic_releases(release_time_utc);
    CREATE INDEX IF NOT EXISTS idx_macro_event_impact_release_id ON macro_event_impact(release_id);
    CREATE INDEX IF NOT EXISTS idx_macro_event_impact_currency ON macro_event_impact(currency);
    CREATE INDEX IF NOT EXISTS idx_job_status_updated_at ON job_status(updated_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_events_source_event_id ON economic_events(source_event_id);
  `)
}

export function closeDB() {
  if (db) {
    db.close()
    db = null
  }
}

