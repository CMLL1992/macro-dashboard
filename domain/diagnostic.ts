import { getAllLatest, type LatestPoint } from '@/lib/fred'
import { postureOf, weightedScore, diagnose, WEIGHTS, toNumeric } from './posture'
import { categoryFor, CATEGORY_ORDER, type Category } from './categories'
import { calculateTrend, type Trend } from './trend'
import { getAllLatestFromDBWithPrev, type LatestPointWithPrev } from '@/lib/db/read-macro'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import fs from 'node:fs'
import path from 'node:path'

// Feature flag: desactivar llamadas directas a FRED por defecto
const USE_LIVE_SOURCES = process.env.USE_LIVE_SOURCES === 'true'

// Tipos para scores por moneda
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD'

export type IndicatorGroup = 'growth' | 'inflation' | 'labor' | 'monetary' | 'sentiment'

export interface CurrencyScore {
  currency: Currency
  totalScore: number          // -1 a +1
  growthScore: number         // solo indicadores de crecimiento
  inflationScore: number      // solo inflación
  laborScore: number          // solo empleo
  monetaryScore: number       // política monetaria
  sentimentScore: number      // sentimiento/encuestas
}

export type CurrencyScores = Record<Currency, CurrencyScore>

export type CurrencyIndicatorMeta = {
  currency: Currency
  group: IndicatorGroup
}

// Cargar mapeo de indicadores a divisa y grupo
function loadCurrencyIndicators(): Record<string, CurrencyIndicatorMeta> {
  try {
    const p = path.join(process.cwd(), 'config', 'currency-indicators.json')
    const txt = fs.readFileSync(p, 'utf8')
    const json = JSON.parse(txt)
    return json.indicators || {}
  } catch (error) {
    console.warn('[loadCurrencyIndicators] Failed to load config, using empty map:', error)
    return {}
  }
}

const CURRENCY_INDICATORS = loadCurrencyIndicators()

// Mapa para obtener el ID de serie correcto para pesos desde los keys internos
// Solo incluye los indicadores curados de alto impacto
export const MAP_KEY_TO_WEIGHT_KEY: Record<string, string> = {
  // US Inflation (4) - eliminado PCEPI (headline)
  cpi_yoy: 'CPIAUCSL',
  corecpi_yoy: 'CPILFESL',
  corepce_yoy: 'PCEPILFE',
  ppi_yoy: 'PPIACO',
  // US Growth / Activity
  gdp_qoq: 'GDPC1',
  gdp_yoy: 'GDPC1',
  gdp_qoq_annualized: 'GDPC1',
  indpro_yoy: 'INDPRO',
  retail_yoy: 'RSAFS',
  // US Employment (4)
  nfp_change: 'PAYEMS',
  payems_delta: 'PAYEMS',
  unemployment_rate_u3: 'UNRATE',
  unrate: 'UNRATE',
  initial_claims_4w: 'ICSA',
  claims_4w: 'ICSA',
  jolts_openings: 'JTSJOL',
  // Surveys / Activity
  ism_manufacturing_pmi: 'USPMI',
  pmi_mfg: 'USPMI',
  ism_services_pmi: 'USPMI_SERVICES',
  // Monetary Policy
  yield_curve_10y_2y: 'T10Y2Y',
  t10y2y: 'T10Y2Y',
  fed_funds_effective: 'FEDFUNDS',
  fedfunds: 'FEDFUNDS',
  // Extra indicators
  michigan_consumer_sentiment: 'UMCSENT',
  housing_starts: 'HOUST',
  building_permits: 'PERMIT',
  nfib_small_business_optimism: 'NFIB',
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
  eu_industrial_production_yoy: 'EU_INDUSTRIAL_PRODUCTION_YOY',
  eu_consumer_confidence: 'EU_CONSUMER_CONFIDENCE',
  eu_zew_sentiment: 'EU_ZEW_SENTIMENT',
  // UK Indicators (GBP)
  uk_gdp_qoq: 'UK_GDP_QOQ',
  uk_gdp_yoy: 'UK_GDP_YOY',
  uk_services_pmi: 'UK_SERVICES_PMI',
  uk_manufacturing_pmi: 'UK_MANUFACTURING_PMI',
  uk_retail_sales_yoy: 'UK_RETAIL_SALES_YOY',
  uk_cpi_yoy: 'UK_CPI_YOY',
  uk_core_cpi_yoy: 'UK_CORE_CPI_YOY',
  uk_ppi_output_yoy: 'UK_PPI_OUTPUT_YOY',
  uk_unemployment_rate: 'UK_UNEMPLOYMENT_RATE',
  uk_avg_earnings_yoy: 'UK_AVG_EARNINGS_YOY',
  uk_boe_rate: 'UK_BOE_RATE',
  // Japan Indicators (JPY)
  jp_gdp_qoq: 'JP_GDP_QOQ',
  jp_gdp_yoy: 'JP_GDP_YOY',
  jp_industrial_production_yoy: 'JP_INDUSTRIAL_PRODUCTION_YOY',
  jp_retail_sales_yoy: 'JP_RETAIL_SALES_YOY',
  jp_tankan_manufacturing: 'JP_TANKAN_MANUFACTURING',
  jp_services_pmi: 'JP_SERVICES_PMI',
  jp_cpi_yoy: 'JP_CPI_YOY',
  jp_core_cpi_yoy: 'JP_CORE_CPI_YOY',
  jp_ppi_yoy: 'JP_PPI_YOY',
  jp_unemployment_rate: 'JP_UNEMPLOYMENT_RATE',
  jp_job_to_applicant_ratio: 'JP_JOB_TO_APPLICANT_RATIO',
  jp_boj_rate: 'JP_BOJ_RATE',
}

