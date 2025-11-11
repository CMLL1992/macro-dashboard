/**
 * Read macro indicators from SQLite (source of truth)
 * Replaces direct FRED calls in getMacroDiagnosis()
 */

import { getDB } from './schema'
import { labelOf, yoy, mom, last, sma } from '@/lib/fred'
import type { LatestPoint, SeriesPoint } from '@/lib/fred'

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
 */
function getSeriesObservations(seriesId: string): SeriesPoint[] {
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
 * Get all macro indicators from SQLite (primary source)
 * Returns LatestPoint[] compatible with getAllLatest() format
 * Applies transformations (YoY, QoQ, MoM) as needed
 */
export function getAllLatestFromDB(): LatestPoint[] {
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
    const series = getSeriesObservations(seriesId)
    
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

    // Apply transformations based on key
    if (key.includes('_yoy')) {
      // Calculate YoY
      const yoySeries = yoy(series)
      const lastPoint = last(yoySeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      unit = '%'
    } else if (key === 'gdp_qoq') {
      // Calculate QoQ annualized
      if (series.length >= 2) {
        const recent = series[series.length - 1]
        const prev = series[series.length - 2]
        if (prev.value !== 0) {
          value = ((recent.value / prev.value) ** 4 - 1) * 100
          date = recent.date
        }
      }
      unit = '%'
    } else if (key === 'payems_delta') {
      // Calculate MoM delta
      const momSeries = mom(series)
      const lastPoint = last(momSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      unit = 'k'
    } else if (key === 'claims_4w') {
      // Calculate 4-week SMA
      const smaSeries = sma(series, 4)
      const lastPoint = last(smaSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
    } else {
      // Direct value (unrate, fedfunds, t10y2y, vix)
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
 * Get latest observation date across all series
 */
export function getLatestObservationDate(): string | null {
  const db = getDB()
  const row = db
    .prepare('SELECT MAX(date) as max_date FROM macro_observations WHERE value IS NOT NULL')
    .get() as { max_date: string | null } | undefined

  return row?.max_date ?? null
}

/**
 * Health check: verify database has required data
 */
export function checkMacroDataHealth(): {
  hasObservations: boolean
  hasBias: boolean
  hasCorrelations: boolean
  observationCount: number
  biasCount: number
  correlationCount: number
  latestDate: string | null
} {
  const db = getDB()
  
  const obsCount = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
  const biasCount = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
  const corrCount = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
  const latestDate = getLatestObservationDate()

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

