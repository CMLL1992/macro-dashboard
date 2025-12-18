/**
 * Job: Ingest UK economic indicators into SQLite
 * POST /api/jobs/ingest/uk
 * Protected by CRON_TOKEN
 * 
 * Ingests all UK indicators (GBP) used by the dashboard
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { fetchTradingEconomics } from '@/packages/ingestors/tradingeconomics'
import fs from 'node:fs'
import path from 'node:path'

// Load UK indicators config
function loadUKIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'uk-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load uk-indicators.json', { error })
    return { indicators: [] }
  }
}

const UK_INDICATORS = loadUKIndicators()

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_uk'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting UK indicators ingestion', { job: jobId })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ indicatorId?: string; error: string }> = []

    const indicators = UK_INDICATORS.indicators || []
    
    // Rate limiting for Trading Economics
    let lastTradingEconomicsRequest = 0
    const TRADING_ECONOMICS_MIN_DELAY_MS = 2000 // 2 seconds between requests

    for (const indicator of indicators) {
      try {
        let macroSeries: MacroSeries | null = null

        // UK indicators use Trading Economics
        if (indicator.source === 'trading_economics') {
          const apiKey = process.env.TRADING_ECONOMICS_API_KEY
          if (!apiKey) {
            // Debug: Log all env vars that start with TRADING
            const tradingVars = Object.keys(process.env).filter(k => k.includes('TRADING'))
            logger.error(`TRADING_ECONOMICS_API_KEY not configured, skipping ${indicator.id}`, { 
              job: jobId,
              indicatorId: indicator.id,
              envVarsWithTrading: tradingVars,
              nodeEnv: process.env.NODE_ENV,
              vercel: !!process.env.VERCEL,
            })
            ingestErrors.push({ indicatorId: indicator.id, error: 'TRADING_ECONOMICS_API_KEY not configured' })
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
            const observations = await fetchTradingEconomics(indicator.series, apiKey, 'united kingdom')
            
            if (!observations || observations.length === 0) {
              throw new Error('No observations returned from Trading Economics')
            }

            // Convert observations to MacroSeries
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
          } catch (teError) {
            throw new Error(`Trading Economics error: ${teError instanceof Error ? teError.message : String(teError)}`)
          }
        } else {
          throw new Error(`Unsupported source: ${indicator.source}`)
        }

        if (!macroSeries) {
          throw new Error('Failed to fetch macro series')
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
        logger.info(`Ingested UK indicator: ${indicator.id}`, { 
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
        logger.error(`Failed to ingest UK indicator: ${indicator.id}`, { job: jobId, indicatorId: indicator.id, error: errorMessage })
        ingestErrors.push({ indicatorId: indicator.id, error: errorMessage })
      }
    }

    const finishedAt = new Date().toISOString()

    logger.info('UK indicators ingestion completed', {
      job: jobId,
      ingested,
      errors,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })

    return NextResponse.json({
      success: true,
      ingested,
      errors,
      ingestErrors: ingestErrors.length > 0 ? ingestErrors : undefined,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('UK indicators ingestion failed', {
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

