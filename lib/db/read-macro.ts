/**
 * Read macro indicators from SQLite (source of truth)
 * Replaces direct FRED calls in getMacroDiagnosis()
 * Works with both Turso (async) and better-sqlite3 (sync)
 */

import { getDB } from './schema'
import { getUnifiedDB, isUsingTurso } from './unified-db'
import { labelOf, yoy, mom, last, sma } from '@/lib/fred'
import type { LatestPoint, SeriesPoint } from '@/lib/fred'
import { computePrevCurr, isStale, getFrequency, type Observation } from '@/lib/macro/prev-curr'

// Mapa de claves internas a series_id en macro_observations
export const KEY_TO_SERIES_ID: Record<string, string> = {
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  pce_yoy: 'PCEPI',
  corepce_yoy: 'PCEPILFE',
  ppi_yoy: 'PPIACO',
  gdp_qoq: 'GDPC1',
  gdp_yoy: 'GDPC1',
  indpro_yoy: 'INDPRO',
  retail_yoy: 'RSXFS',
  payems_delta: 'PAYEMS',
  unrate: 'UNRATE',
  claims_4w: 'ICSA',
  t10y2y: 'T10Y2Y',
  fedfunds: 'FEDFUNDS',
  vix: 'VIXCLS',
}

/**
 * Get all observations for a series from macro_observations
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
async function getSeriesObservations(seriesId: string): Promise<SeriesPoint[]> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    try {
      const result = await db.prepare('SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date ASC').all(seriesId)
      const rows = result as Array<{ date: string; value: number }>
      return rows.map(r => ({ date: r.date, value: r.value }))
    } catch (error) {
      console.error('[read-macro] Error getting observations from Turso:', error)
      return []
    }
  } else {
    const db = getDB()
    try {
      const rows = db
        .prepare('SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date ASC')
        .all(seriesId) as Array<{ date: string; value: number }>
      return rows.map(r => ({ date: r.date, value: r.value }))
    } catch (error) {
      return []
    }
  }
}

/**
 * Get series frequency from macro_series table
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
async function getSeriesFrequency(seriesId: string): Promise<string | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    try {
      const result = await db.prepare('SELECT frequency FROM macro_series WHERE series_id = ?').get(seriesId)
      const row = result as { frequency: string } | undefined
      return row?.frequency ?? null
    } catch (error) {
      return null
    }
  } else {
    const db = getDB()
    try {
      const row = db
        .prepare('SELECT frequency FROM macro_series WHERE series_id = ?')
        .get(seriesId) as { frequency: string } | undefined
      return row?.frequency ?? null
    } catch (error) {
      return null
    }
  }
}

/**
 * Get previous and current values for a series using robust date-based calculation
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function getSeriesPrevCurr(seriesId: string): Promise<{
  previous: { date: string; value: number } | null
  current: { date: string; value: number } | null
  isStale: boolean
}> {
  const observations = await getSeriesObservations(seriesId)
  const frequency = await getSeriesFrequency(seriesId)
  
  if (observations.length === 0) {
    return { previous: null, current: null, isStale: true }
  }

  // Convert to Observation format
  const obs: Observation[] = observations.map(o => ({
    date: o.date,
    value: o.value,
  }))

  const { previous, current } = computePrevCurr(obs)
  const stale = isStale(current?.date ?? null, getFrequency(frequency))

  return {
    previous: previous ? { date: previous.date, value: previous.value } : null,
    current: current ? { date: current.date, value: current.value } : null,
    isStale: stale,
  }
}

/**
 * Get latest observation for a series from macro_observations
 */
function getLatestObservation(seriesId: string): { date: string; value: number } | null {
  const db = getDB()
  try {
    const row = db
      .prepare('SELECT date, value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date DESC LIMIT 1')
      .get(seriesId) as { date: string; value: number } | undefined

    return row || null
  } catch (error) {
    return null
  }
}

/**
 * Extended LatestPoint with previous value information
 */
export type LatestPointWithPrev = LatestPoint & {
  value_previous?: number | null
  date_previous?: string | null
  isStale?: boolean
}

