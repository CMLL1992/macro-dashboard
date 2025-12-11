/**
 * Alert state management
 * Stores previous states in memory and optionally in SQLite/Turso
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'

export type USDState = 'Fuerte' | 'Débil' | 'Neutral'
export type CorrelationLevel = 'Alta' | 'Media' | 'Baja'

export interface AlertState {
  usdBias: USDState | null
  usdBiasUpdatedAt: string | null
  correlationLevels: Record<string, { '3m'?: CorrelationLevel; '12m'?: CorrelationLevel }>
  lastMacroDates: Record<string, string> // series_id -> last date
}

// In-memory state
let state: AlertState = {
  usdBias: null,
  usdBiasUpdatedAt: null,
  correlationLevels: {},
  lastMacroDates: {},
}

// Critical macro indicators to monitor
export const CRITICAL_MACRO_SERIES = [
  'CPIAUCSL', // CPI YoY
  'CPILFESL', // Core CPI YoY
  'PCEPI', // PCE YoY
  'PCEPILFE', // Core PCE YoY
  'PPIACO', // PPI YoY
  'PAYEMS', // NFP (delta)
  'UNRATE', // U3
  'ICSA', // Claims 4w
  'GDPC1', // GDP YoY
  'GDPC1', // GDP QoQ (same series, different transformation)
  'T10Y2Y', // Curve 10Y-2Y
  'VIXCLS', // VIX
] as const

/**
 * Load state from SQLite/Turso (if table exists) or return in-memory state
 */
export async function loadAlertState(): Promise<AlertState> {
  try {
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      
      // Ensure table exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS alerts_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Try to load from Turso
      const usdBiasRow = await db.prepare('SELECT value FROM alerts_state WHERE key = ?').get('usdBias') as { value: string } | undefined
      const usdBiasUpdatedAtRow = await db.prepare('SELECT value FROM alerts_state WHERE key = ?').get('usdBiasUpdatedAt') as { value: string } | undefined
      
      if (usdBiasRow) {
        state.usdBias = usdBiasRow.value as USDState
      }
      if (usdBiasUpdatedAtRow) {
        state.usdBiasUpdatedAt = usdBiasUpdatedAtRow.value
      }
      
      // Load correlation levels
      const corrRows = await db.prepare('SELECT key, value FROM alerts_state WHERE key LIKE ?').all('corr:%') as Array<{ key: string; value: string }>
      for (const row of corrRows) {
        const [symbol, window] = row.key.replace('corr:', '').split(':')
        if (!state.correlationLevels[symbol]) {
          state.correlationLevels[symbol] = {}
        }
        state.correlationLevels[symbol][window as '3m' | '12m'] = row.value as CorrelationLevel
      }
      
      // Load last macro dates
      const dateRows = await db.prepare('SELECT key, value FROM alerts_state WHERE key LIKE ?').all('macro_date:%') as Array<{ key: string; value: string }>
      for (const row of dateRows) {
        const seriesId = row.key.replace('macro_date:', '')
        state.lastMacroDates[seriesId] = row.value
      }
    } else {
      const db = getDB()
      
      // Ensure table exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS alerts_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Try to load from SQLite
      const usdBiasRow = db.prepare('SELECT value FROM alerts_state WHERE key = ?').get('usdBias') as { value: string } | undefined
      const usdBiasUpdatedAtRow = db.prepare('SELECT value FROM alerts_state WHERE key = ?').get('usdBiasUpdatedAt') as { value: string } | undefined
      
      if (usdBiasRow) {
        state.usdBias = usdBiasRow.value as USDState
      }
      if (usdBiasUpdatedAtRow) {
        state.usdBiasUpdatedAt = usdBiasUpdatedAtRow.value
      }
      
      // Load correlation levels
      const corrRows = db.prepare('SELECT key, value FROM alerts_state WHERE key LIKE ?').all('corr:%') as Array<{ key: string; value: string }>
      for (const row of corrRows) {
        const [symbol, window] = row.key.replace('corr:', '').split(':')
        if (!state.correlationLevels[symbol]) {
          state.correlationLevels[symbol] = {}
        }
        state.correlationLevels[symbol][window as '3m' | '12m'] = row.value as CorrelationLevel
      }
      
      // Load last macro dates
      const dateRows = db.prepare('SELECT key, value FROM alerts_state WHERE key LIKE ?').all('macro_date:%') as Array<{ key: string; value: string }>
      for (const row of dateRows) {
        const seriesId = row.key.replace('macro_date:', '')
        state.lastMacroDates[seriesId] = row.value
      }
    }
  } catch (error) {
    // Table might not exist yet, use in-memory state
    console.warn('[alerts/state] Could not load from database, using in-memory state:', error)
  }
  
  return state
}

