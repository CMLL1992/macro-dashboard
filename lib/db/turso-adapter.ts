/**
 * Turso Database Adapter
 * Provides a unified interface for both Turso (production) and better-sqlite3 (local)
 * 
 * Usage:
 * - Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel environment variables
 * - If not set, falls back to better-sqlite3 local database
 */

import 'server-only'
import { createClient, type Client } from '@libsql/client'
import Database from 'better-sqlite3'
import type { Database as BetterSQLite3Database } from 'better-sqlite3'

// Check if Turso is configured
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN
const USE_TURSO = !!(TURSO_DATABASE_URL && TURSO_AUTH_TOKEN)

let tursoClient: Client | null = null
let sqliteDb: BetterSQLite3Database | null = null

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
  }
  return tursoClient
}

/**
 * Unified database interface
 * Returns Turso client if configured, otherwise better-sqlite3 database
 */
export function getUnifiedDB(): Client | BetterSQLite3Database {
  if (USE_TURSO) {
    return getTursoClient()
  }
  // Fallback to better-sqlite3 (will be initialized by schema.ts)
  // This is a placeholder - actual initialization happens in schema.ts
  throw new Error('better-sqlite3 database should be initialized via getDB() from schema.ts')
}

/**
 * Check if using Turso
 */
export function isUsingTurso(): boolean {
  return USE_TURSO
}

/**
 * Execute SQL (works with both Turso and better-sqlite3)
 * For Turso: returns Promise
 * For better-sqlite3: returns result directly
 */
export async function executeSQL(sql: string, params: any[] = []): Promise<any> {
  if (USE_TURSO) {
    const client = getTursoClient()
    return await client.execute({ sql, args: params })
  }
  // For better-sqlite3, this should not be called directly
  // Use getDB() from schema.ts instead
  throw new Error('executeSQL should only be used with Turso. Use getDB() for better-sqlite3')
}
