/**
 * Get all macro indicators from SQLite (primary source)
 * Returns LatestPoint[] compatible with getAllLatest() format
 * Applies transformations (YoY, QoQ, MoM) as needed
 * Now includes robust previous/current calculation based on dates
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function getAllLatestFromDB(): Promise<LatestPoint[]> {
  const results: LatestPoint[] = []

  // Labels canónicos por clave interna (evita colisiones entre transformaciones de la misma serie)
  const KEY_LABELS: Record<string, string> = {
    // Precios / Inflación
    cpi_yoy: 'Inflación CPI (YoY)',
    corecpi_yoy: 'Inflación Core CPI (YoY)',
    pce_yoy: 'Inflación PCE (YoY)',
    corepce_yoy: 'Inflación Core PCE (YoY)',
    ppi_yoy: 'Índice de Precios al Productor (PPI YoY)',
    // Crecimiento / Actividad
    gdp_yoy: 'PIB Interanual (GDP YoY)',
    gdp_qoq: 'PIB Trimestral (GDP QoQ Anualizado)',
    indpro_yoy: 'Producción Industrial (YoY)',
    retail_yoy: 'Ventas Minoristas (YoY)',
    // Mercado laboral
    payems_delta: 'Nóminas No Agrícolas (NFP Δ miles)',
    unrate: 'Tasa de Desempleo (U3)',
    claims_4w: 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)',
    // Financieros / Curva
    t10y2y: 'Curva 10Y–2Y (spread %)',
    fedfunds: 'Tasa Efectiva de Fondos Federales',
    // Otros
    vix: 'Índice de Volatilidad VIX',
  }

  for (const [key, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
    const series = await getSeriesObservations(seriesId)
    
    if (series.length === 0) {
      results.push({
        key,
        label: KEY_LABELS[key] ?? labelOf(seriesId),
        value: null,
        date: undefined,
        unit: key.includes('_yoy') || key.includes('_qoq') ? '%' : undefined,
      })
      continue
    }

    let value: number | null = null
    let date: string | undefined = undefined
    let unit: string | undefined
    let transformedSeries: SeriesPoint[] = []

    // Apply transformations based on key
    if (key.includes('_yoy')) {
      // Calculate YoY
      transformedSeries = yoy(series)
      const lastPoint = last(transformedSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      unit = '%'
    } else if (key === 'gdp_qoq') {
      // Calculate QoQ annualized
      if (series.length >= 2) {
        const qoqSeries: SeriesPoint[] = []
        for (let i = 1; i < series.length; i++) {
          const recent = series[i]
          const prev = series[i - 1]
          if (prev.value !== 0) {
            const qoqValue = ((recent.value / prev.value) ** 4 - 1) * 100
            qoqSeries.push({ date: recent.date, value: qoqValue })
          }
        }
        transformedSeries = qoqSeries
        const lastPoint = last(qoqSeries)
        value = lastPoint?.value ?? null
        date = lastPoint?.date
      }
      unit = '%'
    } else if (key === 'payems_delta') {
      // Calculate MoM delta
      transformedSeries = mom(series)
      const lastPoint = last(transformedSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      unit = 'k'
    } else if (key === 'claims_4w') {
      // Calculate 4-week SMA
      transformedSeries = sma(series, 4)
      const lastPoint = last(transformedSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
    } else {
      // Direct value (unrate, fedfunds, t10y2y, vix)
      transformedSeries = series
      const lastPoint = last(series)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      if (key === 'unrate' || key === 'fedfunds' || key === 't10y2y') unit = '%'
    }

    results.push({
      key,
      label: KEY_LABELS[key] ?? labelOf(seriesId),
      value,
      date,
      unit,
    })
  }

  return results
}

/**
 * Get all macro indicators with previous values calculated robustly
 * This is the function that should be used for dashboard data
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function getAllLatestFromDBWithPrev(): Promise<LatestPointWithPrev[]> {
  const results: LatestPointWithPrev[] = []

  // Labels canónicos por clave interna
  const KEY_LABELS: Record<string, string> = {
    cpi_yoy: 'Inflación CPI (YoY)',
    corecpi_yoy: 'Inflación Core CPI (YoY)',
    pce_yoy: 'Inflación PCE (YoY)',
    corepce_yoy: 'Inflación Core PCE (YoY)',
    ppi_yoy: 'Índice de Precios al Productor (PPI YoY)',
    gdp_yoy: 'PIB Interanual (GDP YoY)',
    gdp_qoq: 'PIB Trimestral (GDP QoQ Anualizado)',
    indpro_yoy: 'Producción Industrial (YoY)',
    retail_yoy: 'Ventas Minoristas (YoY)',
    payems_delta: 'Nóminas No Agrícolas (NFP Δ miles)',
    unrate: 'Tasa de Desempleo (U3)',
    claims_4w: 'Solicitudes Iniciales de Subsidio por Desempleo (Media 4 semanas)',
    t10y2y: 'Curva 10Y–2Y (spread %)',
    fedfunds: 'Tasa Efectiva de Fondos Federales',
    vix: 'Índice de Volatilidad VIX',
  }

  for (const [key, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
    const series = await getSeriesObservations(seriesId)
    const frequency = await getSeriesFrequency(seriesId)
    
    if (series.length === 0) {
      results.push({
        key,
        label: KEY_LABELS[key] ?? labelOf(seriesId),
        value: null,
        date: undefined,
        unit: key.includes('_yoy') || key.includes('_qoq') ? '%' : undefined,
        value_previous: null,
        date_previous: null,
        isStale: true,
      })
      continue
    }

    let transformedSeries: SeriesPoint[] = []
    let unit: string | undefined

    // Apply transformations based on key
    if (key.includes('_yoy')) {
      transformedSeries = yoy(series)
      unit = '%'
    } else if (key === 'gdp_qoq') {
      const qoqSeries: SeriesPoint[] = []
      for (let i = 1; i < series.length; i++) {
        const recent = series[i]
        const prev = series[i - 1]
        if (prev.value !== 0) {
          const qoqValue = ((recent.value / prev.value) ** 4 - 1) * 100
          qoqSeries.push({ date: recent.date, value: qoqValue })
        }
      }
      transformedSeries = qoqSeries
      unit = '%'
    } else if (key === 'payems_delta') {
      transformedSeries = mom(series)
      unit = 'k'
    } else if (key === 'claims_4w') {
      transformedSeries = sma(series, 4)
    } else {
      transformedSeries = series
      if (key === 'unrate' || key === 'fedfunds' || key === 't10y2y') unit = '%'
    }

    // Calculate previous/current from transformed series using robust date-based logic
    const obs: Observation[] = transformedSeries.map(s => ({
      date: s.date,
      value: s.value,
    }))

    const { previous, current } = computePrevCurr(obs)
    const stale = isStale(current?.date ?? null, getFrequency(frequency))

    results.push({
      key,
      label: KEY_LABELS[key] ?? labelOf(seriesId),
      value: current?.value ?? null,
      date: current?.date,
      unit,
      value_previous: previous?.value ?? null,
      date_previous: previous?.date ?? null,
      isStale: stale,
    })
  }

  return results
}

/**
 * Get latest observation date across all series
 */
