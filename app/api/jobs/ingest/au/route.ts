/**
 * Job: Ingest Australia economic indicators into SQLite
 * POST /api/jobs/ingest/au
 * Protected by CRON_TOKEN
 * 
 * Ingests all Australia indicators (AUD) used by the dashboard
 * Supports dryRun mode: ?dryRun=1 (no DB writes, returns preview)
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { fetchTradingEconomics } from '@/lib/ingestors/tradingeconomics'
import fs from 'node:fs'
import path from 'node:path'

// Load Australia indicators config
function loadAUIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'au-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load au-indicators.json', { error })
    return { indicators: [] }
  }
}

const AU_INDICATORS = loadAUIndicators()

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_au'
  const startedAt = new Date().toISOString()
  
  // Check for dryRun mode
  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  try {
    logger.info('Starting Australia indicators ingestion', { job: jobId, dryRun })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ indicatorId?: string; error: string; errorType?: string }> = []
    const dryRunResults: Array<{
      indicatorId: string
      source: string
      status: string
      firstDate?: string
      lastDate?: string
      sample?: Array<{ date: string; value: number }>
      url?: string
    }> = []

    const indicators = AU_INDICATORS.indicators || []
    
    // Rate limiting for Trading Economics
    let lastTradingEconomicsRequest = 0
    const TRADING_ECONOMICS_MIN_DELAY_MS = 2000 // 2 seconds between requests

    for (const indicator of indicators) {
      try {
        let macroSeries: MacroSeries | null = null
        let sourceUsed = 'none'
        let fetchUrl: string | undefined

        // AU indicators: prefer ABS, fallback to Trading Economics
        if (indicator.source === 'abs' || indicator.source === 'trading_economics') {
          // Try ABS first (official Australian source)
          try {
            const { fetchABSIndicator } = await import('@/lib/ingestors/absAU')
            const observations = await fetchABSIndicator(indicator.id)
            
            if (observations && observations.length > 0) {
              macroSeries = {
                id: indicator.id,
                source: 'ABS' as const,
                indicator: indicator.id,
                nativeId: indicator.id,
                name: indicator.name || indicator.id,
                frequency: (indicator.frequency?.toUpperCase() || 'M') as 'A' | 'Q' | 'M' | 'W' | 'D',
                unit: indicator.unit,
                data: observations.map(obs => ({
                  date: obs.date,
                  value: obs.value,
                })),
              }
              sourceUsed = 'abs'
              logger.info(`Successfully fetched ${indicator.id} from ABS`, {
                job: jobId,
                indicatorId: indicator.id,
                observations: observations.length,
              })
            }
          } catch (absError) {
            const errorMsg = absError instanceof Error ? absError.message : String(absError)
            
            // Classify error type
            let errorType = 'source_mapping_error'
            if (errorMsg.includes('404') || errorMsg.includes('Not Found') || errorMsg.includes('No ABS mapping')) {
              errorType = 'source_mapping_error'
            } else if (errorMsg.includes('timeout') || errorMsg.includes('5')) {
              errorType = 'source_down'
            }
            
            logger.warn(`ABS fetch failed for ${indicator.id}, will try Trading Economics fallback`, {
              job: jobId,
              indicatorId: indicator.id,
              error: errorMsg,
              errorType,
            })
            
            // If it's a mapping error, don't try TE fallback (it will also fail)
            if (errorType === 'source_mapping_error' && indicator.source === 'abs') {
              ingestErrors.push({ 
                indicatorId: indicator.id, 
                error: `ABS mapping error: ${errorMsg}`,
                errorType: 'source_mapping_error'
              })
              errors++
              continue
            }
            // Fall through to Trading Economics if ABS fails
          }
          
          // Fallback to Trading Economics if ABS didn't work or if explicitly requested
          if (!macroSeries && indicator.source === 'trading_economics') {
            const apiKey = process.env.TE_API_KEY
            if (!apiKey) {
              logger.warn(`TE_API_KEY not configured, skipping Trading Economics fallback for ${indicator.id}`, {
                job: jobId,
                indicatorId: indicator.id,
              })
              ingestErrors.push({ 
                indicatorId: indicator.id, 
                error: 'TE_API_KEY not configured',
                errorType: 'source_not_configured'
              })
              errors++
              continue
            }

            // Rate limiting
            const now = Date.now()
            const timeSinceLastRequest = now - lastTradingEconomicsRequest
            if (timeSinceLastRequest < TRADING_ECONOMICS_MIN_DELAY_MS) {
              const waitTime = TRADING_ECONOMICS_MIN_DELAY_MS - timeSinceLastRequest
              logger.info(`Rate limiting Trading Economics: waiting ${waitTime}ms`, { job: jobId, indicatorId: indicator.id })
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }

            try {
              lastTradingEconomicsRequest = Date.now()
              const observations = await fetchTradingEconomics(indicator.series, apiKey, 'australia')
              
              if (!observations || observations.length === 0) {
                throw new Error('No observations returned from Trading Economics')
              }

              macroSeries = {
                id: indicator.id,
                source: 'TRADING_ECONOMICS' as const,
                indicator: indicator.id,
                nativeId: indicator.id,
                name: indicator.name || indicator.id,
                frequency: (indicator.frequency?.toUpperCase() || 'M') as 'A' | 'Q' | 'M' | 'W' | 'D',
                unit: indicator.unit,
                data: observations.map(obs => ({
                  date: obs.date,
                  value: obs.value,
                })),
              }
              sourceUsed = 'trading_economics'
            } catch (teError) {
              let errorMessage = 'Unknown error'
              if (teError instanceof Error) {
                errorMessage = teError.message
              } else if (typeof teError === 'object' && teError !== null) {
                const errorObj = teError as any
                errorMessage = errorObj.message || errorObj.error || errorObj.type || JSON.stringify(teError)
              } else {
                errorMessage = String(teError)
              }
              
              // Handle 403 as "source_not_allowed" (license limitation, not a system error)
              if (errorMessage.includes('403') || errorMessage.includes('No Access to this country')) {
                logger.warn(`Trading Economics 403 for ${indicator.id}: source_not_allowed (license limitation)`, {
                  job: jobId,
                  indicatorId: indicator.id,
                  error: errorMessage,
                })
                ingestErrors.push({ 
                  indicatorId: indicator.id, 
                  error: `source_not_allowed: Trading Economics plan does not include Australia data`,
                  errorType: 'source_not_allowed'
                })
                errors++
                continue
              } else {
                throw new Error(`Trading Economics error: ${errorMessage}`)
              }
            }
          }
        } else {
          throw new Error(`Unsupported source: ${indicator.source}`)
        }

        if (!macroSeries) {
          throw new Error('Failed to fetch macro series')
        }

        // Dry run mode: return preview without inserting
        if (dryRun) {
          dryRunResults.push({
            indicatorId: indicator.id,
            source: sourceUsed,
            status: 'success',
            firstDate: macroSeries.data[0]?.date,
            lastDate: macroSeries.data[macroSeries.data.length - 1]?.date,
            sample: macroSeries.data.slice(0, 3),
            url: fetchUrl,
          })
          continue
        }

        // Count rows BEFORE insertion
        let verifyCountBefore = 0
        try {
          const db = getUnifiedDB()
          const beforeResult = await db.prepare(
            `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
          ).get(indicator.id) as { count: number } | null
          verifyCountBefore = beforeResult?.count || 0
        } catch (beforeErr) {
          logger.warn(`[${jobId}] Could not count rows before insertion for ${indicator.id}`, { error: String(beforeErr) })
        }

        // Upsert to database
        await upsertMacroSeries(macroSeries)
        
        // Count rows AFTER insertion
        let verifyCountAfter = 0
        try {
          const db = getUnifiedDB()
          const afterResult = await db.prepare(
            `SELECT COUNT(*) as count FROM macro_observations WHERE series_id = ?`
          ).get(indicator.id) as { count: number } | null
          verifyCountAfter = afterResult?.count || 0
        } catch (afterErr) {
          logger.warn(`[${jobId}] Could not count rows after insertion for ${indicator.id}`, { error: String(afterErr) })
        }
        
        const delta = verifyCountAfter - verifyCountBefore
        
        ingested++
        logger.info(`Ingested Australia indicator: ${indicator.id}`, { 
          job: jobId, 
          indicatorId: indicator.id, 
          observations: macroSeries.data.length,
          beforeCount: verifyCountBefore,
          afterCount: verifyCountAfter,
          newRows: delta,
          firstDate: macroSeries.data[0]?.date,
          lastDate: macroSeries.data[macroSeries.data.length - 1]?.date,
        })
      } catch (error) {
        errors++
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorType = errorMessage.includes('source_') ? errorMessage.split(':')[0] : 'system_error'
        
        logger.error(`Failed to ingest Australia indicator: ${indicator.id}`, { 
          job: jobId, 
          indicatorId: indicator.id, 
          error: errorMessage,
          errorType,
        })
        
        if (dryRun) {
          dryRunResults.push({
            indicatorId: indicator.id,
            source: 'none',
            status: 'error',
          })
        } else {
          ingestErrors.push({ 
            indicatorId: indicator.id, 
            error: errorMessage,
            errorType,
          })
        }
      }
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()

    logger.info('Australia indicators ingestion completed', {
      job: jobId,
      ingested,
      errors,
      duration_ms: durationMs,
      dryRun,
    })

    // Return dry run results if in dry run mode
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        results: dryRunResults,
        summary: {
          total: indicators.length,
          success: dryRunResults.filter(r => r.status === 'success').length,
          errors: dryRunResults.filter(r => r.status === 'error').length,
        },
        duration_ms: durationMs,
      })
    }

    return NextResponse.json({
      success: true,
      ingested,
      errors,
      ingestErrors: ingestErrors.length > 0 ? ingestErrors : undefined,
      duration_ms: durationMs,
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Australia indicators ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage, errorType: 'system_error' },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}
