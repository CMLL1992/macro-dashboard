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
import { MACRO_INDICATORS_CONFIG, getIndicatorConfig, formatIndicatorValue, formatIndicatorDate, type Transform } from '@/config/macro-indicators'

// Mapa de claves internas a series_id en macro_observations
export const KEY_TO_SERIES_ID: Record<string, string> = {
  // US Indicators
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  pce_yoy: 'PCEPI',
  corepce_yoy: 'PCEPILFE',
  // Core PCE mensual (nivel): usamos misma serie, transformación específica en getAllLatestFromDB
  corepce_mom: 'PCEPILFE',
  ppi_yoy: 'PPIACO',
  gdp_qoq: 'GDPC1',
  gdp_yoy: 'GDPC1',
  indpro_yoy: 'INDPRO',
  retail_yoy: 'RSAFS', // Changed from RSXFS to RSAFS (Total Retail and Food Services)
  payems_delta: 'PAYEMS',
  unrate: 'UNRATE',
  claims_4w: 'ICSA',
  t10y2y: 'T10Y2Y',
  fedfunds: 'FEDFUNDS',
  vix: 'VIXCLS',
  // Encuestas / mercado laboral avanzado
  pmi_mfg: 'USPMI',
  jolts_openings: 'JTSJOL',  // Cambiado de jolts_openings_yoy a jolts_openings (nivel, no YoY)
  // European Indicators (Eurozone)
  eu_gdp_qoq: 'EU_GDP_QOQ',
  eu_gdp_yoy: 'EU_GDP_YOY',
  eu_cpi_yoy: 'EU_CPI_YOY',
  eu_cpi_core_yoy: 'EU_CPI_CORE_YOY',
  eu_unemployment: 'EU_UNEMPLOYMENT',
  eu_pmi_manufacturing: 'EU_PMI_MANUFACTURING',
  eu_pmi_services: 'EU_PMI_SERVICES',
  eu_pmi_composite: 'EU_PMI_COMPOSITE',
  eu_ecb_rate: 'EU_ECB_RATE',
  eu_retail_sales_yoy: 'EU_RETAIL_SALES_YOY',
  eu_retail_sales_mom: 'EU_RETAIL_SALES_MOM',
  eu_industrial_production_yoy: 'EU_INDUSTRIAL_PRODUCTION_YOY',
  eu_consumer_confidence: 'EU_CONSUMER_CONFIDENCE',
  eu_zew_sentiment: 'EU_ZEW_SENTIMENT',
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
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    try {
      const rows = await db
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
 * Works with both Turso (async) and better-sqlite3 (sync)
 */
async function getLatestObservation(seriesId: string): Promise<{ date: string; value: number; observation_period?: string | null } | null> {
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    try {
      const result = await db.prepare('SELECT date, value, observation_period FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date DESC LIMIT 1').get(seriesId)
      const row = result as { date: string; value: number; observation_period?: string | null } | undefined
      return row || null
    } catch (error) {
      return null
    }
  } else {
    const db = getDB()
    try {
      const row = db
        .prepare('SELECT date, value, observation_period FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date DESC LIMIT 1')
        .get(seriesId) as { date: string; value: number; observation_period?: string | null } | undefined
      return row || null
    } catch (error) {
      return null
    }
  }
}

/**
 * Extended LatestPoint with previous value information
 */
export type LatestPointWithPrev = LatestPoint & {
  value_previous?: number | null
  date_previous?: string | null
  observation_period?: string | null // Periodo del dato (observation_date) para mostrar en tooltip
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
    // PMI / encuestas
    pmi_mfg: 'PMI manufacturero (ISM)',
    jolts_openings: 'Ofertas de empleo JOLTS',
    // Core PCE mensual
    corepce_mom: 'Core PCE mensual (MoM)',
    // Financieros / Curva
    t10y2y: 'Curva 10Y–2Y (spread %)',
    fedfunds: 'Tasa Efectiva de Fondos Federales',
    // Otros
    vix: 'Índice de Volatilidad VIX',
  }

  for (const [key, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
    // Skip corepce_mom - it's not used in the dashboard
    if (key === 'corepce_mom') {
      continue
    }
    
    const series = await getSeriesObservations(seriesId)
    
    // Get indicator configuration
    const config = getIndicatorConfig(key)
    
    if (series.length === 0) {
      const label = config?.label ?? KEY_LABELS[key] ?? labelOf(seriesId)
      results.push({
        key,
        label,
        value: null,
        date: undefined,
        unit: config ? (config.unit === 'percent' ? '%' : config.unit === 'thousands' ? 'K' : config.unit === 'millions' ? 'M' : config.unit === 'index' ? 'index' : undefined) : (key.includes('_yoy') || key.includes('_qoq') ? '%' : undefined),
      })
      continue
    }

    let value: number | null = null
    let date: string | undefined = undefined
    let unit: string | undefined
    let transformedSeries: SeriesPoint[] = []

    // Apply transformations based on config
    if (config) {
      // Use configuration-based transformation
      switch (config.transform) {
        case 'yoy':
          transformedSeries = yoy(series)
          break
        case 'qoq':
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
          }
          break
        case 'mom':
          transformedSeries = mom(series)
          break
        case 'delta':
          transformedSeries = mom(series)  // Delta is same as MoM for now
          break
        case 'sma4':
          transformedSeries = sma(series, 4)
          break
        case 'none':
        default:
          transformedSeries = series
          break
      }
      
      const lastPoint = last(transformedSeries)
      value = lastPoint?.value ?? null
      date = lastPoint?.date
      
      // Apply scale from config
      if (value !== null && config.scale !== 1) {
        value = value * config.scale
      }
      
      // Determine unit from config
      switch (config.unit) {
        case 'percent':
          unit = '%'
          break
        case 'thousands':
          unit = 'K'
          break
        case 'millions':
          unit = 'M'
          break
        case 'index':
          unit = 'index'
          break
        case 'level':
        default:
          unit = undefined
          break
      }
    } else {
      // Fallback: legacy logic for indicators not in config
      if (key.includes('_yoy')) {
        transformedSeries = yoy(series)
        const lastPoint = last(transformedSeries)
        value = lastPoint?.value ?? null
        date = lastPoint?.date
        unit = '%'
      } else if (key === 'gdp_qoq' || key === 'eu_gdp_qoq') {
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
        transformedSeries = mom(series)
        const lastPoint = last(transformedSeries)
        value = lastPoint?.value ?? null
        date = lastPoint?.date
        unit = 'k'
      } else if (key === 'claims_4w') {
        transformedSeries = sma(series, 4)
        const lastPoint = last(transformedSeries)
        value = lastPoint?.value ?? null
        date = lastPoint?.date
      } else {
        transformedSeries = series
        const lastPoint = last(series)
        value = lastPoint?.value ?? null
        date = lastPoint?.date
        if (key === 'unrate' || key === 'fedfunds' || key === 't10y2y' || 
            key === 'eu_unemployment' || key === 'eu_ecb_rate' ||
            key === 'eu_pmi_manufacturing' || key === 'eu_pmi_services' || 
            key === 'eu_pmi_composite' || key === 'eu_consumer_confidence' ||
            key === 'eu_zew_sentiment') {
          unit = key.includes('pmi') || key.includes('confidence') || key.includes('sentiment') ? 'index' : '%'
        }
      }
    }

    // Use config label if available, otherwise fallback
    const label = config?.label ?? KEY_LABELS[key] ?? labelOf(seriesId)

    results.push({
      key,
      label,
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
    // US Indicators
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
    pmi_mfg: 'PMI manufacturero (ISM)',
    jolts_openings: 'Ofertas de empleo JOLTS',
    t10y2y: 'Curva 10Y–2Y (spread %)',
    fedfunds: 'Tasa Efectiva de Fondos Federales',
    vix: 'Índice de Volatilidad VIX',
    // European Indicators (Eurozone)
    eu_gdp_qoq: 'PIB Eurozona (QoQ)',
    eu_gdp_yoy: 'PIB Eurozona (YoY)',
    eu_cpi_yoy: 'Inflación Eurozona (CPI YoY)',
    eu_cpi_core_yoy: 'Inflación Core Eurozona (Core CPI YoY)',
    eu_unemployment: 'Tasa de Desempleo Eurozona',
    eu_pmi_manufacturing: 'PMI Manufacturero Eurozona',
    eu_pmi_services: 'PMI Servicios Eurozona',
    eu_pmi_composite: 'PMI Compuesto Eurozona',
    eu_ecb_rate: 'Tasa de Interés BCE (Main Refinancing Rate)',
    eu_retail_sales_yoy: 'Ventas Minoristas Eurozona (YoY)',
    eu_retail_sales_mom: 'Ventas Minoristas Eurozona (MoM)',
    eu_industrial_production_yoy: 'Producción Industrial Eurozona (YoY)',
    eu_consumer_confidence: 'Confianza del Consumidor Eurozona',
    eu_zew_sentiment: 'ZEW Economic Sentiment Eurozona',
  }

  // DEBUG: Log European keys being processed
  const euKeys = Object.keys(KEY_TO_SERIES_ID).filter(k => k.startsWith('eu_'))
  if (euKeys.length > 0) {
    console.log('[getAllLatestFromDBWithPrev] DEBUG: Processing European keys:', euKeys)
  }

  for (const [key, seriesId] of Object.entries(KEY_TO_SERIES_ID)) {
    // Skip corepce_mom - it's not used in the dashboard
    if (key === 'corepce_mom') {
      continue
    }
    
    // PRIORITY: For gdp_qoq and payems_delta, try to read from indicator_history first
    // This ensures we use pre-calculated values instead of calculating on-the-fly
    if (key === 'gdp_qoq' || key === 'payems_delta') {
      try {
        const { getIndicatorHistoryAsync } = await import('@/lib/db/read')
        const history = await getIndicatorHistoryAsync(key)
        
        if (history && history.value_current !== null && history.date_current) {
          // Use pre-calculated value from indicator_history
          results.push({
            key,
            label: KEY_LABELS[key] ?? labelOf(seriesId),
            value: history.value_current,
            date: history.date_current,
            unit: key === 'gdp_qoq' ? '%' : 'K',
            value_previous: history.value_previous,
            date_previous: history.date_previous ?? null,
            isStale: false,
          })
          continue // Skip calculation, use pre-calculated value
        }
      } catch (error) {
        // If indicator_history read fails, fall through to calculation
        console.warn(`[getAllLatestFromDBWithPrev] Failed to read indicator_history for ${key}, falling back to calculation:`, error)
      }
    }
    
    const series = await getSeriesObservations(seriesId)
    const frequency = await getSeriesFrequency(seriesId)
    
    // DEBUG: Log for European indicators
    if (key.startsWith('eu_')) {
      console.log(`[getAllLatestFromDBWithPrev] DEBUG: ${key} -> ${seriesId}: ${series.length} observations`)
    }
    
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

    // Get indicator configuration
    const config = getIndicatorConfig(key)
    
    let transformedSeries: SeriesPoint[] = []
    let unit: string | undefined

    // Apply transformations based on config
    if (config) {
      // Use configuration-based transformation
      switch (config.transform) {
        case 'yoy':
          transformedSeries = yoy(series)
          break
        case 'qoq':
          const qoqSeries: SeriesPoint[] = []
          for (let i = 1; i < series.length; i++) {
            const recent = series[i]
            const prev = series[i - 1]
            if (prev.value !== 0 && prev.value > 0) {
              // Para USA GDP: QoQ anualizado: ((recent/prev)^4 - 1) * 100
              // Para Eurozone GDP: QoQ simple: ((recent/prev) - 1) * 100
              const isEurozone = key.startsWith('eu_')
              const qoqValue = isEurozone 
                ? ((recent.value / prev.value) - 1) * 100  // QoQ simple para Eurozona
                : ((recent.value / prev.value) ** 4 - 1) * 100  // QoQ anualizado para USA
              qoqSeries.push({ date: recent.date, value: qoqValue })
            }
          }
          transformedSeries = qoqSeries
          break
        case 'mom':
          transformedSeries = mom(series)
          break
        case 'delta':
          transformedSeries = mom(series)  // Delta is same as MoM for now
          break
        case 'sma4':
          transformedSeries = sma(series, 4)
          break
        case 'none':
        default:
          transformedSeries = series
          break
      }
      
      // Determine unit from config
      switch (config.unit) {
        case 'percent':
          unit = '%'
          break
        case 'thousands':
          unit = 'K'
          break
        case 'millions':
          unit = 'M'
          break
        case 'index':
          unit = 'index'
          break
        case 'level':
        default:
          unit = undefined
          break
      }
    } else {
      // Fallback: legacy logic for indicators not in config
      if (key.includes('_yoy')) {
        transformedSeries = yoy(series)
        unit = '%'
      } else if (key === 'gdp_qoq') {
        // USA GDP QoQ: calcular desde nivel
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
      } else if (key === 'eu_gdp_qoq' || key === 'eu_gdp_yoy') {
        // Eurozone GDP: Si viene de ECB como nivel, calcular QoQ/YoY
        // Si viene de TradingEconomics como porcentaje, usar directamente
        // Por ahora, asumimos que viene como nivel desde ECB y calculamos
        if (key === 'eu_gdp_qoq') {
          const qoqSeries: SeriesPoint[] = []
          for (let i = 1; i < series.length; i++) {
            const recent = series[i]
            const prev = series[i - 1]
            if (prev.value !== 0 && prev.value > 0) {
              // QoQ: ((recent/prev) - 1) * 100 (sin anualizar para Eurozona)
              const qoqValue = ((recent.value / prev.value) - 1) * 100
              qoqSeries.push({ date: recent.date, value: qoqValue })
            }
          }
          transformedSeries = qoqSeries
        } else if (key === 'eu_gdp_yoy') {
          // YoY: buscar valor del año anterior
          transformedSeries = yoy(series)
        }
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
    }

    // Calculate previous/current from transformed series using robust date-based logic
    const obs: Observation[] = transformedSeries.map(s => ({
      date: s.date,
      value: s.value,
    }))

    const { previous, current } = computePrevCurr(obs)
    const stale = isStale(current?.date ?? null, getFrequency(frequency))

    // DEBUG: Log for European indicators, retail_yoy, and GDP with results
    if (key.startsWith('eu_') || key === 'retail_yoy' || key === 'eu_gdp_qoq' || key === 'eu_gdp_yoy' || key === 'jolts_openings') {
      const rawValue = current?.value ?? null
      const scaledValue = config && rawValue !== null ? rawValue * config.scale : null
      console.log(`[getAllLatestFromDBWithPrev] DEBUG: ${key} result:`, {
        raw_value: rawValue,
        scaled_value: scaledValue,
        value_previous: previous?.value ?? null,
        date: current?.date,
        date_previous: previous?.date ?? null,
        transformedSeriesLength: transformedSeries.length,
        config: config ? { scale: config.scale, unit: config.unit, decimals: config.decimals, transform: config.transform } : null,
      })
    }

    // Apply scale from config if available
    let displayValue = current?.value ?? null
    let displayValuePrevious = previous?.value ?? null
    
    if (config && displayValue !== null) {
      displayValue = displayValue * config.scale
    }
    if (config && displayValuePrevious !== null) {
      displayValuePrevious = displayValuePrevious * config.scale
    }
    
    // Use config label if available, otherwise fallback
    const label = config?.label ?? KEY_LABELS[key] ?? labelOf(seriesId)

    // Obtener observation_period del último dato si está disponible
    let observationPeriod: string | null = null
    if (current?.date) {
      try {
        const latestObs = await getLatestObservation(seriesId)
        observationPeriod = latestObs?.observation_period || null
      } catch {
        // Ignorar errores al obtener observation_period
      }
    }

    results.push({
      key,
      label,
      value: displayValue,
      date: current?.date,
      unit,
      value_previous: displayValuePrevious,
      date_previous: previous?.date ?? null,
      observation_period: observationPeriod,
      isStale: stale,
    })
  }

  // DEBUG: Log final European results
  const euResults = results.filter(r => r.key.startsWith('eu_'))
  if (euResults.length > 0) {
    console.log('[getAllLatestFromDBWithPrev] DEBUG: Final European results:', euResults.map(r => ({
      key: r.key,
      value: r.value,
      date: r.date,
    })))
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

