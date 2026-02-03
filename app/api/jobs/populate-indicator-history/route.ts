/**
 * Job: Populate indicator_history with all indicators
 * POST /api/jobs/populate-indicator-history
 * 
 * This job populates indicator_history table with all indicators
 * to eliminate N+1 queries and improve dashboard performance.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { getAllLatestFromDBWithPrev } from '@/lib/db/read-macro'
import { upsertIndicatorHistory } from '@/lib/db/upsert'
import { logger } from '@/lib/obs/logger'

export async function POST(request: NextRequest) {
  // Allow without token in development
  const env = process.env
  const hasCronToken = env.CRON_TOKEN && env.CRON_TOKEN.length > 0
  const isLocalhost = request.headers.get('host')?.includes('localhost') || request.headers.get('host')?.includes('127.0.0.1')
  
  if (hasCronToken && !isLocalhost) {
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  const jobId = 'populate_indicator_history'
  const startedAt = new Date()

  try {
    logger.info('Starting indicator_history population', { job: jobId })

    console.log('🔄 Obteniendo todos los indicadores...')
    
    // Obtener todos los indicadores (puede ser lento la primera vez)
    const indicators = await getAllLatestFromDBWithPrev()
    
    console.log(`✅ Obtenidos ${indicators.length} indicadores`)
    console.log('💾 Guardando en indicator_history...')
    
    let saved = 0
    let errors = 0
    const errorDetails: string[] = []
    
    for (const ind of indicators) {
      try {
        if (ind.value !== null && ind.date) {
          // Use calculated previous values from getAllLatestFromDBWithPrev
          await upsertIndicatorHistory({
            indicatorKey: ind.key,
            value: ind.value,
            date: ind.date,
          })
          saved++
        } else {
          console.warn(`⚠️  Indicador ${ind.key} tiene valor o fecha nula, omitiendo`)
        }
      } catch (error) {
        const errorMsg = `Error guardando ${ind.key}: ${error instanceof Error ? error.message : String(error)}`
        console.error(`❌ ${errorMsg}`)
        errorDetails.push(errorMsg)
        errors++
      }
    }
    
    const duration = Date.now() - startedAt.getTime()
    
    logger.info('Indicator history population completed', {
      job: jobId,
      saved,
      errors,
      total: indicators.length,
      durationMs: duration,
    })

    return NextResponse.json({
      success: true,
      saved,
      errors,
      total: indicators.length,
      duration_ms: duration,
      finishedAt: new Date().toISOString(),
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    })
  } catch (error) {
    const duration = Date.now() - startedAt.getTime()
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error('Indicator history population failed', {
      job: jobId,
      error: errorMessage,
      stack: errorStack,
      durationMs: duration,
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration_ms: duration,
        finishedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
