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
 */
export async function initializeSchemaUnified(): Promise<void> {
  const db = getUnifiedDB()
  
  const schema = `
    CREATE TABLE IF NOT EXISTS macro_series (
      series_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      unit TEXT,
      last_updated TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS macro_observations (
      series_id TEXT NOT NULL,
      date TEXT NOT NULL,
      value REAL,
      PRIMARY KEY (series_id, date),
      FOREIGN KEY (series_id) REFERENCES macro_series(series_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS macro_bias (
      symbol TEXT PRIMARY KEY,
      score REAL NOT NULL,
      direction TEXT NOT NULL,
      confidence REAL NOT NULL,
      drivers_json TEXT NOT NULL,
      narrative_json TEXT,
      computed_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE INDEX IF NOT EXISTS idx_observations_series_date ON macro_observations(series_id, date);
    CREATE INDEX IF NOT EXISTS idx_correlations_symbol ON correlations(symbol);
  `
  
  // Split by semicolon and execute each statement
  const statements = schema.split(';').filter(s => s.trim())
  for (const statement of statements) {
    if (statement.trim()) {
      await db.exec(statement.trim())
    }
  }
}