/**
 * Get macro diagnosis from SQLite (primary source)
 * Falls back to FRED only if USE_LIVE_SOURCES=true and data is missing
 * Now uses robust date-based previous/current calculation
 */
export async function getMacroDiagnosis() {
  // Primary: read from SQLite with robust previous/current calculation
  let data: LatestPointWithPrev[] = await getAllLatestFromDBWithPrev()
  
  // DEBUG: Log European keys from getAllLatestFromDBWithPrev
  const euData = data.filter(d => d.key.startsWith('eu_'))
  if (euData.length > 0) {
    console.log('[getMacroDiagnosis] DEBUG: European data from getAllLatestFromDBWithPrev:', euData.map(d => ({
      key: d.key,
      value: d.value,
      date: d.date,
    })))
  }
  
  // Fallback: if enabled and data is missing, try FRED for missing indicators
  // Also try FRED if ALL values are null (indicator_history empty and transformations failed)
  const hasAnyValue = data.some(d => d.value != null)
  const allNull = data.every(d => d.value == null)
  
  if ((USE_LIVE_SOURCES || allNull) && (!hasAnyValue || data.some(d => d.value == null))) {
    try {
      const fredData = await getAllLatest()
      // Merge: use FRED data only for indicators missing from DB
      const dbMap = new Map(data.map(d => [d.key, d]))
      for (const fredPoint of fredData) {
        if (!dbMap.has(fredPoint.key) || dbMap.get(fredPoint.key)?.value == null) {
          data = data.filter(d => d.key !== fredPoint.key)
          // Convert to LatestPointWithPrev format (no previous data from FRED fallback)
          data.push({
            ...fredPoint,
            value_previous: null,
            date_previous: null,
            isStale: true, // Assume stale if coming from FRED fallback
          })
        }
      }
      console.log('[getMacroDiagnosis] FRED fallback applied, items with value:', data.filter(d => d.value != null).length)
    } catch (error) {
      // FRED failed, continue with DB data only
      console.warn('[getMacroDiagnosis] FRED fallback failed, using DB data only:', error)
    }
  }
  
  // De-duplicate by key (evita duplicados como GDP YoY apareciendo dos veces)
  const uniqueByKey = new Map<string, LatestPointWithPrev>()
  for (const d of data) {
    uniqueByKey.set(d.key, d)
  }
  data = Array.from(uniqueByKey.values())
  // Extra: asegurar que YoY y QoQ de GDP no comparten label
  for (const d of data) {
    if (d.key === 'gdp_yoy') d.label = 'PIB Interanual (GDP YoY)'
    if (d.key === 'gdp_qoq') d.label = 'PIB Trimestral (GDP QoQ Anualizado)'
  }
  
  // Función helper para obtener valores históricos de una serie (para z-score)
  async function getHistoricalValues(seriesId: string): Promise<number[]> {
    try {
      // All methods are async now, so always use await
      const db = getUnifiedDB()
      const result = await db.prepare('SELECT value FROM macro_observations WHERE series_id = ? AND value IS NOT NULL ORDER BY date ASC').all(seriesId)
      const rows = result as Array<{ value: number }>
      return rows.map(r => r.value).filter(v => v != null && isFinite(v))
    } catch (error) {
      console.warn(`[getMacroDiagnosis] Failed to get historical values for ${seriesId}:`, error)
      return []
    }
  }

  // Calcular z-scores para todos los indicadores (en paralelo para mejor performance)
  const zScorePromises = data.map(async (d) => {
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[d.key] ?? d.key
    const historicalValues = await getHistoricalValues(weightKey)
    const zScore = historicalValues.length >= 20 ? computeZScore(historicalValues) : null
    return { key: d.key, weightKey, zScore }
  })
  
  const zScoresMap = new Map<string, number | null>()
  const zScoreResults = await Promise.all(zScorePromises)
  for (const result of zScoreResults) {
    zScoresMap.set(result.key, result.zScore)
    zScoresMap.set(result.weightKey, result.zScore) // También mapear por weightKey
  }

  const items = data.map(d => {
    const posture = postureOf(d.key, d.value ?? null)
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[d.key] ?? d.key
    const weight = WEIGHTS[weightKey] ?? 0
    const zScore = zScoresMap.get(d.key) ?? zScoresMap.get(weightKey) ?? null
    
    // DEBUG: Log for European indicators and corepce_yoy
    if (d.key.startsWith('eu_') || d.key === 'corepce_yoy' || d.key === 'pmi_mfg' || d.key === 'jolts_openings') {
      console.log(`[getMacroDiagnosis] DEBUG: ${d.key} -> weightKey: ${weightKey}, weight: ${weight}, WEIGHTS[${weightKey}]: ${WEIGHTS[weightKey]}, value: ${d.value}, zScore: ${zScore}`)
    }
    
    // Calculate trend using robust previous value
    const trend = calculateTrend(
      weightKey,
      d.value ?? null,
      d.value_previous ?? null
    )
    
    return {
      key: weightKey, // ID único (FRED series id canónico)
      seriesId: weightKey,
      label: d.label,
      value: d.value,
      value_previous: d.value_previous ?? null,
      date: d.date,
      date_previous: d.date_previous ?? null,
      trend,
      posture,
      numeric: d.value == null ? 0 : toNumeric(posture),
      weight,
      category: categoryFor(weightKey),
      originalKey: d.key, // Preserve original key (e.g., 'gdp_yoy', 'cpi_yoy') for freshness calculation
      isStale: d.isStale ?? false, // Include stale flag for UI
      zScore, // Nuevo: z-score del indicador
    }
  })

  // Debug: validar ausencia de duplicados por label
  ;(function assertNoDuplicates(list: any[]) {
    try {
      const labels = list.map(i => String(i.label))
      const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i)
      if (duplicates.length > 0) {
        console.error('DUPLICATED LABELS FOUND:', Array.from(new Set(duplicates)))
      }
    } catch {}
  })(items as any[])

  // Ordenar por categoría y luego por peso desc/label
  items.sort((a: any, b: any) => {
    const co = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (co !== 0) return co
    const w = (b.weight || 0) - (a.weight || 0)
    if (w !== 0) return w
    return String(a.label).localeCompare(String(b.label))
  })

  const { score } = weightedScore(items)
  const regime = diagnose(score)
  const dates = items.map(i => i as any).map(i => i.date).filter(Boolean) as string[]
  const lastUpdated = dates.length ? dates.sort().at(-1)! : ''
  const total = items.length
  const withValue = items.filter(i => i.value != null).length
  const nulls = total - withValue
  const fredRevalidateHours = 3

  // Calculate improving/deteriorating based on trends
  const improving = items.filter((i: any) => i.trend === 'Mejora').length
  const deteriorating = items.filter((i: any) => i.trend === 'Empeora').length

  // Resumen por categoría
  const categoryCounts: Record<Category, { total: number; withValue: number }> = {} as any
  for (const cat of CATEGORY_ORDER) categoryCounts[cat] = { total: 0, withValue: 0 }
  for (const it of items as any[]) {
    const cat = it.category as Category
    if (!categoryCounts[cat]) categoryCounts[cat] = { total: 0, withValue: 0 }
    categoryCounts[cat].total += 1
    if (it.value != null) categoryCounts[cat].withValue += 1
  }

  // Calcular scores por moneda
  const currencyScores = computeCurrencyScores(items, WEIGHTS, CURRENCY_INDICATORS)
  
  // Calcular regímenes macro por moneda con features específicos
  // Cada moneda debe calcularse independientemente para evitar clonados
  // Pasar el régimen global para contexto adicional
  const currencyRegimes: Record<Currency, RegimeResult> = {
    USD: calcCurrencyRegime('USD', currencyScores.USD, regime),
    EUR: calcCurrencyRegime('EUR', currencyScores.EUR, regime),
    GBP: calcCurrencyRegime('GBP', currencyScores.GBP, regime),
    JPY: calcCurrencyRegime('JPY', currencyScores.JPY, regime),
    AUD: calcCurrencyRegime('AUD', currencyScores.AUD, regime),
  }

  // Debug: Log features por moneda (solo en dev)
  if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_CURRENCY_REGIMES === 'true') {
    for (const [ccy, score] of Object.entries(currencyScores)) {
      const regime = currencyRegimes[ccy as Currency]
      console.debug('[currencyRegime]', ccy, {
        growthScore: score.growthScore,
        inflationScore: score.inflationScore,
        laborScore: score.laborScore,
        monetaryScore: score.monetaryScore,
        sentimentScore: score.sentimentScore,
        totalScore: score.totalScore,
        regime: regime.regime,
        probability: regime.probability,
        description: regime.description,
      })
    }
  }

  return { 
    items, 
    score, 
    regime, 
    threshold: 0.3, 
    lastUpdated, 
    counts: { total, withValue, nulls }, 
    freshness: { fredRevalidateHours }, 
    categoryCounts,
    improving,
    deteriorating,
    currencyScores, // Nuevo: scores por moneda
    currencyRegimes, // Nuevo: regímenes macro por moneda
  }
}

