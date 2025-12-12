/**
 * Job: Clean up pairs not in tactical-pairs.json
 * POST /api/jobs/cleanup/pairs
 * Protected by CRON_TOKEN
 * 
 * This job removes data for pairs that are not in tactical-pairs.json from:
 * - pair_signals table
 * - correlations table
 * - correlations_history table
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { logger } from '@/lib/obs/logger'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function POST(request: NextRequest) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  if (isLocalhost && (!hasCronToken || !isVercel)) {
    console.log('[cleanup/pairs] Allowing request from localhost without token')
  } else {
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  const jobId = 'cleanup_pairs'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting pairs cleanup', { job: jobId })

    // Load allowed symbols from tactical-pairs.json
    let allowedSymbols = new Set<string>()
    try {
      const tacticalPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
      const tacticalRaw = await fs.readFile(tacticalPath, 'utf8')
      const tacticalPairs = JSON.parse(tacticalRaw) as Array<{ symbol: string; type?: string }>
      allowedSymbols = new Set(
        tacticalPairs.map(p => p.symbol.toUpperCase().replace('/', ''))
      )
      logger.info('Loaded allowed symbols from tactical-pairs.json', {
        job: jobId,
        count: allowedSymbols.size,
        symbols: Array.from(allowedSymbols),
      })
    } catch (error) {
      logger.error('Failed to load tactical-pairs.json', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json(
        { error: 'Failed to load tactical-pairs.json', job: jobId },
        { status: 500 }
      )
    }

    const db = getUnifiedDB()
    const isTurso = isUsingTurso()

    // Build SQL conditions for allowed symbols
    const allowedSymbolsArray = Array.from(allowedSymbols)
    const placeholders = allowedSymbolsArray.map(() => '?').join(',')

    let deletedPairSignals = 0
    let deletedCorrelations = 0
    let deletedCorrelationsHistory = 0

    // 1. Delete pair_signals for non-allowed symbols
    try {
      if (isTurso) {
        const result = await db.prepare(`
          DELETE FROM pair_signals
          WHERE symbol NOT IN (${placeholders})
        `).run(...allowedSymbolsArray)
        deletedPairSignals = result.changes || 0
      } else {
        const stmt = db.prepare(`
          DELETE FROM pair_signals
          WHERE symbol NOT IN (${placeholders})
        `)
        const result = stmt.run(...allowedSymbolsArray)
        deletedPairSignals = result.changes || 0
      }
      logger.info('Cleaned up pair_signals', {
        job: jobId,
        deleted: deletedPairSignals,
      })
    } catch (error) {
      logger.error('Failed to clean up pair_signals', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // 2. Delete correlations for non-allowed symbols
    try {
      if (isTurso) {
        const result = await db.prepare(`
          DELETE FROM correlations
          WHERE symbol NOT IN (${placeholders})
        `).run(...allowedSymbolsArray)
        deletedCorrelations = result.changes || 0
      } else {
        const stmt = db.prepare(`
          DELETE FROM correlations
          WHERE symbol NOT IN (${placeholders})
        `)
        const result = stmt.run(...allowedSymbolsArray)
        deletedCorrelations = result.changes || 0
      }
      logger.info('Cleaned up correlations', {
        job: jobId,
        deleted: deletedCorrelations,
      })
    } catch (error) {
      logger.error('Failed to clean up correlations', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // 3. Delete correlations_history for non-allowed symbols
    try {
      if (isTurso) {
        const result = await db.prepare(`
          DELETE FROM correlations_history
          WHERE symbol NOT IN (${placeholders})
        `).run(...allowedSymbolsArray)
        deletedCorrelationsHistory = result.changes || 0
      } else {
        const stmt = db.prepare(`
          DELETE FROM correlations_history
          WHERE symbol NOT IN (${placeholders})
        `)
        const result = stmt.run(...allowedSymbolsArray)
        deletedCorrelationsHistory = result.changes || 0
      }
      logger.info('Cleaned up correlations_history', {
        job: jobId,
        deleted: deletedCorrelationsHistory,
      })
    } catch (error) {
      logger.error('Failed to clean up correlations_history', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const finishedAt = new Date().toISOString()
    const duration = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Pairs cleanup completed', {
      job: jobId,
      deletedPairSignals,
      deletedCorrelations,
      deletedCorrelationsHistory,
      duration_ms: duration,
    })

    return NextResponse.json({
      success: true,
      job: jobId,
      startedAt,
      finishedAt,
      duration_ms: duration,
      deleted: {
        pair_signals: deletedPairSignals,
        correlations: deletedCorrelations,
        correlations_history: deletedCorrelationsHistory,
      },
      allowedSymbols: Array.from(allowedSymbols),
    })
  } catch (error) {
    logger.error('Pairs cleanup failed', {
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
