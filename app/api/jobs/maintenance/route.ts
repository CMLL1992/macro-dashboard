/**
 * Job: Weekly maintenance (cleanup, VACUUM)
 * POST /api/jobs/maintenance
 * Protected by CRON_TOKEN
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { getDB } from '@/lib/db/schema'
import { logger } from '@/lib/obs/logger'
import { revalidatePath } from 'next/cache'
import * as fs from 'node:fs'
import * as path from 'node:path'

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'maintenance'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting maintenance', { job: jobId })

    const db = getDB()

    // 1. Integrity check (weekly)
    const integrityResult = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }
    if (integrityResult.integrity_check !== 'ok') {
      logger.error('SQLite integrity check failed', { job: jobId, result: integrityResult.integrity_check })
    } else {
      logger.info('SQLite integrity check passed', { job: jobId })
    }

    // 2. VACUUM SQLite para optimizar base de datos (weekly)
    db.exec('VACUUM')

    // 3. Daily backup (if backup directory exists)
    try {
      // Usar la misma lógica que lib/db/schema.ts
      const isProduction = process.env.NODE_ENV === 'production'
      const dbPath = process.env.DATABASE_PATH || (
        isProduction
          ? '/tmp/macro.db'
          : path.join(process.cwd(), 'macro.db')
      )
      const backupDir = isProduction ? '/tmp/backups' : path.join(process.cwd(), 'backups')
      
      if (fs.existsSync(backupDir)) {
        const backupPath = path.join(backupDir, `macro_${new Date().toISOString().split('T')[0]}.db`)
        fs.copyFileSync(dbPath, backupPath)
        logger.info('Database backup created', { job: jobId, backup_path: backupPath })
      }
    } catch (backupError) {
      logger.warn('Backup failed (non-critical)', { job: jobId, error: backupError instanceof Error ? backupError.message : String(backupError) })
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Maintenance completed', {
      job: jobId,
      duration_ms: durationMs,
    })

    revalidatePath('/') // Revalidate dashboard after maintenance

    return NextResponse.json({
      success: true,
      duration_ms: durationMs,
      integrity_check: integrityResult.integrity_check,
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Maintenance failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}