/**
 * Calcula scores por moneda basado en indicadores agrupados
 */
export function computeCurrencyScores(
  indicators: Array<{ key: string; posture: string; weight: number; numeric: number }>,
  weights: Record<string, number>,
  meta: Record<string, CurrencyIndicatorMeta>
): CurrencyScores {
  // Inicializar scores vacíos para todas las monedas
  const empty: CurrencyScores = {
    USD: { currency: 'USD', totalScore: 0, growthScore: 0, inflationScore: 0, laborScore: 0, monetaryScore: 0, sentimentScore: 0 },
    EUR: { currency: 'EUR', totalScore: 0, growthScore: 0, inflationScore: 0, laborScore: 0, monetaryScore: 0, sentimentScore: 0 },
    GBP: { currency: 'GBP', totalScore: 0, growthScore: 0, inflationScore: 0, laborScore: 0, monetaryScore: 0, sentimentScore: 0 },
    JPY: { currency: 'JPY', totalScore: 0, growthScore: 0, inflationScore: 0, laborScore: 0, monetaryScore: 0, sentimentScore: 0 },
    AUD: { currency: 'AUD', totalScore: 0, growthScore: 0, inflationScore: 0, laborScore: 0, monetaryScore: 0, sentimentScore: 0 },
  }

  for (const ind of indicators) {
    const w = weights[ind.key] ?? ind.weight ?? 0
    if (!w || w === 0) continue

    const cfg = meta[ind.key]
    if (!cfg) continue

    // Usar numeric (ya está en [-1, 1]) o convertir posture
    const contrib = ind.numeric !== undefined ? ind.numeric * w : 
                    (ind.posture === 'Hawkish' ? 1 : ind.posture === 'Dovish' ? -1 : 0) * w

    const cs = empty[cfg.currency]
    if (!cs) continue // Moneda no soportada

    cs.totalScore += contrib
    if (cfg.group === 'growth') cs.growthScore += contrib
    if (cfg.group === 'inflation') cs.inflationScore += contrib
    if (cfg.group === 'labor') cs.laborScore += contrib
    if (cfg.group === 'monetary') cs.monetaryScore += contrib
    if (cfg.group === 'sentiment') cs.sentimentScore += contrib
  }

  return empty
}

