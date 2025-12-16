/**
 * Job: Clean up macro_bias table - remove pairs not in tactical-pairs.json
 * POST /api/jobs/cleanup/macro-bias
 * Protected by CRON_TOKEN
 * 
 * This job removes entries from macro_bias table for pairs that are not in tactical-pairs.json
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { logger } from '@/lib/obs/logger'
import { getAllowedPairs } from '@/config/tactical-pairs'

export async function POST(request: NextRequest) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  if (isLocalhost && (!hasCronToken || !isVercel)) {
    console.log('[cleanup/macro-bias] Allowing request from localhost without token')
  } else {
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  const jobId = 'cleanup_macro_bias'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting macro_bias cleanup', { job: jobId })

    // Get allowed pairs from tactical-pairs.json
    const allowedPairs = getAllowedPairs()
    
    logger.info('Loaded allowed pairs from tactical-pairs.json', {
      job: jobId,
      count: allowedPairs.length,
      pairs: allowedPairs,
    })

    const db = getUnifiedDB()
    const isTurso = isUsingTurso()

    let normalizedRows = 0
    let deletedRows = 0

    // Step 1: Normalize ETHUSDT → ETHUSD (and any other variants)
    try {
      if (isTurso) {
        const result = await db.prepare(`
          UPDATE macro_bias
          SET symbol = 'ETHUSD'
          WHERE symbol = 'ETHUSDT'
        `).run()
        normalizedRows = result.changes || 0
      } else {
        const stmt = db.prepare(`
          UPDATE macro_bias
          SET symbol = 'ETHUSD'
          WHERE symbol = 'ETHUSDT'
        `)
        const result = stmt.run() as { changes: number; lastInsertRowid: number | bigint }
        normalizedRows = result.changes || 0
      }
      if (normalizedRows > 0) {
        logger.info('Normalized ETHUSDT → ETHUSD in macro_bias', {
          job: jobId,
          normalized: normalizedRows,
        })
      }
    } catch (error) {
      logger.warn('Failed to normalize ETHUSDT in macro_bias (may not exist)', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - normalization is optional
    }

    // Step 2: Delete macro_bias entries for non-allowed symbols
    // Build SQL conditions for allowed symbols
    const placeholders = allowedPairs.map(() => '?').join(',')
    
    try {
      if (isTurso) {
        const result = await db.prepare(`
          DELETE FROM macro_bias
          WHERE symbol NOT IN (${placeholders})
        `).run(...allowedPairs)
        deletedRows = result.changes || 0
      } else {
        const stmt = db.prepare(`
          DELETE FROM macro_bias
          WHERE symbol NOT IN (${placeholders})
        `)
        const result = stmt.run(...allowedPairs) as { changes: number; lastInsertRowid: number | bigint }
        deletedRows = result.changes || 0
      }
      logger.info('Cleaned up macro_bias', {
        job: jobId,
        normalized: normalizedRows,
        deleted: deletedRows,
      })
    } catch (error) {
      logger.error('Failed to clean up macro_bias', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }

    const finishedAt = new Date().toISOString()
    const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Macro_bias cleanup completed', {
      job: jobId,
      normalized: normalizedRows,
      deletedRows,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      job: jobId,
      startedAt,
      finishedAt,
      duration_ms: duration,
      normalized: normalizedRows,
      deleted: deletedRows,
      allowedPairs,
    })
  } catch (error) {
    logger.error('Macro_bias cleanup failed', {
      job: jobId,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        success: false,
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}


