/**
 * Job: Transform raw series into derived indicators
 * POST /api/jobs/transform/indicators
 * Protected by CRON_TOKEN
 * 
 * Calculates and stores:
 * - gdp_qoq: GDP QoQ Annualized from GDPC1
 * - nfp_delta: NFP Delta (monthly change) from PAYEMS
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { logger } from '@/lib/obs/logger'

/**
 * Calculate GDP QoQ Annualized from GDPC1 series
 * Formula: ((recent/prev)^4 - 1) * 100
 */
function calculateGDPQoQ(observations: Array<{ date: string; value: number }>): {
  current: { value: number; date: string } | null
  previous: { value: number; date: string } | null
} {
  if (observations.length < 2) {
    return { current: null, previous: null }
  }

  // Sort by date ascending
  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date))
  
  // Get last two quarters
  const recent = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]

  if (!recent || !prev || prev.value === 0 || prev.value === null || recent.value === null) {
    return { current: null, previous: null }
  }

  // Calculate QoQ annualized: ((recent/prev)^4 - 1) * 100
  const qoqValue = ((recent.value / prev.value) ** 4 - 1) * 100

  // For previous, calculate from prev and prev-1
  let previousValue: number | null = null
  let previousDate: string | null = null
  
  if (sorted.length >= 3) {
    const prevPrev = sorted[sorted.length - 3]
    if (prevPrev && prevPrev.value !== 0 && prevPrev.value !== null && prev.value !== null) {
      previousValue = ((prev.value / prevPrev.value) ** 4 - 1) * 100
      previousDate = prev.date
    }
  }

  return {
    current: { value: qoqValue, date: recent.date },
    previous: previousValue !== null && previousDate ? { value: previousValue, date: previousDate } : null,
  }
}

/**
 * Calculate NFP Delta (monthly change) from PAYEMS series
 * Formula: current - previous (in thousands)
 */
function calculateNFPDelta(observations: Array<{ date: string; value: number }>): {
  current: { value: number; date: string } | null
  previous: { value: number; date: string } | null
} {
  if (observations.length < 2) {
    return { current: null, previous: null }
  }

  // Sort by date ascending
  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date))
  
  // Get last two months
  const recent = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]

  if (!recent || !prev || prev.value === null || recent.value === null) {
    return { current: null, previous: null }
  }

  // Calculate delta: current - previous (in thousands)
  const deltaValue = recent.value - prev.value

  // For previous, calculate from prev and prev-1
  let previousValue: number | null = null
  let previousDate: string | null = null
  
  if (sorted.length >= 3) {
    const prevPrev = sorted[sorted.length - 3]
    if (prevPrev && prevPrev.value !== null && prev.value !== null) {
      previousValue = prev.value - prevPrev.value
      previousDate = prev.date
    }
  }

  return {
    current: { value: deltaValue, date: recent.date },
    previous: previousValue !== null && previousDate ? { value: previousValue, date: previousDate } : null,
  }
}

/**
 * Upsert indicator history (async version for Turso compatibility)
 */