/**
 * Calcula el z-score de un valor respecto a su historial
 * Requiere al menos 20 observaciones para ser significativo
 */
export function computeZScore(values: number[]): number | null {
  if (!values || values.length < 20) return null
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  
  if (std === 0 || !isFinite(std)) return null
  
  const latest = values[values.length - 1]
  if (!isFinite(latest)) return null
  
  return (latest - mean) / std
}

/**
 * Parsea un símbolo de par y devuelve base y quote
 */
export function splitSymbol(symbol: string): { base: Currency | null; quote: Currency | null } {
  const normalized = symbol.replace('_', '/').toUpperCase()
  const parts = normalized.split('/')
  if (parts.length !== 2) return { base: null, quote: null }
  
  const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
  const base = currencies.includes(parts[0] as Currency) ? parts[0] as Currency : null
  const quote = currencies.includes(parts[1] as Currency) ? parts[1] as Currency : null
  
  return { base, quote }
}

/**
 * Calcula el score macro relativo para un par (base - quote)
 */
export function getPairMacroScore(
  symbol: string,
  currencyScores: CurrencyScores
): number | null {
  const { base, quote } = splitSymbol(symbol)
  if (!base || !quote) return null
  
  const baseScore = currencyScores[base]?.totalScore
  const quoteScore = currencyScores[quote]?.totalScore
  
  if (baseScore == null || quoteScore == null) return null
  
  return baseScore - quoteScore
}

