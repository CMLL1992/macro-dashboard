/**
 * Optimized overview endpoint
 * Returns all data needed for Macro Overview dashboard in a single request
 * 
 * Performance optimizations:
 * - Only reads snapshots (indicator_history), not historical series
 * - Batched queries (1-3 queries max)
 * - Cached with s-maxage=60, stale-while-revalidate=300
 * - Logs performance metrics for diagnosis
 */

import { NextRequest, NextResponse } from 'next/server'
// OPTIMIZATION: Imports mínimos en el path crítico
// Usar dynamic imports para módulos pesados que no se usan en cada request
import { logger } from '@/lib/obs/logger'
import { generateRequestId } from '@/lib/obs/request-id'
import { measureAsync } from '@/lib/utils/performance-logger'
import type { TimeHorizon, ProcessedIndicator } from '@/lib/dashboard-time-horizon'
import { safeArray, isRecord } from '@/lib/utils/guards'
import { buildCurrencyScoreboard } from '@/lib/utils/currency-scoreboard'
import coreIndicatorsConfig from '@/config/core-indicators.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// CRITICAL: No warmup at module load - this causes slow startup
// Modules will be loaded on-demand when the endpoint is called

interface OverviewResponse {
  regimeGlobal: {
    risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
    usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
    growthTrend: 'acelerando' | 'desacelerando' | 'estable'
    inflationTrend: 'acelerando' | 'desacelerando' | 'estable'
    confidence: 'Alta' | 'Media' | 'Baja'
    confidenceExplanation: string
    topDrivers: Array<{ key: string; label: string; reason: string }>
  }
  currencyScoreboard: Array<{
    currency: string
    score: number // -3..+3
    status: 'Fuerte' | 'Neutro' | 'Débil'
  }>
  // Campo opcional de debug: solo se rellena cuando DEBUG_DASHBOARD=true
  currencyScoreboardDebug?: Array<{
    currency: string
    regime?: string
    probability?: number
    coverage?: number
    presentKeys?: string[]
    score: number
    status: 'Fuerte' | 'Neutro' | 'Débil'
  }>
  coreIndicators: Array<{
    key: string
    label: string
    category: 'Crecimiento' | 'Empleo' | 'Inflación' | 'Tipos/Condiciones'
    value: number | null
    previous: number | null
    date: string | null
    date_previous?: string | null
    trend: 'acelera' | 'desacelera' | 'estable'
    importance: 'Alta' | 'Media' | 'Baja'
    unit?: string
    change?: number | null
    surprise?: number | null
    weeklyMomentum?: number | null
    hasNewPublication?: boolean
    monthlyTrend?: 'acelerando' | 'desacelerando' | 'estable'
  }>
  countryCoverage?: Array<{
    country: string
    currency: string
    flag: string
    availableCount: number
    totalCount: number
    coveragePct: number
    status: 'OK' | 'PARTIAL' | 'LOW'
    staleCount?: number
  }>
  performance: {
    totalMs: number
    queriesMs: number
    processingMs: number
    cacheHit?: boolean
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  
  // Get time horizon from query param (d|w|m)
  const { searchParams } = new URL(request.url)
  const tfParam = searchParams.get('tf') || 'd'
  const horizon: TimeHorizon = tfParam === 'w' ? 'weekly' : tfParam === 'm' ? 'monthly' : 'daily'
  
  try {
    // Measure TTFB (Time To First Byte) - time until first data fetch completes
    const ttfbStart = Date.now()
    
    // PROTOCOL: Track fallback count from getAllLatestFromDBWithPrev
    // This will be logged separately, but we capture it here for the report
    let fallbackCount = 0
    
    // OPTIMIZATION: Imports estáticos para módulos core (siempre se usan)
    // Esto mejora la primera request porque los módulos ya están en memoria
    // Tradeoff: aumenta ligeramente el arranque del servidor, pero mejora primera request
    const { getDashboardData } = await import('@/lib/dashboard-data')
    const { getBiasState } = await import('@/domain/macro-engine/bias')
    
    // Fetch dashboard data (this should only read snapshots, not historical series)
    const [dashboardData, biasState] = await Promise.all([
      measureAsync('overview.getDashboardData', () => getDashboardData(), requestId),
      measureAsync('overview.getBiasState', () => getBiasState(), requestId),
    ])
    
    const queriesDuration = Date.now() - startTime
    const ttfbDuration = Date.now() - ttfbStart
    
    // Note: fallbackCount is logged in getAllLatestFromDBWithPrev
    // We set it to 0 here as a placeholder (actual count comes from logs)
    // In production, you could extract it from dashboardData if available
    
    // Validate dashboardData structure
    if (!dashboardData) {
      throw new Error('dashboardData is null or undefined')
    }
    if (!dashboardData.regime) {
      throw new Error('dashboardData.regime is missing')
    }
    if (!Array.isArray(dashboardData.indicators)) {
      throw new Error(`dashboardData.indicators is not an array: ${typeof dashboardData.indicators}`)
    }
    if (!biasState) {
      throw new Error('biasState is null or undefined')
    }
    
    // OPTIMIZATION: Import estático para dashboard-time-horizon (siempre se usa)
    // Esto mejora la primera request porque el módulo ya está en memoria
    const { processIndicatorsByHorizon, getTopDrivers, calculateRegimeConfidence } = await import('@/lib/dashboard-time-horizon')
    
    // Process indicators by horizon
    const processingStart = Date.now()
    // Guard: asegurar siempre un array de indicadores procesados y tipados
    const processedIndicators = safeArray<ProcessedIndicator>(
      processIndicatorsByHorizon(dashboardData.indicators, horizon)
    )
    
    // FIX 1: Instrumentación para verificar prev/curr en una pequeña muestra
    const sampleIndicators = processedIndicators
      .filter(
        (ind) =>
          ind.value !== null &&
          ind.previous !== null
      )
      .slice(0, 5)
    
    for (const ind of sampleIndicators) {
      const currentDate = ind.date
      const previousDate = (ind as any).date_previous || null
      const currentValue = ind.value
      const previousValue = ind.previous
      
      // Guard: verificar si previous === current (bug)
      if (previousDate === currentDate || previousValue === currentValue) {
        logger.warn('overview.prev_equals_curr', {
          requestId,
          indicator_key: ind.key,
          currentDate,
          currentValue,
          previousDate,
          previousValue,
          hasHistorical: previousDate !== null && previousValue !== null,
        })
      } else {
        // Log normal para verificación
        logger.info('overview.prev_curr_check', {
          requestId,
          indicator_key: ind.key,
          currentDate,
          currentValue,
          previousDate,
          previousValue,
        })
      }
    }
    
    // Build core indicators (single source of truth: config/core-indicators.json)
    // Soporta tanto coreKeys[] como indicators[].key (el JSON tiene indicators con key)
    const rawCoreKeys = Array.isArray((coreIndicatorsConfig as any)?.coreKeys)
      ? ((coreIndicatorsConfig as any).coreKeys as string[])
      : Array.isArray((coreIndicatorsConfig as any)?.indicators)
        ? ((coreIndicatorsConfig as any).indicators as Array<{ key?: string }>).map((i) => i?.key)
        : []
    const coreKeys = rawCoreKeys.map((k) => String(k || '').trim()).filter(Boolean)
    const expectedMissing = new Set(
      Array.isArray((coreIndicatorsConfig as any)?.expectedMissing)
        ? ((coreIndicatorsConfig as any).expectedMissing as string[]).map((k) => String(k || '').trim()).filter(Boolean)
        : [],
    )

    const coreIndicators = coreKeys.map((coreKey) => {
      const ind = processedIndicators.find((p) => {
        const k = String((p as any)?.originalKey || (p as any)?.key || '').trim()
        return k === coreKey || String((p as any)?.key || '').trim() === coreKey
      })

      // Gate “no mentir”: si está en expectedMissing, NO exponemos valores viejos (forzamos null)
      if (expectedMissing.has(coreKey)) {
        return {
          key: coreKey,
          label: ind?.label || coreKey || 'Indicador',
          category: 'Inflación' as const,
          value: null,
          previous: null,
          date: null,
          date_previous: null,
          trend: 'estable' as const,
          importance: 'Media' as const,
          unit: ind?.unit || undefined,
          change: null,
          surprise: null,
          weeklyMomentum: null,
          hasNewPublication: false,
          monthlyTrend: undefined,
        }
      }

      // Si no tenemos el indicador, devolvemos stub nulo (evita que “desaparezca”)
      if (!ind) {
        return {
          key: coreKey,
          label: coreKey || 'Indicador',
          category: 'Crecimiento' as const,
          value: null,
          previous: null,
          date: null,
          date_previous: null,
          trend: 'estable' as const,
          importance: 'Baja' as const,
          unit: undefined,
          change: null,
          surprise: null,
          weeklyMomentum: null,
          hasNewPublication: false,
          monthlyTrend: undefined,
        }
      }

      const baseKey = (ind.originalKey || ind.key || '').toString()
      const keyUpper = baseKey.toUpperCase()

      // Determine category
      let category: 'Crecimiento' | 'Empleo' | 'Inflación' | 'Tipos/Condiciones' = 'Crecimiento'
      if (
        keyUpper.includes('PAYEMS') ||
        keyUpper.includes('NFP') ||
        keyUpper.includes('UNRATE') ||
        keyUpper.includes('JOLTS') ||
        keyUpper.includes('CLAIMS') ||
        keyUpper.includes('CIVPART') ||
        keyUpper.includes('PARTICIPATION') ||
        keyUpper.includes('AHETPI') ||
        keyUpper.includes('EARNINGS')
      ) {
        category = 'Empleo'
      } else if (
        keyUpper.includes('CPI') ||
        keyUpper.includes('PCE') ||
        keyUpper.includes('PPI') ||
        keyUpper.includes('ECICOST') ||
        keyUpper.includes('ULCTOT') ||
        keyUpper.includes('LABOR_COST') ||
        keyUpper.includes('INFLATION_EXPECTATIONS') ||
        keyUpper.includes('T5YIFR') ||
        keyUpper.includes('T10YIE') ||
        keyUpper.includes('MICH') ||
        keyUpper.includes('BREAKEVEN')
      ) {
        category = 'Inflación'
      } else if (
        keyUpper.includes('FEDFUNDS') ||
        keyUpper.includes('T10Y') ||
        keyUpper.includes('RATE') ||
        keyUpper.includes('ECB_RATE') ||
        keyUpper.includes('BOE_RATE') ||
        keyUpper.includes('BOJ_RATE') ||
        keyUpper.includes('SPREAD') ||
        keyUpper.includes('SOFR') ||
        keyUpper.includes('ESTR') ||
        keyUpper.includes('YIELD') ||
        keyUpper.includes('CURVE')
      ) {
        category = 'Tipos/Condiciones'
      }

      // Determine trend
      let trend: 'acelera' | 'desacelera' | 'estable' = 'estable'
      if (horizon === 'monthly' && ind.monthlyTrend) {
        if (ind.monthlyTrend === 'acelerando') trend = 'acelera'
        else if (ind.monthlyTrend === 'desacelerando') trend = 'desacelera'
        else trend = 'estable'
      } else if (ind.trend === 'Mejora') {
        trend = 'acelera'
      } else if (ind.trend === 'Empeora') {
        trend = 'desacelera'
      }

      // Determine importance (solo desde el peso estructural)
      let importance: 'Alta' | 'Media' | 'Baja' = 'Baja'
      const weight = ind.weight || 0
      if (weight >= 0.08) importance = 'Alta'
      else if (weight >= 0.04) importance = 'Media'

      return {
        key: coreKey,
        label: ind.label || coreKey || 'Indicador',
        category,
        value: ind.value ?? null,
        previous: ind.previous ?? null,
        date: ind.date ?? null,
        date_previous: ("date_previous" in ind ? (ind as any).date_previous : null),
        trend,
        importance,
        unit: ind.unit || undefined,
        change: ind.change ?? null,
        surprise: ind.surprise ?? null,
        weeklyMomentum: ind.weeklyMomentum ?? null,
        hasNewPublication: ind.hasNewPublication ?? false,
        monthlyTrend: ind.monthlyTrend ?? undefined,
      }
    }) as OverviewResponse['coreIndicators']
    
    // Calculate growth and inflation trends
    const growthIndicators = processedIndicators.filter(i => {
      const key = (i.originalKey || i.key).toUpperCase()
      return key.includes('GDP') || key.includes('PMI') || key.includes('RETAIL') || 
             key.includes('INDPRO') || key.includes('CONFIDENCE')
    })
    const inflationIndicators = processedIndicators.filter(i => {
      const key = (i.originalKey || i.key).toUpperCase()
      return key.includes('CPI') || key.includes('PCE') || key.includes('PPI')
    })
    
    let growthTrend: 'acelerando' | 'desacelerando' | 'estable' = 'estable'
    let inflationTrend: 'acelerando' | 'desacelerando' | 'estable' = 'estable'
    
    if (horizon === 'monthly') {
      const accelerating = growthIndicators.filter(i => i.monthlyTrend === 'acelerando').length
      const decelerating = growthIndicators.filter(i => i.monthlyTrend === 'desacelerando').length
      growthTrend = accelerating > decelerating ? 'acelerando' : decelerating > accelerating ? 'desacelerando' : 'estable'
      
      const infAccelerating = inflationIndicators.filter(i => i.monthlyTrend === 'acelerando').length
      const infDecelerating = inflationIndicators.filter(i => i.monthlyTrend === 'desacelerando').length
      inflationTrend = infAccelerating > infDecelerating ? 'acelerando' : infDecelerating > infAccelerating ? 'desacelerando' : 'estable'
    } else {
      const accelerating = growthIndicators.filter(i => i.trend === 'Mejora').length
      const decelerating = growthIndicators.filter(i => i.trend === 'Empeora').length
      growthTrend = accelerating > decelerating ? 'acelerando' : decelerating > accelerating ? 'desacelerando' : 'estable'
      
      const infAccelerating = inflationIndicators.filter(i => i.trend === 'Mejora').length
      const infDecelerating = inflationIndicators.filter(i => i.trend === 'Empeora').length
      inflationTrend = infAccelerating > infDecelerating ? 'acelerando' : infDecelerating > infAccelerating ? 'desacelerando' : 'estable'
    }
    
    // Get top drivers and confidence
    const topDrivers = getTopDrivers(processedIndicators, horizon)
    const confidenceData = calculateRegimeConfidence(processedIndicators, horizon)
    
    // FIX: Validar y normalizar currencyRegimes antes de construir el scoreboard
    const currencyRegimes = isRecord(biasState?.currencyRegimes) ? (biasState.currencyRegimes as any) : {}
    const currencyScoreboard = buildCurrencyScoreboard(currencyRegimes)
    
    const processingDuration = Date.now() - processingStart
    const totalDuration = Date.now() - startTime
    
    // Mapear usd_direction del backend (puede venir como 'Bullish'/'Bearish') a lenguaje macro
    const rawUsdDirection = dashboardData.regime?.usd_direction || 'Neutral'
    const usdDirection: 'Fuerte' | 'Débil' | 'Neutral' = 
      rawUsdDirection === 'Bullish' || rawUsdDirection === 'Fuerte' ? 'Fuerte' :
      rawUsdDirection === 'Bearish' || rawUsdDirection === 'Débil' ? 'Débil' :
      'Neutral'
    
    // Calculate country coverage
    const { calculateCoverageByCountry } = await import('@/lib/utils/coverage-by-country')
    const countryCoverage = calculateCoverageByCountry(processedIndicators)
    
    // DEBUG: Instrumentación para currencyRegimes / scoreboard (solo dev / DEBUG)
    const debugEnabled =
      process.env.DEBUG_DASHBOARD === 'true' || process.env.NODE_ENV === 'development'

    if (debugEnabled) {
      console.log('[overview.currencyRegimes.check]', {
        hasBiasState: !!biasState,
        hasCurrencyRegimes: !!(biasState as any)?.currencyRegimes,
        type: typeof (biasState as any)?.currencyRegimes,
        keys: (biasState as any)?.currencyRegimes
          ? Object.keys((biasState as any).currencyRegimes)
          : [],
      })
    }

    let currencyScoreboardDebug: OverviewResponse['currencyScoreboardDebug'] | undefined

    if (debugEnabled) {
      const regimesObj = isRecord((biasState as any)?.currencyRegimes)
        ? ((biasState as any).currencyRegimes as Record<string, any>)
        : {}

      const debugItems = Object.entries(regimesObj).map(([ccy, regime]) => {
        const cs = currencyScoreboard.find((c) => c.currency === ccy)
        return {
          currency: ccy,
          regime: regime?.regime,
          probability: regime?.probability,
          coverage: regime?.coverage,
          presentKeys: Array.isArray(regime?.presentKeys)
            ? (regime.presentKeys as string[]).slice(0, 5)
            : undefined,
          score: cs?.score ?? 0,
          status: cs?.status ?? 'Neutro',
        }
      })

      currencyScoreboardDebug = debugItems // [] si no hay ningún régimen

      const distinctScores = Array.from(new Set(currencyScoreboard.map((c) => c.score))).length
      console.log('[overview.currencyScoreboard.debug]', {
        currencies: currencyScoreboard.map((c) => c.currency),
        scores: currencyScoreboard.map((c) => c.score),
        distinctScores,
        items: debugItems,
      })
    }

    // Build response first (with safe fallbacks)
    const response: OverviewResponse = {
      regimeGlobal: {
        risk: (dashboardData.regime?.risk || 'Neutral') as 'Risk ON' | 'Risk OFF' | 'Neutral',
        usdDirection,
        growthTrend,
        inflationTrend,
        confidence: confidenceData.level,
        confidenceExplanation: confidenceData.explanation,
        topDrivers,
      },
      currencyScoreboard,
      coreIndicators,
      countryCoverage, // Include country coverage data
      performance: {
        totalMs: totalDuration,
        queriesMs: queriesDuration,
        processingMs: processingDuration,
      },
    }
    
    // Adjuntar bloque de debug solo cuando está habilitado
    if (debugEnabled) {
      ;(response as any).currencyScoreboardDebug = currencyScoreboardDebug ?? []
    }

    const payloadSize = JSON.stringify(response).length
    
    // Detect cache hit (heuristic: if queries are very fast, likely cache hit)
    // Note: Next.js/Vercel cache is transparent, so we infer from performance
    const likelyCacheHit = queriesDuration < 100 && totalDuration < 200
    
    // Log performance metrics (PROTOCOL: 5 cargas seguidas de /macro-overview?tf=d|w|m)
    // Formato para reporte: tf=d #1 ttfb=__ms queries=__ms proc=__ms total=__ms payload=__KB cacheHit=Y/N fallback=0
    logger.info('overview.performance', {
      requestId,
      horizon,
      ttfbMs: ttfbDuration, // TTFB desde inicio hasta primera respuesta de datos
      queriesMs: queriesDuration, // Tiempo total de queries (getDashboardData + getBiasState)
      processingMs: processingDuration, // Tiempo de procesamiento de indicadores
      totalMs: totalDuration, // Tiempo total de la request
      indicatorsCount: coreIndicators.length,
      currenciesCount: currencyScoreboard.length,
      payloadSizeBytes: payloadSize,
      cacheHit: likelyCacheHit, // Heurística: queries < 100ms y total < 200ms
      fallbackCount: 0, // Logged separately in getAllLatestFromDBWithPrev (check logs for actual count)
      // OBJETIVOS:
      // queriesMs < 100-200ms ✓
      // processingMs < 50ms ✓
      // totalMs < 300-600ms ✓
      // TTFB en navegador < 1s (verificar en DevTools Network)
      // Carga total < 2-3s (verificar en DevTools Network)
    })
    
    // Set cache headers: s-maxage=60, stale-while-revalidate=300
    const headers = new Headers()
    headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    
    // Dejar que NextResponse.json añada automáticamente charset=utf-8 en Content-Type
    return NextResponse.json(response, { headers })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const durationMs = Date.now() - startTime
    
    logger.error('overview.error', {
      requestId,
      horizon,
      durationMs,
      error: errorMessage,
      stack: errorStack,
    })
    
    // Log to console for immediate debugging
    console.error('[overview] Error:', {
      requestId,
      horizon,
      error: errorMessage,
      stack: errorStack,
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch overview data', 
        details: errorMessage,
        requestId, // Include requestId for debugging
      },
      { status: 500 }
    )
  }
}
