/**
 * Job: Calculate and persist correlations with DXY
 * POST /api/jobs/correlations
 * Protected by CRON_TOKEN
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { upsertCorrelation } from '@/lib/db/upsert'
import { logger } from '@/lib/obs/logger'
import { fetchDXYDaily, fetchAssetDaily, getActiveSymbols } from '@/lib/correlations/fetch'
import { calculateCorrelation } from '@/lib/correlations/calc'
import fs from 'node:fs'
import path from 'node:path'
import { revalidatePath } from 'next/cache'
import { checkCorrelationChanges } from '@/lib/alerts/triggers'

// Load correlation config
function loadCorrelationConfig() {
  try {
    const configPath = path.join(process.cwd(), 'config', 'correlations.config.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {
      windows: {
        w12m: { trading_days: 252, min_obs: 150 },
        w3m: { trading_days: 63, min_obs: 40 },
      },
    }
  }
}

const CORR_CONFIG = loadCorrelationConfig()

export async function POST(request: NextRequest) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const host = request.headers.get('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  if (isLocalhost && (!hasCronToken || !isVercel)) {
    console.log('[correlations/route] Allowing request from localhost without token')
  } else {
    if (!validateCronToken(request)) {
      return unauthorizedResponse()
    }
  }

  const jobId = 'correlations'
  const startedAt = new Date().toISOString()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  try {
    logger.info('Starting correlations calculation', { job: jobId })

    // Fetch DXY data once
    const dxyPrices = await fetchDXYDaily()
    if (dxyPrices.length === 0) {
      throw new Error('Failed to fetch DXY data')
    }

    const activeSymbols = await getActiveSymbols()
    
    // Guardrail: Double-check allowlist (defensive programming)
    const { isAllowedPair } = await import('@/config/tactical-pairs')
    const filteredSymbols = activeSymbols.filter(s => isAllowedPair(s))
    
    if (filteredSymbols.length !== activeSymbols.length) {
      logger.warn('Some symbols from getActiveSymbols() were filtered by allowlist', {
        job: jobId,
        originalCount: activeSymbols.length,
        filteredCount: filteredSymbols.length,
      })
    }
    
    let processed = 0
    let errors = 0
    let noDataCount = 0
    const correlationsForAlerts: Array<{ symbol: string; corr12m: number | null; corr3m: number | null }> = []
    const nullCorrelations: Array<{
      symbol: string
      assetPoints: number
      assetLastDate: string | null
      corr12m_reasonNull?: string
      corr3m_reasonNull?: string
    }> = []

    for (const symbol of filteredSymbols) {
      try {
        // Normalize symbol to uppercase (consistent with DB storage)
        const normalizedSymbol = symbol.toUpperCase()
        
        // Get Yahoo symbol for logging
        const { getYahooSymbol } = await import('@/lib/correlations/fetch')
        const yahooSymbol = await getYahooSymbol(normalizedSymbol)
        
        const assetPrices = await fetchAssetDaily(normalizedSymbol)
        const assetPoints = assetPrices.length
        const dxyPoints = dxyPrices.length
        const assetLastDate = assetPoints > 0 ? assetPrices[assetPoints - 1].date : null
        const dxyLastDate = dxyPoints > 0 ? dxyPrices[dxyPoints - 1].date : null

        if (assetPoints === 0) {
          logger.warn(`No asset data for ${normalizedSymbol}`, {
            job: jobId,
            symbol: normalizedSymbol,
            yahoo_symbol: yahooSymbol || 'NOT_FOUND',
            assetPoints: 0,
            dxyPoints,
            assetLastDate: null,
            dxyLastDate,
            reasonNull: 'NO_DATA',
          })
          noDataCount++
          // Store null correlations if no data
          // Note: base is stored as 'DXY' for backward compatibility, but it's actually DTWEXBGS (FRED)
          await upsertCorrelation({
            symbol: normalizedSymbol,
            base: 'DXY', // Stored as 'DXY' for backward compatibility (actually DTWEXBGS from FRED)
            window: '12m',
            value: null,
            asof: today,
            n_obs: 0,
            last_asset_date: null,
            last_base_date: dxyLastDate,
          })
          await upsertCorrelation({
            symbol: normalizedSymbol,
            base: 'DXY', // Stored as 'DXY' for backward compatibility (actually DTWEXBGS from FRED)
            window: '3m',
            value: null,
            asof: today,
            n_obs: 0,
            last_asset_date: null,
            last_base_date: dxyLastDate,
          })
          nullCorrelations.push({
            symbol: normalizedSymbol,
            assetPoints: 0,
            assetLastDate: null,
            corr12m_reasonNull: 'NO_DATA',
            corr3m_reasonNull: 'NO_DATA',
          })
          continue
        }

        // Calculate 12m correlation
        const w12m = CORR_CONFIG.windows.w12m
        const corr12m = calculateCorrelation(assetPrices, dxyPrices, w12m.trading_days, w12m.min_obs)
        
        // Calculate 3m correlation
        const w3m = CORR_CONFIG.windows.w3m
        const corr3m = calculateCorrelation(assetPrices, dxyPrices, w3m.trading_days, w3m.min_obs)

        // Log diagnostic info for each symbol
        logger.info(`Correlation calculation for ${normalizedSymbol}`, {
          job: jobId,
          symbol: normalizedSymbol,
          yahoo_symbol: yahooSymbol || 'NOT_FOUND',
          assetPoints,
          dxyPoints,
          assetLastDate,
          dxyLastDate,
          corr12m: corr12m.correlation,
          corr12m_n_obs: corr12m.n_obs,
          corr12m_reasonNull: corr12m.reasonNull,
          corr12m_diagnostic: corr12m.diagnostic,
          corr3m: corr3m.correlation,
          corr3m_n_obs: corr3m.n_obs,
          corr3m_reasonNull: corr3m.reasonNull,
          corr3m_diagnostic: corr3m.diagnostic,
        })

        // Note: base is stored as 'DXY' for backward compatibility, but it's actually DTWEXBGS (FRED)
        await upsertCorrelation({
          symbol: normalizedSymbol,
          base: 'DXY', // Stored as 'DXY' for backward compatibility (actually DTWEXBGS from FRED)
          window: '12m',
          value: corr12m.correlation,
          asof: today,
          n_obs: corr12m.n_obs,
          last_asset_date: corr12m.last_asset_date,
          last_base_date: corr12m.last_base_date,
        })

        await upsertCorrelation({
          symbol: normalizedSymbol,
          base: 'DXY', // Stored as 'DXY' for backward compatibility (actually DTWEXBGS from FRED)
          window: '3m',
          value: corr3m.correlation,
          asof: today,
          n_obs: corr3m.n_obs,
          last_asset_date: corr3m.last_asset_date,
          last_base_date: corr3m.last_base_date,
        })

        // Track null correlations for reporting
        if (corr12m.correlation === null || corr3m.correlation === null) {
          nullCorrelations.push({
            symbol: normalizedSymbol,
            assetPoints,
            assetLastDate,
            corr12m_reasonNull: corr12m.reasonNull,
            corr3m_reasonNull: corr3m.reasonNull,
          })
        }

        processed++
        
        // Collect for alerts
        correlationsForAlerts.push({
          symbol: normalizedSymbol,
          corr12m: corr12m.correlation,
          corr3m: corr3m.correlation,
        })
      } catch (error) {
        errors++
        logger.error(`Failed to calculate correlations for ${symbol}`, {
          job: jobId,
          symbol,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }

    const finishedAt = new Date().toISOString()
    const durationMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    
    logger.info('Correlations calculation completed', {
      job: jobId,
      processed,
      errors,
      noDataCount,
      nullCorrelationsCount: nullCorrelations.length,
      duration_ms: durationMs,
    })

    // Log null correlations for debugging
    if (nullCorrelations.length > 0) {
      logger.info('Null correlations summary', {
        job: jobId,
        nullCorrelations: nullCorrelations.map(n => ({
          symbol: n.symbol,
          assetPoints: n.assetPoints,
          assetLastDate: n.assetLastDate,
          corr12m_reasonNull: n.corr12m_reasonNull,
          corr3m_reasonNull: n.corr3m_reasonNull,
        })),
      })
    }

    // Check correlation threshold crosses (Trigger B)
    try {
      await checkCorrelationChanges(correlationsForAlerts)
      logger.info('Correlation change check completed', { job: jobId, count: correlationsForAlerts.length })
    } catch (error) {
      logger.error('Failed to check correlation change alerts', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Revalidate dashboard
    try { revalidatePath('/') } catch {}

    return NextResponse.json({
      success: true,
      processed,
      errors,
      noDataCount,
      nullCorrelationsCount: nullCorrelations.length,
      duration_ms: durationMs,
      nullCorrelations: nullCorrelations.length > 0 ? nullCorrelations.map(n => ({
        symbol: n.symbol,
        assetPoints: n.assetPoints,
        assetLastDate: n.assetLastDate,
        corr12m_reasonNull: n.corr12m_reasonNull,
        corr3m_reasonNull: n.corr3m_reasonNull,
      })) : undefined,
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Correlations job failed', {
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