/**
 * Save state to SQLite/Turso (if table exists)
 */
export async function saveAlertState(newState: Partial<AlertState>): Promise<void> {
  // Update in-memory state
  state = { ...state, ...newState }
  
  try {
    if (isUsingTurso()) {
      const db = getUnifiedDB()
      
      // Ensure table exists
      await db.exec(`
        CREATE TABLE IF NOT EXISTS alerts_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Save USD bias
      if (newState.usdBias !== undefined) {
        await db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run('usdBias', newState.usdBias)
      }
      if (newState.usdBiasUpdatedAt !== undefined) {
        await db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run('usdBiasUpdatedAt', newState.usdBiasUpdatedAt)
      }
      
      // Save correlation levels
      if (newState.correlationLevels) {
        for (const [symbol, levels] of Object.entries(newState.correlationLevels)) {
          for (const [window, level] of Object.entries(levels)) {
            if (level) {
              await db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run(
                `corr:${symbol}:${window}`,
                level
              )
            }
          }
        }
      }
      
      // Save last macro dates
      if (newState.lastMacroDates) {
        for (const [seriesId, date] of Object.entries(newState.lastMacroDates)) {
          await db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run(
            `macro_date:${seriesId}`,
            date
          )
        }
      }
    } else {
      const db = getDB()
      
      // Ensure table exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS alerts_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      // Save USD bias
      if (newState.usdBias !== undefined) {
        db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run('usdBias', newState.usdBias)
      }
      if (newState.usdBiasUpdatedAt !== undefined) {
        db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run('usdBiasUpdatedAt', newState.usdBiasUpdatedAt)
      }
      
      // Save correlation levels
      if (newState.correlationLevels) {
        for (const [symbol, levels] of Object.entries(newState.correlationLevels)) {
          for (const [window, level] of Object.entries(levels)) {
            if (level) {
              db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run(
                `corr:${symbol}:${window}`,
                level
              )
            }
          }
        }
      }
      
      // Save last macro dates
      if (newState.lastMacroDates) {
        for (const [seriesId, date] of Object.entries(newState.lastMacroDates)) {
          db.prepare('INSERT OR REPLACE INTO alerts_state (key, value) VALUES (?, ?)').run(
            `macro_date:${seriesId}`,
            date
          )
        }
      }
    }
  } catch (error) {
    console.warn('[alerts/state] Could not save to database:', error)
  }
}

/**
 * Get current USD bias state
 */
export function getUSDState(): USDState | null {
  return state.usdBias
}

/**
 * Get correlation level for a symbol and window
 */
export function getCorrelationLevel(symbol: string, window: '3m' | '12m'): CorrelationLevel | undefined {
  return state.correlationLevels[symbol]?.[window]
}

/**
 * Get last date for a macro series
 */
export function getLastMacroDate(seriesId: string): string | undefined {
  return state.lastMacroDates[seriesId]
}

/**
 * Calculate correlation level from value
 */
export function calculateCorrelationLevel(corr: number | null | undefined): CorrelationLevel | null {
  if (corr == null || !Number.isFinite(corr)) return null
  const abs = Math.abs(corr)
  if (abs >= 0.60) return 'Alta'
  if (abs >= 0.30) return 'Media'
  return 'Baja'
}

