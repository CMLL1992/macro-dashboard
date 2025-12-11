/**
 * Job: Ingest European economic indicators into SQLite
 * POST /api/jobs/ingest/european
 * Protected by CRON_TOKEN
 * 
 * Ingests all European indicators (Eurozone) used by the dashboard
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { upsertMacroSeries } from '@/lib/db/upsert'
import type { MacroSeries } from '@/lib/types/macro'
import { fetchECBSeries, fetchECBSimpleSeries } from '@/lib/datasources/ecb'
import { fetchDBnomicsSeries } from '@/lib/datasources/dbnomics'
import { fetchTradingEconomics } from '@/packages/ingestors/tradingeconomics'
import { fetchFredSeries } from '@/lib/fred'
import { fetchEcondifySeries } from '@/lib/datasources/econdify'
import fs from 'node:fs'
import path from 'node:path'

// Load European indicators config
function loadEuropeanIndicators() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'european-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    logger.error('Failed to load european-indicators.json', { error })
    return { indicators: [] }
  }
}

const EUROPEAN_INDICATORS = loadEuropeanIndicators()

export async function POST(request: NextRequest) {
  // Debug: Log request details
  const host = request.headers.get('host') || ''
  const crontoken = process.env.CRON_TOKEN || ''
  const vercel = process.env.VERCEL || ''
  console.log('[european-job] Request received:', { host, hasCronToken: !!crontoken, isVercel: !!vercel })
  
  const isValid = validateCronToken(request)
  console.log('[european-job] Token validation result:', isValid)
  
  if (!isValid) {
    return unauthorizedResponse()
  }

  const jobId = 'ingest_european'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting European indicators ingestion', { job: jobId })

    let ingested = 0
    let errors = 0
    const ingestErrors: Array<{ indicatorId?: string; error: string }> = []

    const indicators = EUROPEAN_INDICATORS.indicators || []
    
    // Rate limiting for Trading Economics (max 1 request per second, but be more conservative)
    let lastTradingEconomicsRequest = 0
    const TRADING_ECONOMICS_MIN_DELAY_MS = 2000 // 2 seconds between requests to avoid 409 conflicts

    for (const indicator of indicators) {
      try {
        let macroSeries: MacroSeries | null = null

        // Fetch based on source
        if (indicator.source === 'ecb') {
          macroSeries = await fetchECBSeries({
            flow: indicator.flow,
            key: indicator.key,
            freq: indicator.frequency as any,
          })
        } else if (indicator.source === 'ecb_sdw') {
          const code = (indicator as any).code
          if (!code) {
            throw new Error(`ECB SDW code is required for ${indicator.id}`)
          }
          macroSeries = await fetchECBSimpleSeries(code, 100) // Fetch last 100 observations for historical data
          // Override ID and name to match indicator configuration
          if (macroSeries) {
            macroSeries.id = indicator.id
            macroSeries.name = indicator.name
            macroSeries.frequency = indicator.frequency as any
          }
        } else if (indicator.source === 'fred') {
          const seriesId = (indicator as any).series_id
          if (!seriesId) {
            throw new Error(`FRED series_id is required for ${indicator.id}`)
          }
          
          // For Eurostat series (EA19*), they are already YoY, so don't apply transformation
          // Check if series ID starts with EA19 (Eurostat series) - these are already YoY
          const isEurostatYoY = seriesId.startsWith('EA19') && (indicator.id.includes('_YOY') || indicator.name.toLowerCase().includes('yoy'))
          
          // Determine if we need YoY transformation
          // For Eurostat YoY series, they're already YoY, so use units=lin (no transformation)
          // For other series that need YoY, use units=pc1 (percent change from year ago)
          const needsYoY = !isEurostatYoY && (indicator.id.includes('_YOY') || indicator.name.toLowerCase().includes('yoy'))
          const units = needsYoY ? 'pc1' : 'lin' // Use lin for Eurostat YoY series (already YoY)
          
          // Fetch from FRED
          // Note: Some FRED series don't support frequency parameter, so we omit it
          const observations = await fetchFredSeries(seriesId, {
            observation_start: '2010-01-01',
            observation_end: new Date().toISOString().slice(0, 10),
            units: units, // Use lin for Eurostat YoY (already YoY), pc1 for others
            // Don't set frequency - let FRED use the series' native frequency
          })
          
          if (observations.length === 0) {
            throw new Error('No observations returned from FRED')
          }
          
          // Convert to MacroSeries format
          macroSeries = {
            id: indicator.id,
            source: 'FRED',
            indicator: seriesId,
            nativeId: seriesId,
            name: indicator.name,
            frequency: indicator.frequency as any,
            data: observations.map(obs => ({
              date: obs.date,
              value: obs.value,
            })),
            lastUpdated: observations[observations.length - 1]?.date,
            meta: {
              series_id: seriesId,
            },
          }
        } else if (indicator.source === 'econdify') {
          const country = (indicator as any).country
          const indicatorName = (indicator as any).indicator
          if (!country || !indicatorName) {
            throw new Error(`Econdify country and indicator are required for ${indicator.id}`)
          }
          
          macroSeries = await fetchEcondifySeries({
            country,
            indicator: indicatorName,
          })
          
          // Override ID to match indicator.id
          if (macroSeries) {
            macroSeries.id = indicator.id
            macroSeries.name = indicator.name
          }
        } else if (indicator.source === 'dbnomics') {
          macroSeries = await fetchDBnomicsSeries({
            provider: indicator.provider,
            dataset: indicator.dataset,
            series: indicator.series,
          })
        } else if (indicator.source === 'trading_economics') {
          const apiKey = process.env.TRADING_ECONOMICS_API_KEY
          if (!apiKey) {
            logger.warn(`TRADING_ECONOMICS_API_KEY not configured, skipping ${indicator.id}`, { job: jobId })
            errors++
            ingestErrors.push({ indicatorId: indicator.id, error: 'TRADING_ECONOMICS_API_KEY not configured' })
            continue
          }
          
          // Rate limiting: wait if last request was less than 1.2 seconds ago
          const now = Date.now()
          const timeSinceLastRequest = now - lastTradingEconomicsRequest
          if (timeSinceLastRequest < TRADING_ECONOMICS_MIN_DELAY_MS) {
            const waitTime = TRADING_ECONOMICS_MIN_DELAY_MS - timeSinceLastRequest
            logger.info(`Rate limiting Trading Economics: waiting ${waitTime}ms`, { job: jobId, indicatorId: indicator.id })
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
          
          try {
            // Trading Economics returns observations, need to convert to MacroSeries
            // Para indicadores europeos, usar "euro area" como país
            // Detectar si es indicador de Eurozona por el ID o el nombre
            const isEurozoneIndicator = indicator.id.startsWith('EU_') || 
                                       indicator.series.includes('eurozone') || 
                                       indicator.series.includes('euro-area') ||
                                       indicator.name.toLowerCase().includes('eurozona') ||
                                       indicator.name.toLowerCase().includes('euro area')
            const country = isEurozoneIndicator ? 'euro area' : undefined
            lastTradingEconomicsRequest = Date.now()
            const observations = await fetchTradingEconomics(indicator.series, apiKey, country)
            
            if (observations.length === 0) {
              throw new Error('No observations returned from Trading Economics')
            }

            // Convert observations to MacroSeries format
            macroSeries = {
              id: indicator.id,
              source: 'TRADING_ECONOMICS',
              indicator: indicator.series,
              nativeId: indicator.series,
              name: indicator.name,
              frequency: indicator.frequency as any,
              data: observations.map(obs => ({
                date: obs.date,
                value: obs.value,
              })),
              lastUpdated: observations[observations.length - 1]?.date,
            }
          } catch (teError: any) {
            // Manejar error 403 (plan gratuito sin acceso a Euro Area) como advertencia, no error crítico
            const statusCode = teError?.statusCode || (teError?.message?.includes('403') ? 403 : null)
            if (statusCode === 403 || teError?.message?.includes('403') || teError?.message?.includes('No Access to this country')) {
              logger.warn(`Trading Economics 403: Euro Area data requires paid plan for ${indicator.id}`, { 
                job: jobId, 
                indicatorId: indicator.id,
                message: 'Source not available (requires Trading Economics paid plan for Euro Area access)'
              })
              // No incrementar errors, solo registrar como advertencia
              ingestErrors.push({ 
                indicatorId: indicator.id, 
                error: 'Source not available (Trading Economics paid plan required for Euro Area data)' 
              })
              continue // Continuar con el siguiente indicador sin marcar como error crítico
            }
            
            // Para otros errores, mantener el comportamiento original
            let errorMessage = `Trading Economics error: ${teError instanceof Error ? teError.message : String(teError)}`
            
            // Si es un TradingEconomicsError tipado, incluir más detalles
            if (teError && typeof teError === 'object' && 'type' in teError) {
              const teTypedError = teError as any
              errorMessage = 
                `Trading Economics ${teTypedError.type || 'UNKNOWN'} error: ` +
                `HTTP ${teTypedError.statusCode || 'N/A'} - ${teTypedError.message || 'Unknown error'}. ` +
                `Endpoint: ${teTypedError.endpoint || indicator.series}, ` +
                `Symbol: ${teTypedError.symbol || 'N/A'}, ` +
                `Date range: ${teTypedError.dateRange || 'N/A'}. ` +
                `Response: ${teTypedError.responseBody?.substring(0, 200) || 'N/A'}`
              
              // Log detallado para debugging
              logger.error(`Trading Economics error for ${indicator.id}`, {
                job: jobId,
                indicatorId: indicator.id,
                errorType: teTypedError.type,
                statusCode: teTypedError.statusCode,
                endpoint: teTypedError.endpoint,
                symbol: teTypedError.symbol,
                dateRange: teTypedError.dateRange,
                responseBody: teTypedError.responseBody?.substring(0, 500),
              })
            }
            
            throw new Error(errorMessage)
          }
        } else {
          throw new Error(`Unknown source: ${indicator.source}`)
        }

        if (!macroSeries || macroSeries.data.length === 0) {
          logger.warn(`No observations for ${indicator.id} from ${indicator.source}`, { job: jobId })
          errors++
          ingestErrors.push({ indicatorId: indicator.id, error: 'No data returned from source' })
          continue
        }

        // Ensure series metadata is set correctly
        macroSeries.id = indicator.id
        macroSeries.name = indicator.name
        macroSeries.frequency = indicator.frequency as any

        // Get last date in DB for this series
        let lastDateInDb: string | null = null
        try {
          if (isUsingTurso()) {
            const db = getUnifiedDB()
            const result = await db.prepare(
              `SELECT MAX(date) as max_date FROM macro_observations WHERE series_id = ?`
            ).get(indicator.id) as { max_date: string | null } | null
            lastDateInDb = result?.max_date || null
          } else {
            // All methods are async now, so always use await
            const db = getUnifiedDB()
            const result = await db.prepare(
              `SELECT MAX(date) as max_date FROM macro_observations WHERE series_id = ?`
            ).get(indicator.id) as { max_date: string | null } | undefined
            lastDateInDb = result?.max_date || null
          }
        } catch (err) {
          logger.warn(`Could not get last date for ${indicator.id}`, { error: String(err) })
        }

        // TEMPORAL: Forzar re-ingesta completa para EU_RETAIL_SALES_YOY y EU_INDUSTRIAL_PRODUCTION_YOY
        // después de cambiar de TradingEconomics a FRED
        const forceReingest = indicator.id === 'EU_RETAIL_SALES_YOY' || indicator.id === 'EU_INDUSTRIAL_PRODUCTION_YOY'
        
        const newPoints = (forceReingest || !lastDateInDb)
          ? macroSeries.data  // Forzar re-ingesta completa para estos indicadores
          : macroSeries.data.filter((p) => p.date > lastDateInDb!)

        if (newPoints.length === 0) {
          logger.info(`No new points for ${indicator.id}`, { job: jobId, lastDateInDb })
          continue
        }

        // Upsert series metadata and observations
        await upsertMacroSeries(macroSeries)

        ingested++
        logger.info(`Ingested ${indicator.id}`, {
          job: jobId,
          indicator: indicator.id,
          totalPoints: macroSeries.data.length,
          newPoints: newPoints.length,
          lastDate: newPoints[newPoints.length - 1]?.date,
        })
      } catch (error) {
        errors++
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to ingest ${indicator.id}`, {
          job: jobId,
          indicator: indicator.id,
          error: errorMessage,
        })
        ingestErrors.push({ indicatorId: indicator.id, error: errorMessage })
      }
    }

    const finishedAt = new Date().toISOString()
    logger.info('European indicators ingestion completed', {
      job: jobId,
      ingested,
      errors,
      duration: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })

    return NextResponse.json({
      success: true,
      job: jobId,
      startedAt,
      finishedAt,
      ingested,
      errors,
      ingestErrors: ingestErrors.slice(0, 10), // Limit to first 10 errors
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('European indicators ingestion failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      {
        success: false,
        job: jobId,
        error: errorMessage,
        startedAt,
        finishedAt: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}
