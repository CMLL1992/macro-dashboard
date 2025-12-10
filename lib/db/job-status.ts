/**
 * Job Status Tracking
 * Almacena timestamps de última ejecución de jobs para monitoreo
 */

import { getUnifiedDB } from './unified-db'

export type JobStatus = {
  job_name: string
  last_run_at: string | null
  last_success_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  runs_count: number
  success_count: number
  error_count: number
}

/**
 * Registrar ejecución exitosa de un job
 */
export async function recordJobSuccess(jobName: string): Promise<void> {
  const now = new Date().toISOString()
  // All methods are async now, so always use await
  const db = getUnifiedDB()

  // Crear tabla si no existe
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS job_status (
      job_name TEXT PRIMARY KEY,
      last_run_at TEXT NOT NULL,
      last_success_at TEXT NOT NULL,
      last_error_at TEXT,
      last_error_message TEXT,
      runs_count INTEGER DEFAULT 1,
      success_count INTEGER DEFAULT 1,
      error_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run()

  // Upsert
  await db.prepare(`
    INSERT INTO job_status (
      job_name, last_run_at, last_success_at,
      runs_count, success_count, updated_at
    ) VALUES (?, ?, ?, 1, 1, ?)
    ON CONFLICT(job_name) DO UPDATE SET
      last_run_at = excluded.last_run_at,
      last_success_at = excluded.last_success_at,
      runs_count = runs_count + 1,
      success_count = success_count + 1,
      updated_at = excluded.updated_at
  `).run(jobName, now, now, now)
}

/**
 * Registrar ejecución con error de un job
 */
export async function recordJobError(jobName: string, errorMessage: string): Promise<void> {
  const now = new Date().toISOString()
  // All methods are async now, so always use await
  const db = getUnifiedDB()

  // Crear tabla si no existe (mismo código que arriba)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS job_status (
      job_name TEXT PRIMARY KEY,
      last_run_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error_at TEXT NOT NULL,
      last_error_message TEXT NOT NULL,
      runs_count INTEGER DEFAULT 1,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL
    )
  `).run()

  // Upsert
  await db.prepare(`
    INSERT INTO job_status (
      job_name, last_run_at, last_error_at, last_error_message,
      runs_count, error_count, updated_at
    ) VALUES (?, ?, ?, ?, 1, 1, ?)
    ON CONFLICT(job_name) DO UPDATE SET
      last_run_at = excluded.last_run_at,
      last_error_at = excluded.last_error_at,
      last_error_message = excluded.last_error_message,
      runs_count = runs_count + 1,
      error_count = error_count + 1,
      updated_at = excluded.updated_at
  `).run(jobName, now, now, errorMessage.substring(0, 500), now)
}

/**
 * Obtener estado de un job
 */
export async function getJobStatus(jobName: string): Promise<JobStatus | null> {
  // All methods are async now, so always use await
  const db = getUnifiedDB()

  const row = await db.prepare('SELECT * FROM job_status WHERE job_name = ?').get(jobName) as any
  return row || null
}

/**
 * Obtener estado de todos los jobs
 */
export async function getAllJobStatuses(): Promise<JobStatus[]> {
  try {
    // All methods are async now, so always use await
    const db = getUnifiedDB()

    // Verificar si la tabla existe antes de consultar
    const checkTable = await db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='job_status'
    `).get()
    const tableExists = !!checkTable

    if (!tableExists) {
      // Tabla no existe aún, retornar array vacío
      return []
    }

    // All methods are async now, so always use await
    const rows = await db.prepare('SELECT * FROM job_status ORDER BY job_name').all() as any[]
    return rows
  } catch (error) {
    console.warn('[job-status] Error fetching job statuses:', error)
    // Retornar array vacío en caso de error
    return []
  }
}