export async function getLatestObservationDate(): Promise<string | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    try {
      const result = await db.prepare('SELECT MAX(date) as max_date FROM macro_observations WHERE value IS NOT NULL').get()
      const row = result as { max_date: string | null } | undefined
      return row?.max_date ?? null
    } catch (error) {
      console.error('[read-macro] Error getting latest date from Turso:', error)
      return null
    }
  } else {
    const db = getDB()
    const row = db
      .prepare('SELECT MAX(date) as max_date FROM macro_observations WHERE value IS NOT NULL')
      .get() as { max_date: string | null } | undefined
    return row?.max_date ?? null
  }
}

/**
 * Health check: verify database has required data
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
export async function checkMacroDataHealth(): Promise<{
  hasObservations: boolean
  hasBias: boolean
  hasCorrelations: boolean
  observationCount: number
  biasCount: number
  correlationCount: number
  latestDate: string | null
}> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    try {
      const obsCountResult = await db.prepare('SELECT COUNT(1) as c FROM macro_observations').get()
      const biasCountResult = await db.prepare('SELECT COUNT(1) as c FROM macro_bias').get()
      const corrCountResult = await db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get()
      const latestDate = await getLatestObservationDate()
      
      const obsCount = obsCountResult as { c: number }
      const biasCount = biasCountResult as { c: number }
      const corrCount = corrCountResult as { c: number }
      
      return {
        hasObservations: obsCount.c > 0,
        hasBias: biasCount.c > 0,
        hasCorrelations: corrCount.c > 0,
        observationCount: obsCount.c,
        biasCount: biasCount.c,
        correlationCount: corrCount.c,
        latestDate,
      }
    } catch (error) {
      console.error('[read-macro] Error in checkMacroDataHealth with Turso:', error)
      return {
        hasObservations: false,
        hasBias: false,
        hasCorrelations: false,
        observationCount: 0,
        biasCount: 0,
        correlationCount: 0,
        latestDate: null,
      }
    }
  } else {
    const db = getDB()
    const obsCount = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
    const biasCount = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
    const corrCount = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
    const latestDate = await getLatestObservationDate() // Now async
    
    return {
      hasObservations: obsCount.c > 0,
      hasBias: biasCount.c > 0,
      hasCorrelations: corrCount.c > 0,
      observationCount: obsCount.c,
      biasCount: biasCount.c,
      correlationCount: corrCount.c,
      latestDate,
    }
  }
}

