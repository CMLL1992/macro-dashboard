/**
 * Script de migración para Turso
 * Crea todas las tablas necesarias en la base de datos Turso de producción
 * 
 * Uso:
 *   pnpm db:migrate:turso
 * 
 * Requiere:
 *   - TURSO_DATABASE_URL en .env.local
 *   - TURSO_AUTH_TOKEN en .env.local
 */

import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Cargar variables de entorno desde .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

// Schema completo (mismo que en lib/db/unified-db.ts)
const schemaStatements = [
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
  // Índices
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

// Migraciones adicionales (columnas que pueden no existir)
const migrations = [
  `ALTER TABLE economic_events ADD COLUMN notified_at TEXT NULL`,
  `ALTER TABLE economic_events ADD COLUMN notify_lead_minutes INTEGER DEFAULT 30`,
]

async function main() {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN

  if (!url || !authToken) {
    console.error('❌ Error: TURSO_DATABASE_URL o TURSO_AUTH_TOKEN no están definidos')
    console.error('   Asegúrate de tener estas variables en .env.local')
    process.exit(1)
  }

  console.log('🚀 Iniciando migración de Turso...')
  console.log(`   URL: ${url.replace(/\/\/.*@/, '//***@')}`) // Ocultar credenciales en logs
  console.log(`   Token: ${authToken.substring(0, 10)}...`)
  console.log('')

  const db = createClient({ url, authToken })

  // Verificar conexión
  try {
    await db.execute('SELECT 1')
    console.log('✅ Conexión a Turso establecida')
  } catch (error) {
    console.error('❌ Error al conectar con Turso:', error)
    process.exit(1)
  }

  // Crear tablas e índices
  console.log('📋 Creando tablas e índices...')
  let created = 0
  let skipped = 0
  let errors = 0

  for (const sql of schemaStatements) {
    if (!sql.trim()) continue
    
    const statementType = sql.trim().substring(0, sql.trim().indexOf(' ')).toUpperCase()
    const tableName = sql.match(/CREATE (?:TABLE|INDEX).*? (?:IF NOT EXISTS )?(\w+)/i)?.[1] || 'unknown'
    
    try {
      await db.execute(sql)
      created++
      console.log(`   ✅ ${statementType} ${tableName}`)
    } catch (error: any) {
      // Ignorar errores de "already exists"
      if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
        skipped++
        console.log(`   ⏭️  ${statementType} ${tableName} (ya existe)`)
      } else {
        errors++
        console.error(`   ❌ Error en ${statementType} ${tableName}:`, error.message)
      }
    }
  }

  // Aplicar migraciones adicionales
  console.log('')
  console.log('🔄 Aplicando migraciones adicionales...')
  for (const sql of migrations) {
    try {
      await db.execute(sql)
      console.log(`   ✅ Migración aplicada: ${sql.substring(0, 50)}...`)
    } catch (error: any) {
      // Ignorar errores de "column already exists"
      if (error.message?.includes('duplicate column') || error.message?.includes('already exists')) {
        console.log(`   ⏭️  Columna ya existe (migración ya aplicada)`)
      } else {
        console.error(`   ❌ Error en migración:`, error.message)
      }
    }
  }

  // Verificar tablas creadas
  console.log('')
  console.log('🔍 Verificando tablas creadas...')
  try {
    const result = await db.execute(`
      SELECT name FROM sqlite_master 
      WHERE type = 'table' 
      ORDER BY name
    `)
    const tables = result.rows.map((row: any) => row.name)
    console.log(`   ✅ ${tables.length} tablas encontradas:`)
    tables.forEach((table: string) => {
      console.log(`      - ${table}`)
    })
  } catch (error) {
    console.error('   ⚠️  No se pudo verificar tablas:', error)
  }

  console.log('')
  console.log('📊 Resumen:')
  console.log(`   ✅ Creados/actualizados: ${created}`)
  console.log(`   ⏭️  Ya existían: ${skipped}`)
  console.log(`   ❌ Errores: ${errors}`)
  console.log('')
  console.log('✅ Migración de Turso completada exitosamente')
}

main().catch((err) => {
  console.error('')
  console.error('❌ Error fatal en migración de Turso:', err)
  process.exit(1)
})
