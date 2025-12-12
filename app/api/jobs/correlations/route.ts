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
    let processed = 0
    let errors = 0
    const correlationsForAlerts: Array<{ symbol: string; corr12m: number | null; corr3m: number | null }> = []

    for (const symbol of activeSymbols) {
      try {
        // Normalize symbol to uppercase (consistent with DB storage)
        const normalizedSymbol = symbol.toUpperCase()
        
        const assetPrices = await fetchAssetDaily(normalizedSymbol)
        if (assetPrices.length === 0) {
          logger.warn(`No asset data for ${normalizedSymbol}, skipping correlation calculation`, { job: jobId, symbol: normalizedSymbol })
          errors++
          // Store null correlations if no data
          await upsertCorrelation({
            symbol: normalizedSymbol,
            base: 'DXY',
            window: '12m',
            value: null,
            asof: today,
            n_obs: 0,
            last_asset_date: null,
            last_base_date: dxyPrices.length > 0 ? dxyPrices[dxyPrices.length - 1].date : null,
          })
          await upsertCorrelation({
            symbol: normalizedSymbol,
            base: 'DXY',
            window: '3m',
            value: null,
            asof: today,
            n_obs: 0,
            last_asset_date: null,
            last_base_date: dxyPrices.length > 0 ? dxyPrices[dxyPrices.length - 1].date : null,
          })
          continue
        }

        // Calculate 12m correlation
        const w12m = CORR_CONFIG.windows.w12m
        const corr12m = calculateCorrelation(assetPrices, dxyPrices, w12m.trading_days, w12m.min_obs)
        await upsertCorrelation({
          symbol: normalizedSymbol,
          base: 'DXY',
          window: '12m',
          value: corr12m.correlation,
          asof: today,
          n_obs: corr12m.n_obs,
          last_asset_date: corr12m.last_asset_date,
          last_base_date: corr12m.last_base_date,
        })

        // Calculate 3m correlation
        const w3m = CORR_CONFIG.windows.w3m
        const corr3m = calculateCorrelation(assetPrices, dxyPrices, w3m.trading_days, w3m.min_obs)
        await upsertCorrelation({
          symbol: normalizedSymbol,
          base: 'DXY',
          window: '3m',
          value: corr3m.correlation,
          asof: today,
          n_obs: corr3m.n_obs,
          last_asset_date: corr3m.last_asset_date,
          last_base_date: corr3m.last_base_date,
        })

        processed++
        
        // Collect for alerts
        correlationsForAlerts.push({
          symbol: normalizedSymbol,
          corr12m: corr12m.correlation,
          corr3m: corr3m.correlation,
        })
        
        logger.info(`Correlations calculated for ${normalizedSymbol}`, {
          job: jobId,
          symbol: normalizedSymbol,
          corr12m: corr12m.correlation,
          n_obs12m: corr12m.n_obs,
          corr3m: corr3m.correlation,
          n_obs3m: corr3m.n_obs,
        })
      } catch (error) {
        errors++
        logger.error(`Failed to calculate correlations for ${symbol}`, {
          job: jobId,
          symbol,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const finishedAt = new Date().toISOString()
    logger.info('Correlations calculation completed', {
      job: jobId,
      processed,
      errors,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })

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
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
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

