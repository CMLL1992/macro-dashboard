import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import {
  usdBias as legacyUsdBias,
  getBiasTableTactical as legacyGetBiasTableTactical,
  type BiasRow as LegacyTacticalRow,
} from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'
import { categoryFor } from '@/domain/categories'
import type { LatestPoint } from '@/lib/fred'
import type { LatestPointWithPrev } from '@/lib/db/read-macro'
import {
  getMacroBias,
  getMacroTacticalBias,
  getLatestMacroObservations,
  type LatestMacroObservations,
} from '@/lib/db/read'
import { logger } from '@/lib/obs/logger'

type USDBiasRaw = {
  score: number
  direction: 'Bullish' | 'Bearish' | 'Neutral'
  components: Record<string, number | null>
}

type QuadRaw = {
  cpi_trend: number
  gdp_trend: number
  pmi_level?: number | null
  employment_trend?: number
  classification: string
}

type LiquidityRaw = {
  walcl_change: number
  rrp_change: number
  tga_change: number
  m2_trend: number
}

type CreditRaw = {
  yield_curve: number
  credit_spreads: number
  spread_change: number
  classification: string
}

type RiskRaw = {
  usdBiasSignal: string
  liquidityRegime: string
  quadRegime: string
  creditRegime: string
  usdScore: number
}

export type BiasRow = {
  key: string
  label: string
  value: number | null
  value_previous: number | null
  trend?: string | null
  posture?: string | null
  weight?: number | null
  category?: string
  date?: string | null
  date_previous?: string | null
  observation_period?: string | null // Periodo del dato (observation_date) para mostrar en tooltip
  originalKey?: string | null
  unit?: string | null
}

export type TacticalBiasRow = {
  pair: string
  symbol?: string | null
  trend: string
  action: string
  confidence: string
  tactico?: string | null
  accion?: string | null
  confianza?: string | null
  motivo?: string | null
  benchmark?: string | null
  corr12m?: number | null
  corr3m?: number | null
  motive?: string
  last_relevant_event?: {
    currency: string
    name: string
    surprise_direction: string
    surprise_score: number
    release_time_utc: string
  } | null
  updated_after_last_event?: boolean
}

export type BiasState = {
  updatedAt: Date
  regime: {
    overall: string
    usd_direction: string
    quad: string
    liquidity: string
    credit: string
    risk: string
  }
  currencyRegimes?: {
    USD?: { regime: string; probability: number; description: string }
    EUR?: { regime: string; probability: number; description: string }
    GBP?: { regime: string; probability: number; description: string }
    JPY?: { regime: string; probability: number; description: string }
    AUD?: { regime: string; probability: number; description: string }
  }
  metrics: {
    usdScore: number
    quadScore: number
    liquidityScore: number | null
    creditScore: number | null
    riskScore: number | null
  }
  table: BiasRow[]
  tableTactical: TacticalBiasRow[]
}

type BiasRawPayload = {
  latestPoints: LatestPoint[]
  table: BiasRow[]
  tableTactical: TacticalBiasRow[]
  latestObservations: LatestMacroObservations
  updatedAt: Date
  currencyRegimes?: {
    USD?: { regime: string; probability: number; description: string }
    EUR?: { regime: string; probability: number; description: string }
    GBP?: { regime: string; probability: number; description: string }
    JPY?: { regime: string; probability: number; description: string }
    AUD?: { regime: string; probability: number; description: string }
  }
}

const SERIES_ALIASES = {
  WALCL: ['WALCL'],
  RRP: ['RRPONTSYD', 'RRPONTSYEA'],
  TGA: ['WTREGEN', 'TGA'],
  M2: ['WM2NS', 'M2SL'],
  HY_SPREAD: ['BAMLH0A0HYM2EY', 'BAMLH0A0HYM2'],
  IG_SPREAD: ['BAMLCC0A0CMTRIV', 'BAMLC0A0CM'],
}

const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value))

const EPS = 1e-6

function getMetric(rows: BiasRow[], keys: string[]): BiasRow | undefined {
  for (const key of keys) {
    const found = rows.find(
      (row) =>
        row.key?.toLowerCase() === key.toLowerCase() ||
        row.originalKey?.toLowerCase() === key.toLowerCase()
    )
    if (found) return found
  }
  return undefined
}

