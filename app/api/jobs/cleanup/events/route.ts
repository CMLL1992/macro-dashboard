/**
 * POST /api/jobs/cleanup/events
 * 
 * Purga semanal de eventos macroeconómicos antiguos (retención 180 días).
 * 
 * - Borra primero releases antiguos (economic_releases)
 * - Luego borra eventos antiguos (economic_events)
 * - Protegido con assertCronAuth
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/security/cron'
import { initializeSchemaUnified, getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { logger } from '@/lib/obs/logger'

export const runtime = 'nodejs'

function isCronAuthError(errorMsg: string): boolean {
  return (
    errorMsg.includes('Missing or invalid CRON_SECRET/INGEST_KEY/CRON_TOKEN') ||
    errorMsg.includes('CRON_SECRET, INGEST_KEY, or CRON_TOKEN must be configured')
  )
}

function getCutoffDate(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  // Alinear al inicio de día UTC
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)

    const RETENTION_DAYS = 180
    const cutoff = getCutoffDate(RETENTION_DAYS)

    logger.info('jobs.cleanup.events.starting', {
      retention_days: RETENTION_DAYS,
      cutoff,
    })

    await initializeSchemaUnified()

    let deletedReleases = 0
    let deletedEvents = 0

    if (isUsingTurso()) {
      const db = getUnifiedDB()

      // Borrar releases antiguos primero
      const delReleasesStmt = db.prepare(
        `DELETE FROM economic_releases WHERE release_time_utc IS NOT NULL AND release_time_utc < ?`,
      )
      const relRes = await delReleasesStmt.run(cutoff)
      deletedReleases = typeof relRes.changes === 'number' ? relRes.changes : Number(relRes.changes || 0)

      // Borrar eventos antiguos
      const delEventsStmt = db.prepare(
        `DELETE FROM economic_events WHERE scheduled_time_utc IS NOT NULL AND scheduled_time_utc < ?`,
      )
      const evRes = await delEventsStmt.run(cutoff)
      deletedEvents = typeof evRes.changes === 'number' ? evRes.changes : Number(evRes.changes || 0)
    } else {
      const db = getDB()

      const delReleasesStmt = db.prepare(
        `DELETE FROM economic_releases WHERE release_time_utc IS NOT NULL AND release_time_utc < ?`,
      )
      const relInfo = delReleasesStmt.run(cutoff) as { changes: number }
      deletedReleases = relInfo.changes || 0

      const delEventsStmt = db.prepare(
        `DELETE FROM economic_events WHERE scheduled_time_utc IS NOT NULL AND scheduled_time_utc < ?`,
      )
      const evInfo = delEventsStmt.run(cutoff) as { changes: number }
      deletedEvents = evInfo.changes || 0
    }

    logger.info('jobs.cleanup.events.completed', {
      retention_days: RETENTION_DAYS,
      cutoff,
      deleted_releases: deletedReleases,
      deleted_events: deletedEvents,
    })

    return NextResponse.json({
      status: 'ok' as const,
      cutoff,
      retention_days: RETENTION_DAYS,
      deleted_releases: deletedReleases,
      deleted_events: deletedEvents,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('jobs.cleanup.events.failed', { error: msg })

    // Auth del cron: devolver 401 (no 500)
    if (isCronAuthError(msg)) {
      return NextResponse.json(
        {
          status: 'error' as const,
          reason: 'UNAUTHORIZED' as const,
          error: msg,
        },
        { status: 401 },
      )
    }

    return NextResponse.json(
      {
        status: 'error' as const,
        error: msg,
      },
      { status: 500 },
    )
  }
}