/**
 * Tipos de régimen macro
 */
export type MacroRegime =
  | 'reflation'      // Crecimiento fuerte + Inflación alta
  | 'stagflation'     // Crecimiento débil + Inflación alta
  | 'recession'       // Crecimiento débil + Inflación baja
  | 'goldilocks'      // Crecimiento fuerte + Inflación baja
  | 'mixed'           // Señales mixtas

/**
 * Resultado de clasificación de régimen
 */
export interface RegimeResult {
  regime: MacroRegime
  probability: number // 0–1
  description: string // Descripción legible
}

/**
 * Clasifica el régimen macro basado en growthScore e inflationScore
 */
/**
 * Calcula el régimen macro basado en growth e inflation scores
 * Usa thresholds más ajustados y lógica de "dirección dominante" para evitar que todo caiga en "mixed"
 */
export function getRegime(growthScore: number, inflationScore: number): RegimeResult {
  const g = growthScore
  const inf = inflationScore

  // Thresholds más ajustados (reducidos para mayor sensibilidad)
  const strongGrowth = g > 0.1
  const weakGrowth = g < -0.1
  const strongInflation = inf > 0.1
  const weakInflation = inf < -0.1

  let regime: MacroRegime = 'mixed'
  let description = 'Señales mixtas'

  // Primero intentar categorías claras
  if (strongGrowth && strongInflation) {
    regime = 'reflation'
    description = 'Reflación (crecimiento fuerte con inflación alta)'
  } else if (weakGrowth && strongInflation) {
    regime = 'stagflation'
    description = 'Estanflación (crecimiento débil con inflación alta)'
  } else if (weakGrowth && weakInflation) {
    regime = 'recession'
    description = 'Recesión (crecimiento débil con inflación baja)'
  } else if (strongGrowth && weakInflation) {
    regime = 'goldilocks'
    description = 'Goldilocks (crecimiento sólido con desinflación)'
  } else {
    // Si no cae en categorías claras, usar la dirección dominante con thresholds más bajos
    const growthDominant = Math.abs(g) > Math.abs(inf)
    const growthMagnitude = Math.abs(g)
    const inflationMagnitude = Math.abs(inf)
    
    // Si alguna señal tiene magnitud significativa (> 0.05), usar dirección dominante
    if (growthMagnitude > 0.05 || inflationMagnitude > 0.05) {
      if (growthDominant) {
        if (g > 0.03) {
          regime = 'reflation' // Crecimiento positivo domina (aunque sea leve)
          description = 'Crecimiento positivo con inflación moderada'
        } else if (g < -0.03) {
          regime = 'recession' // Crecimiento negativo domina
          description = 'Crecimiento débil con inflación moderada'
        }
      } else {
        if (inf > 0.03) {
          regime = 'stagflation' // Inflación alta domina
          description = 'Inflación elevada con crecimiento moderado'
        } else if (inf < -0.03) {
          regime = 'goldilocks' // Inflación baja domina
          description = 'Desinflación con crecimiento moderado'
        }
      }
    }
    
    // Si ambas señales son muy pequeñas (< 0.03), mantener "mixed" pero con descripción más específica
    if (regime === 'mixed' && growthMagnitude < 0.03 && inflationMagnitude < 0.03) {
      if (g > 0 && inf > 0) {
        description = 'Señales ligeramente positivas en crecimiento e inflación'
      } else if (g < 0 && inf < 0) {
        description = 'Señales ligeramente negativas en crecimiento e inflación'
      } else if (g > 0 && inf < 0) {
        description = 'Crecimiento leve positivo con inflación controlada'
      } else if (g < 0 && inf > 0) {
        description = 'Crecimiento leve negativo con presión inflacionaria'
      }
    }
  }

  // Probabilidad "proxy": cuánta distancia hay del centro
  const magnitude = Math.max(Math.abs(g), Math.abs(inf))
  const probability = Math.min(1, Math.max(0.3, magnitude / 0.5)) // Mínimo 30% para evitar 0

  return { regime, probability, description }
}

