/**
 * Job state management for chunking/continuation
 * Allows jobs to process in batches and resume from last cursor
 */

import { getUnifiedDB } from './unified-db'
import { logger } from '@/lib/obs/logger'

export interface JobState {
  job_name: string
  cursor: string | null
  updated_at: string
  last_run_status: string | null
  last_run_duration_ms: number | null
}

/**
 * Get job state (cursor) from database
 */
export async function getJobState(jobName: string): Promise<JobState | null> {
  try {
    const db = getUnifiedDB()
    const result = await db.prepare(
      `SELECT job_name, cursor, updated_at, last_run_status, last_run_duration_ms 
       FROM job_state WHERE job_name = ?`
    ).get(jobName) as JobState | null
    
    return result
  } catch (error: any) {
    // If table doesn't exist, return null (table will be created by migration)
    if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
      logger.warn(`Table job_state does not exist yet for ${jobName}`, { 
        job: jobName,
        error: String(error) 
      })
      return null
    }
    logger.warn(`Failed to get job state for ${jobName}`, { 
      job: jobName,
      error: String(error) 
    })
    return null
  }
}

/**
 * Save job state (cursor) to database
 */
export async function saveJobState(
  jobName: string,
  cursor: string | null,
  status: 'success' | 'partial' | 'error' = 'success',
  durationMs?: number
): Promise<void> {
  try {
    const db = getUnifiedDB()
    await db.prepare(
      `INSERT INTO job_state (job_name, cursor, updated_at, last_run_status, last_run_duration_ms)
       VALUES (?, ?, datetime('now'), ?, ?)
       ON CONFLICT(job_name) DO UPDATE SET
         cursor = excluded.cursor,
         updated_at = excluded.updated_at,
         last_run_status = excluded.last_run_status,
         last_run_duration_ms = excluded.last_run_duration_ms`
    ).run(jobName, cursor, status, durationMs ?? null)
    
    logger.info(`Saved job state for ${jobName}`, {
      job: jobName,
      cursor,
      status,
      durationMs,
    })
  } catch (error: any) {
    // If table doesn't exist, log warning but don't throw (table will be created by migration)
    if (error?.message?.includes('no such table') || error?.message?.includes('does not exist')) {
      logger.warn(`Table job_state does not exist yet - job will continue without state tracking`, {
        job: jobName,
        error: String(error),
        note: 'Run migration script to create job_state table',
      })
      // Don't throw - job state is not critical, job can continue
      return
    }
    logger.error(`Failed to save job state for ${jobName}`, {
      job: jobName,
      error: String(error),
    })
    // Don't throw - job state is not critical, job must continue
  }
}

/**
 * Clear job state (reset cursor to null)
 */
export async function clearJobState(jobName: string): Promise<void> {
  await saveJobState(jobName, null, 'success')
}