function deltaOf(row?: BiasRow | null): number {
  if (!row) return 0
  if (row.value == null || row.value_previous == null) return 0
  return row.value - row.value_previous
}

function getSeriesSnapshot(observations: LatestMacroObservations, aliases: string[]) {
  for (const alias of aliases) {
    const entry = observations.series.get(alias)
    if (entry) {
      const delta =
        entry.latestValue != null && entry.previousValue != null
          ? entry.latestValue - entry.previousValue
          : 0
      return {
        latest: entry.latestValue ?? null,
        previous: entry.previousValue ?? null,
        delta,
      }
    }
  }
  return { latest: null, previous: null, delta: 0 }
}

export async function getBiasRaw(): Promise<BiasRawPayload> {
  const diagnosis = await getMacroDiagnosisWithDelta()
  if (!diagnosis || !diagnosis.items) {
    throw new Error('getMacroDiagnosisWithDelta returned invalid data')
  }
  const latestPoints = (diagnosis.items || []) as LatestPoint[]
  const corrMap = await getCorrMap()
  const usdStrength = legacyUsdBias(latestPoints)
  const currencyScores = (diagnosis as any).currencyScores // Obtener currencyScores del diagnosis
  const currencyRegimes = (diagnosis as any).currencyRegimes // Obtener currencyRegimes del diagnosis
  
  const legacyRows = await legacyGetBiasTableTactical(
    latestPoints,
    diagnosis.regime,
    usdStrength,
    diagnosis.score,
    [],
    corrMap,
    currencyScores // Pasar currencyScores a getBiasTableTactical
  )

  let tacticalRows = getBiasTableTactical(legacyRows)
  
  // Enrich tactical rows with correlations from DB (batch query to avoid N+1)
  // This ensures correlations are populated even if corrFromDB didn't work
  if (tacticalRows.length > 0) {
    try {
      const { getCorrelationsForSymbols } = await import('@/lib/db/read')
      const symbols = tacticalRows
        .map((row) => (row.pair ?? row.symbol ?? '').replace('/', '').toUpperCase())
        .filter((s) => s.length > 0)
        .filter((s, i, arr) => arr.indexOf(s) === i) // Deduplicate
      
      if (symbols.length > 0) {
        const correlationsMap = await getCorrelationsForSymbols(symbols, 'DXY')
        
        // Debug: log what we got from DB
        if (process.env.DEBUG_DASHBOARD === 'true' || process.env.NODE_ENV === 'development') {
          console.log('[macro-engine/bias] Enriching correlations:', {
            symbolsRequested: symbols,
            correlationsFound: Array.from(correlationsMap.entries()).map(([sym, corr]) => ({
              symbol: sym,
              corr12m: corr.corr12m,
              corr3m: corr.corr3m,
            })),
          })
        }
        
        // Only update if we got results (map might be empty on error, but that's OK)
        tacticalRows = tacticalRows.map((row) => {
          const symbol = (row.pair ?? row.symbol ?? '').replace('/', '').toUpperCase()
          if (!symbol) return row
          
          const dbCorr = correlationsMap.get(symbol)
          // Use DB correlations if available, otherwise keep existing (from corrFromDB/corrMap)
          // Only update if we have a valid correlation value
          if (dbCorr && (dbCorr.corr12m != null || dbCorr.corr3m != null)) {
            return {
              ...row,
              corr12m: dbCorr.corr12m ?? row.corr12m ?? null,
              corr3m: dbCorr.corr3m ?? row.corr3m ?? null,
            }
          }
          // Keep existing correlations if DB didn't have them
          return row
        })
      }
    } catch (error) {
      logger.warn('[macro-engine/bias] Failed to enrich correlations from DB', { 
        error: error instanceof Error ? error.message : String(error),
        tacticalRowsCount: tacticalRows.length
      })
      // Continue without DB correlations, use existing ones from corrMap
      // This is safe - we keep the original row with corrMap correlations
    }
  }

  if (!tacticalRows.length) {
    const cached = await getMacroTacticalBias()
    if (cached.length) {
      tacticalRows = cached.map((row) => {
        const direction = row.direction ?? 'neutral'
        return {
          pair: row.symbol,
          trend:
            direction === 'long'
              ? 'Alcista'
              : direction === 'short'
                ? 'Bajista'
                : 'Neutral',
          action:
            direction === 'long'
              ? 'Buscar compras'
              : direction === 'short'
                ? 'Buscar ventas'
                : 'Rango/táctico',
          confidence: row.confidence >= 0.7 ? 'Alta' : row.confidence >= 0.4 ? 'Media' : 'Baja',
          corr12m: null,
          corr3m: null,
          motive: 'Generado desde macro_bias cache',
        }
      })
    } else {
      const spx = await getMacroBias('SPX')
      if (spx?.bias) {
        tacticalRows = [
          {
            pair: 'SPX',
            trend:
              spx.bias.direction === 'long'
                ? 'Alcista'
                : spx.bias.direction === 'short'
                  ? 'Bajista'
                  : 'Neutral',
            action:
              spx.bias.direction === 'long'
                ? 'Buscar compras'
                : spx.bias.direction === 'short'
                  ? 'Buscar ventas'
                  : 'Rango/táctico',
            confidence: spx.bias.confidence >= 0.7 ? 'Alta' : 'Media',
            corr12m: null,
            corr3m: null,
            motive: 'Derivado de macro_bias(SPX)',
          },
        ]
      }
    }
  }

  const observations = await getLatestMacroObservations()
  // updatedAt siempre es la fecha/hora actual del cálculo (no la fecha de los datos)
  // Esto refleja cuándo se calculó el bias state, no cuándo se actualizaron los datos macro
  const updatedAt = new Date()

  // Import WEIGHTS and MAP_KEY_TO_WEIGHT_KEY once before the map
  const { WEIGHTS } = await import('@/domain/posture')
  const { MAP_KEY_TO_WEIGHT_KEY } = await import('@/domain/diagnostic')
  
  // Validate imports
  if (!WEIGHTS || !MAP_KEY_TO_WEIGHT_KEY) {
    throw new Error('Failed to load WEIGHTS or MAP_KEY_TO_WEIGHT_KEY')
  }
  
  const table: BiasRow[] = latestPoints.map((item: LatestPointWithPrev) => {
    // Skip if item is null or undefined
    if (!item) {
      return null
    }
    
    // Ensure date is converted from undefined to null for consistency
    const dateValue = item.date ?? null
    const datePreviousValue = item.date_previous ?? null
    const observationPeriod = item.observation_period ?? null
    
    // Get weight - calculate from key (LatestPointWithPrev doesn't have weight property)
    let weight: number | null = null
    const originalKey = (item as any).originalKey ?? item.key ?? null
    
    if (weight == null && originalKey) {
      // Fallback: try to get weight from WEIGHTS using the key
      const weightKey = (MAP_KEY_TO_WEIGHT_KEY && MAP_KEY_TO_WEIGHT_KEY[originalKey]) ? MAP_KEY_TO_WEIGHT_KEY[originalKey] : (item.key ?? originalKey)
      weight = (WEIGHTS && weightKey) ? (WEIGHTS[weightKey] ?? null) : null
      
      // DEBUG: Log for corepce_yoy specifically
      if (originalKey === 'corepce_yoy') {
        console.log(`[getBiasRaw] DEBUG corepce_yoy:`, {
          key: item.key,
          originalKey,
          weightKey,
          weightFromWEIGHTS: WEIGHTS[weightKey],
          finalWeight: weight,
        })
      }
    }
    
    // DEBUG: Log for indicators without weight (corepce_yoy, pmi_mfg, jolts_openings_yoy)
    if (weight == null && (originalKey === 'corepce_yoy' || originalKey === 'pmi_mfg' || originalKey === 'jolts_openings')) {
      const debugWeightKey = (MAP_KEY_TO_WEIGHT_KEY && originalKey) ? MAP_KEY_TO_WEIGHT_KEY[originalKey] : null
      console.log(`[getBiasRaw] DEBUG: Indicator without weight:`, {
        key: item.key,
        originalKey,
        weight,
        weightKey: debugWeightKey,
        weightFromWEIGHTS: (debugWeightKey && WEIGHTS) ? WEIGHTS[debugWeightKey] : null,
      })
    }
    
    return {
      key: item.key ?? null,
      label: item.label ?? null,
      value: item.value ?? null,
      value_previous: item.value_previous ?? null,
      trend: (item as any).trend ?? null,
      posture: (item as any).posture ?? null,
      weight: weight,
      category: (item as any).category ?? categoryFor(item.key ?? originalKey ?? ''),
      date: dateValue,
      date_previous: datePreviousValue,
      observation_period: observationPeriod,
      originalKey: originalKey,
      unit: item.unit ?? null,
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null)
  
  // DEBUG: Log final European rows in table
  const euRows = table.filter(r => (r.originalKey ?? r.key ?? '').startsWith('eu_'))
  if (euRows.length > 0) {
    console.log('[getBiasRaw] DEBUG: Final European rows in table:', euRows.map(r => ({
      key: r.key,
      originalKey: r.originalKey,
      value: r.value,
      label: r.label,
    })))
  }

  // Convertir currencyRegimes del diagnosis al formato esperado
  const regimes: BiasRawPayload['currencyRegimes'] = currencyRegimes ? {
    USD: currencyRegimes.USD ? {
      regime: currencyRegimes.USD.regime,
      probability: currencyRegimes.USD.probability,
      description: currencyRegimes.USD.description,
    } : undefined,
    EUR: currencyRegimes.EUR ? {
      regime: currencyRegimes.EUR.regime,
      probability: currencyRegimes.EUR.probability,
      description: currencyRegimes.EUR.description,
    } : undefined,
    GBP: currencyRegimes.GBP ? {
      regime: currencyRegimes.GBP.regime,
      probability: currencyRegimes.GBP.probability,
      description: currencyRegimes.GBP.description,
    } : undefined,
    JPY: currencyRegimes.JPY ? {
      regime: currencyRegimes.JPY.regime,
      probability: currencyRegimes.JPY.probability,
      description: currencyRegimes.JPY.description,
    } : undefined,
    AUD: currencyRegimes.AUD ? {
      regime: currencyRegimes.AUD.regime,
      probability: currencyRegimes.AUD.probability,
      description: currencyRegimes.AUD.description,
    } : undefined,
  } : undefined

  return {
    latestPoints,
    table,
    tableTactical: tacticalRows,
    latestObservations: observations,
    updatedAt,
    currencyRegimes: regimes,
  }
}

export function getUSDBias(latestPoints: LatestPoint[]) {
  const getValue = (keys: string[]) => {
    for (const key of keys) {
      const point = latestPoints.find(
        (item) => item.key?.toLowerCase() === key.toLowerCase()
      )
      if (point?.value != null) return point.value
    }
    return null
  }

  const dxy = getValue(['twex', 'DTWEXBGS'])
  const t10y2y = getValue(['t10y2y', 'T10Y2Y'])
  const t10y3m = getValue(['t10y3m', 'T10Y3M'])
  const pce = getValue(['pce_yoy', 'PCEPI'])
  const gdp = getValue(['gdp_yoy', 'GDPC1'])

  const normalize = (value: number | null, divisor: number) =>
    value == null ? 0 : clamp(value / divisor, -1, 1)

  const dxyNorm = normalize(dxy, 10)
  const curveNorm = normalize((t10y2y ?? 0) - (t10y3m ?? 0), 1)
  const pceNorm = normalize(pce, 5)
  const gdpNorm = normalize(gdp, 5)

  const score = clamp((dxyNorm + curveNorm - pceNorm + gdpNorm) / 4, -1, 1)
  const regime: 'Bullish' | 'Bearish' | 'Neutral' =
    score > 0.25 ? 'Bullish' : score < -0.25 ? 'Bearish' : 'Neutral'

  const components = { dxy, t10y2y, t10y3m, pce, gdp }

  const raw: USDBiasRaw = {
    score,
    direction: regime,
    components,
  }

  return { score, regime, raw }
}

export function getQuad(table: BiasRow[]) {
  const cpiRow = getMetric(table, ['cpi_yoy', 'CPIAUCSL'])
  const gdpRow = getMetric(table, ['gdp_yoy', 'GDPC1'])
  const cpiTrend = deltaOf(cpiRow)
  const gdpTrend = deltaOf(gdpRow)

  let classification = 'Expansivo'
  if (cpiTrend < 0 && gdpTrend > 0) classification = 'Goldilocks'
  else if (cpiTrend < 0 && gdpTrend < 0) classification = 'Recesivo'
  else if (cpiTrend > 0 && gdpTrend < 0) classification = 'Stagflation'
  else if (cpiTrend > 0 && gdpTrend > 0) classification = 'Expansivo'

  const cpiScore = cpiTrend < 0 ? 1 : -1
  const gdpScore = gdpTrend > 0 ? 1 : -1
  const score = clamp((cpiScore + gdpScore) / 2, -1, 1)

  const raw: QuadRaw = {
    cpi_trend: cpiTrend,
    gdp_trend: gdpTrend,
    pmi_level: getMetric(table, ['pmi', 'PMI'])?.value ?? null,
    employment_trend: deltaOf(getMetric(table, ['payems_delta', 'PAYEMS'])),
    classification,
  }

  return { score, regime: classification, raw }
}

export function getLiquidityRegime(observations: LatestMacroObservations) {
  const walcl = getSeriesSnapshot(observations, SERIES_ALIASES.WALCL)
  const rrp = getSeriesSnapshot(observations, SERIES_ALIASES.RRP)
  const tga = getSeriesSnapshot(observations, SERIES_ALIASES.TGA)
  const m2 = getSeriesSnapshot(observations, SERIES_ALIASES.M2)

  const z = (value: number) => {
    if (!value) return 0
    const std = Math.max(1, Math.abs(value))
    return value / std
  }

  let regime = 'Medium'
  if (walcl.delta > 0 && rrp.delta < 0) regime = 'High'
  if (walcl.delta < 0 && rrp.delta > 0) regime = 'Low'
  if (tga.delta > 0) regime = 'Contracting'
  if (
    Math.abs(walcl.delta) < 1 &&
    Math.abs(rrp.delta) < 1 &&
    Math.abs(tga.delta) < 1
  ) {
    regime = 'Medium'
  }

  const score = clamp(z(walcl.delta) - z(rrp.delta) - z(tga.delta) + z(m2.delta), -1, 1)

  const raw: LiquidityRaw = {
    walcl_change: walcl.delta,
    rrp_change: rrp.delta,
    tga_change: tga.delta,
    m2_trend: m2.delta,
  }

  return { score, regime, raw }
}

export function getCreditStress(
  table: BiasRow[],
  observations: LatestMacroObservations
) {
  const yieldCurve = getMetric(table, ['t10y2y', 'T10Y2Y'])?.value ?? 0
  const spreads =
    getSeriesSnapshot(observations, SERIES_ALIASES.HY_SPREAD).latest ??
    getSeriesSnapshot(observations, SERIES_ALIASES.IG_SPREAD).latest ??
    0
  const spreadDelta =
    getSeriesSnapshot(observations, SERIES_ALIASES.HY_SPREAD).delta ??
    0

  const spreadNorm = clamp((spreads ?? 0) / 500, -1, 1)
  const curveNorm = clamp((yieldCurve ?? 0) / 1, -1, 1)
  const score = clamp(spreadNorm - curveNorm, -1, 1)

  let regime: 'Low' | 'Medium' | 'Stress High' = 'Medium'
  if (score > 0.4) regime = 'Stress High'
  else if (score < -0.3) regime = 'Low'

  const raw: CreditRaw = {
    yield_curve: yieldCurve,
    credit_spreads: spreads,
    spread_change: spreadDelta,
    classification: regime,
  }

  return { score, regime, raw }
}

export function getRiskAppetite(params: {
  usdScore: number
  usdRegime: 'Bullish' | 'Bearish' | 'Neutral'
  liquidityScore: number
  liquidityRegime: string
  quadScore: number
  quadRegime: string
  creditScore: number
  creditRegime: string
}) {
  let baseScore = clamp(
    -params.usdScore +
      params.liquidityScore +
      params.quadScore * 0.5 -
      params.creditScore,
    -1,
    1
  )

  let heuristicAdjustment = 0

  if (params.usdRegime === 'Bullish' && params.liquidityRegime === 'Low') {
    heuristicAdjustment -= 0.5
  }

  if (
    params.usdRegime === 'Bearish' &&
    params.liquidityRegime === 'High' &&
    params.quadRegime === 'Goldilocks'
  ) {
    heuristicAdjustment += 0.5
  }

  if (params.creditRegime === 'Stress High') {
    heuristicAdjustment -= 0.5
  }

  const finalScore = clamp(baseScore + heuristicAdjustment, -1, 1)

  let regime: 'Risk ON' | 'Risk OFF' | 'Neutral' =
    finalScore > 0.25 ? 'Risk ON' : finalScore < -0.25 ? 'Risk OFF' : 'Neutral'

  return {
    score: finalScore,
    regime,
    raw: {
      usdBiasSignal: params.usdRegime,
      liquidityRegime: params.liquidityRegime,
      quadRegime: params.quadRegime,
      creditRegime: params.creditRegime,
      usdScore: params.usdScore,
    } satisfies RiskRaw,
  }
}

export function getBiasTable(rows: BiasRow[]): BiasRow[] {
  return rows.map((row) => ({
    ...row,
    trend: row.trend ?? null,
    posture: row.posture ?? null,
    value: row.value ?? null,
    value_previous: row.value_previous ?? null,
    category: row.category ?? 'Otros',
    label: row.label ?? row.key ?? '',
    date: row.date ?? null,
    observation_period: row.observation_period ?? null,
    weight: row.weight ?? null,
    originalKey: row.originalKey ?? row.key ?? null,
    unit: row.unit ?? null,
  }))
}

export function getBiasTableTactical(rows: LegacyTacticalRow[]): TacticalBiasRow[] {
  return rows.map((row: LegacyTacticalRow) => {
    const legacy = row as LegacyTacticalRow & { 
      symbol?: string | null
      benchmark?: string | null
      corr12m?: number | null
      corr3m?: number | null
    }

    return {
      pair: legacy.par,
      symbol: legacy.symbol ?? legacy.par ?? null,
      trend: legacy.tactico ?? 'Neutral',
      action: legacy.accion ?? 'Rango/táctico',
      confidence: legacy.confianza ?? 'Media',
      tactico: legacy.tactico ?? null,
      accion: legacy.accion ?? null,
      confianza: legacy.confianza ?? null,
      motivo: legacy.motivo ?? null,
      benchmark: legacy.benchmark ?? null,
      corr12m: legacy.corr12m ?? null,
      corr3m: legacy.corr3m ?? null,
      motive: legacy.motivo,
    }
  })
}

export async function getBiasState(): Promise<BiasState> {
  try {
    const raw = await getBiasRaw()
    const usd = getUSDBias(raw.latestPoints)
    const quad = getQuad(raw.table)
    const liquidity = getLiquidityRegime(raw.latestObservations)
    const credit = getCreditStress(raw.table, raw.latestObservations)
    const risk = getRiskAppetite({
      usdScore: usd.score,
      usdRegime: usd.regime,
      liquidityScore: liquidity.score,
      liquidityRegime: liquidity.regime,
      quadScore: quad.score,
      quadRegime: quad.regime,
      creditScore: credit.score,
      creditRegime: credit.regime,
    })

    const table = getBiasTable(raw.table)
    const tableTactical = raw.tableTactical

    return {
      updatedAt: raw.updatedAt,
      regime: {
        overall: risk.regime,
        usd_direction: usd.regime,
        quad: quad.regime,
        liquidity: liquidity.regime,
        credit: credit.regime,
        risk: risk.regime,
      },
      currencyRegimes: raw.currencyRegimes,
      metrics: {
        usdScore: usd.score,
        quadScore: quad.score,
        liquidityScore: liquidity.score,
        creditScore: credit.score,
        riskScore: risk.score,
      },
      table,
      tableTactical,
    }
  } catch (error) {
    logger.error('[macro-engine/bias] Failed to build BiasState', { 
      error: error instanceof Error ? error.message : String(error) 
    })
    throw error
  }
}

export default getBiasState