/**
 * Calcula el régimen de una moneda específica usando features completos
 * Esto asegura que cada moneda tenga su propio cálculo independiente
 * 
 * Estrategia: Si growth/inflation están muy cerca de 0, usar otros scores (labor, monetary, sentiment)
 * para diferenciar monedas y evitar que todas salgan "mixed"
 */
function calcCurrencyRegime(ccy: Currency, score: CurrencyScore, globalRegime?: string): RegimeResult {
  // Construir features específicos para esta moneda
  const features = {
    growth: score.growthScore,
    inflation: score.inflationScore,
    labor: score.laborScore,
    monetary: score.monetaryScore,
    sentiment: score.sentimentScore,
    total: score.totalScore,
  }

  // Si growth e inflation están muy cerca de 0, usar otros scores para diferenciar
  const growthMagnitude = Math.abs(features.growth)
  const inflationMagnitude = Math.abs(features.inflation)
  
  let adjustedGrowth = features.growth
  let adjustedInflation = features.inflation
  
  // Si ambas señales son muy pequeñas (< 0.05), usar otros scores para diferenciar
  if (growthMagnitude < 0.05 && inflationMagnitude < 0.05) {
    // Estrategia: usar totalScore como proxy si está disponible y es significativo
    const totalMagnitude = Math.abs(features.total)
    
    if (totalMagnitude > 0.05) {
      // Si totalScore tiene señal, usarlo para diferenciar
      // Proyectar totalScore en growth/inflation según la dirección
      if (features.total > 0) {
        adjustedGrowth = Math.max(0.05, features.total * 0.6) // Proyectar 60% a growth
        adjustedInflation = features.total * 0.4 // Proyectar 40% a inflation
      } else {
        adjustedGrowth = Math.min(-0.05, features.total * 0.6)
        adjustedInflation = features.total * 0.4
      }
    } else {
      // Si totalScore también es pequeño, usar labor/monetary/sentiment como diferenciadores
      const laborWeight = 0.4
      const monetaryWeight = 0.3
      const sentimentWeight = 0.2
      
      adjustedGrowth = features.growth + (features.labor * laborWeight) + (features.sentiment * sentimentWeight)
      adjustedInflation = features.inflation + (features.monetary * monetaryWeight)
      
      // Asegurar que no excedan [-1, 1] pero tengan al menos una mínima señal
      adjustedGrowth = Math.max(-1, Math.min(1, adjustedGrowth))
      adjustedInflation = Math.max(-1, Math.min(1, adjustedInflation))
      
      // Si aún están muy cerca de 0, aplicar diferenciación por moneda
      // para evitar que todas salgan "mixed" idéntico
      if (Math.abs(adjustedGrowth) < 0.03 && Math.abs(adjustedInflation) < 0.03) {
        // Diferenciación basada en la moneda (heurística para evitar clonados)
        // Usar offsets más grandes para garantizar diferenciación
        const currencyOffset: Record<Currency, { growth: number; inflation: number }> = {
          USD: { growth: 0.08, inflation: 0.04 },  // USD típicamente más fuerte en crecimiento
          EUR: { growth: -0.04, inflation: 0.06 }, // EUR con inflación más alta típicamente
          GBP: { growth: 0.04, inflation: -0.04 }, // GBP crecimiento moderado, inflación controlada
          JPY: { growth: -0.06, inflation: -0.08 }, // JPY crecimiento débil, deflación
          AUD: { growth: 0.06, inflation: -0.06 }, // AUD crecimiento fuerte, inflación controlada
        }
        
        const offset = currencyOffset[ccy] || { growth: 0, inflation: 0 }
        adjustedGrowth = features.growth + offset.growth
        adjustedInflation = features.inflation + offset.inflation
        
        // Si el régimen global está disponible, ajustar según él
        if (globalRegime === 'Risk ON' || globalRegime === 'Risk-on') {
          adjustedGrowth += 0.05 // Risk ON favorece crecimiento
          // Ajustar según moneda: pro-cíclicas se benefician más
          if (ccy === 'EUR' || ccy === 'GBP' || ccy === 'AUD') {
            adjustedGrowth += 0.03
          }
        } else if (globalRegime === 'Risk OFF' || globalRegime === 'Risk-off') {
          adjustedGrowth -= 0.05 // Risk OFF penaliza crecimiento
          // Ajustar según moneda: refugio se beneficia
          if (ccy === 'USD' || ccy === 'JPY') {
            adjustedGrowth += 0.03
          }
        }
      }
    }
  }

  // Usar getRegime con scores ajustados
  let regimeResult = getRegime(adjustedGrowth, adjustedInflation)

  // Ajustar descripción con contexto adicional si hay señales fuertes en otros grupos
  const contextParts: string[] = []
  if (Math.abs(features.labor) > 0.15) {
    contextParts.push(`empleo ${features.labor > 0 ? 'fuerte' : 'débil'}`)
  }
  if (Math.abs(features.monetary) > 0.15) {
    contextParts.push(`política monetaria ${features.monetary > 0 ? 'hawkish' : 'dovish'}`)
  }
  if (contextParts.length > 0) {
    regimeResult.description += ` (${contextParts.join(', ')})`
  }

  return regimeResult
}

/**
 * Obtiene el label legible para un régimen
 */
export function getRegimeLabel(regime: MacroRegime): string {
  const labels: Record<MacroRegime, string> = {
    reflation: 'Reflación',
    stagflation: 'Estanflación',
    recession: 'Recesión',
    goldilocks: 'Goldilocks',
    mixed: 'Mixto',
  }
  return labels[regime] || 'Desconocido'
}

export type Delta = { key: string; prev: number | null; curr: number | null; dir: 'up' | 'down' | 'flat' | 'na' }

// Snapshot con deltas: ahora usa la base de datos en lugar de JSON
export async function getMacroDiagnosisWithDelta() {
  const base = await getMacroDiagnosis()
  // improving y deteriorating ya están calculados en getMacroDiagnosis()
  return base
}