async function upsertIndicatorHistoryAsync(params: {
  indicatorKey: string
  valueCurrent: number | null
  valuePrevious: number | null
  dateCurrent: string | null
  datePrevious: string | null
}): Promise<void> {
  const db = getUnifiedDB()
  const key = params.indicatorKey.toUpperCase()

  await db.prepare(`
    INSERT INTO indicator_history (indicator_key, value_current, value_previous, date_current, date_previous)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(indicator_key) DO UPDATE SET
      value_current = excluded.value_current,
      value_previous = excluded.value_previous,
      date_current = excluded.date_current,
      date_previous = excluded.date_previous,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    key,
    params.valueCurrent,
    params.valuePrevious,
    params.dateCurrent,
    params.datePrevious
  )
}

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'transform_indicators'
  const startedAt = new Date()

  try {
    logger.info('Starting indicator transformations', { job: jobId })

    const db = getUnifiedDB()
    let transformed = 0
    let errors = 0

    // 1. Transform GDPC1 -> gdp_qoq
    try {
      // Use observation_period if available (real observation date), otherwise use date
      // Filter out invalid dates (GDPC1 is quarterly, so dates should be end-of-quarter: 01-01, 04-01, 07-01, 10-01)
      // Only use observation_period if it's a valid quarterly date, otherwise use date if it's quarterly
      // Group by observation_period to avoid duplicates (same observation_period can have multiple dates)
      const gdpObservations = await db.prepare(`
        SELECT 
          CASE 
            WHEN observation_period IS NOT NULL 
              AND (observation_period LIKE '%-01-01' OR observation_period LIKE '%-04-01' OR observation_period LIKE '%-07-01' OR observation_period LIKE '%-10-01')
            THEN observation_period
            WHEN date LIKE '%-01-01' OR date LIKE '%-04-01' OR date LIKE '%-07-01' OR date LIKE '%-10-01'
            THEN date
            ELSE NULL
          END as obs_date,
          value 
        FROM macro_observations 
        WHERE series_id = ? 
        AND value IS NOT NULL 
        AND (
          (observation_period IS NOT NULL 
            AND (observation_period LIKE '%-01-01' OR observation_period LIKE '%-04-01' OR observation_period LIKE '%-07-01' OR observation_period LIKE '%-10-01'))
          OR (date LIKE '%-01-01' OR date LIKE '%-04-01' OR date LIKE '%-07-01' OR date LIKE '%-10-01')
        )
        GROUP BY obs_date
        HAVING obs_date IS NOT NULL
        ORDER BY obs_date ASC
      `).all('GDPC1') as Array<{ obs_date: string; value: number }>

      if (gdpObservations.length >= 2) {
        // Convert to format expected by calculateGDPQoQ
        const formatted = gdpObservations.map(o => ({ date: o.obs_date, value: o.value }))
        const result = calculateGDPQoQ(formatted)
        
        logger.info('GDP QoQ calculation', {
          job: jobId,
          observationsCount: gdpObservations.length,
          lastTwo: formatted.slice(-2),
          result,
        })
        
        if (result.current) {
          await upsertIndicatorHistoryAsync({
            indicatorKey: 'gdp_qoq',
            valueCurrent: result.current.value,
            valuePrevious: result.previous?.value ?? null,
            dateCurrent: result.current.date,
            datePrevious: result.previous?.date ?? null,
          })
          
          transformed++
          logger.info('Transformed GDP QoQ', {
            job: jobId,
            value: result.current.value,
            date: result.current.date,
            previous: result.previous?.value,
            previousDate: result.previous?.date,
          })
        } else {
          logger.warn('GDP QoQ calculation returned null', { job: jobId, observations: gdpObservations.length })
        }
      } else {
        logger.warn('Insufficient GDPC1 observations for QoQ calculation', { 
          job: jobId, 
          count: gdpObservations.length 
        })
      }
    } catch (error) {
      errors++
      logger.error('Failed to transform GDP QoQ', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // 2. Transform PAYEMS -> nfp_delta (payems_delta)
    try {
      // Use observation_period if available (real observation date), otherwise use date
      // Filter out invalid dates (PAYEMS is monthly, so dates should be first of month: YYYY-MM-01)
      // Only use observation_period if it's a valid monthly date, otherwise use date if it's monthly
      // Group by observation_period to avoid duplicates (same observation_period can have multiple dates)
      const payemsObservations = await db.prepare(`
        SELECT 
          CASE 
            WHEN observation_period IS NOT NULL 
              AND observation_period LIKE '%-%-01'
            THEN observation_period
            WHEN date LIKE '%-%-01'
            THEN date
            ELSE NULL
          END as obs_date,
          value 
        FROM macro_observations 
        WHERE series_id = ? 
        AND value IS NOT NULL 
        AND (
          (observation_period IS NOT NULL AND observation_period LIKE '%-%-01')
          OR date LIKE '%-%-01'
        )
        GROUP BY obs_date
        HAVING obs_date IS NOT NULL
        ORDER BY obs_date ASC
      `).all('PAYEMS') as Array<{ obs_date: string; value: number }>

      if (payemsObservations.length >= 2) {
        // Convert to format expected by calculateNFPDelta
        const formatted = payemsObservations.map(o => ({ date: o.obs_date, value: o.value }))
        const result = calculateNFPDelta(formatted)
        
        logger.info('NFP Delta calculation', {
          job: jobId,
          observationsCount: payemsObservations.length,
          lastTwo: formatted.slice(-2),
          result,
        })
        
        if (result.current) {
          await upsertIndicatorHistoryAsync({
            indicatorKey: 'payems_delta', // Use correct key name
            valueCurrent: result.current.value,
            valuePrevious: result.previous?.value ?? null,
            dateCurrent: result.current.date,
            datePrevious: result.previous?.date ?? null,
          })
          
          transformed++
          logger.info('Transformed NFP Delta', {
            job: jobId,
            value: result.current.value,
            date: result.current.date,
            previous: result.previous?.value,
            previousDate: result.previous?.date,
          })
        } else {
          logger.warn('NFP Delta calculation returned null', { job: jobId, observations: payemsObservations.length })
        }
      } else {
        logger.warn('Insufficient PAYEMS observations for delta calculation', { 
          job: jobId, 
          count: payemsObservations.length 
        })
      }
    } catch (error) {
      errors++
      logger.error('Failed to transform NFP Delta', {
        job: jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const durationMs = Date.now() - startedAt.getTime()

    return NextResponse.json({
      success: true,
      transformed,
      errors,
      duration_ms: durationMs,
      finishedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Indicator transformation job failed', {
      job: jobId,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startedAt.getTime(),
      },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}


