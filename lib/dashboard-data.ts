/**
 * Centralized dashboard data fetching
 * Reads all data from SQLite database only (no external API calls)
 * 
 * This is the single source of truth for dashboard data.
 * All data should come from tables populated by automated jobs.
 */

import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { detectScenarios } from '@/domain/scenarios'
import type { BiasState } from '@/domain/macro-engine/bias'
import type { CorrelationState } from '@/domain/macro-engine/correlations'

export type IndicatorRow = {
  key: string
  label: string
  category: string
  previous: number | null
  value: number | null
  trend: string | null
  posture: string | null
  weight: number | null
  date: string | null
  originalKey?: string | null
  unit?: string | null
  isStale?: boolean
}

export type TacticalRowSafe = {
  pair: string
  trend: string
  action: string
  confidence: string
  corr12m?: number | null
  corr3m?: number | null
}

export type Scenario = {
  id: string
  title: string
  severity: string
  actionHint: string
}

export type CorrInsight = {
  usdBiasSignal: string
  strongPairs: string[]
  decoupledPairs: string[]
}

export type UsdMarketInsights = {
  topPairsSummary: string
  actionBiasSummary: string
  divergenceSummary: string
}

export type DashboardData = {
  // Régimen
  regime: {
    overall: string
    usd_direction: string
    usd_label: 'Fuerte' | 'Débil' | 'Neutral'
    quad: string
    liquidity: string
    credit: string
    risk: string
  }
  
  // Métricas
  metrics: {
    usdScore: number
    quadScore: number
    liquidityScore: number | null
    creditScore: number | null
    riskScore: number | null
  }
  
  // Datos principales
  indicators: IndicatorRow[]
  tacticalRows: TacticalRowSafe[]
  scenarios: Scenario[]
  
  // Correlaciones
  correlations: {
    count: number
    summary: CorrelationState['summary']
    shifts: CorrelationState['shifts']
  }
  
  // Insights
  corrInsight: CorrInsight
  usdMarketInsights: UsdMarketInsights
  
  // Metadatos
  latestDataDate: string | null
  updatedAt: string | null
  
  // Timestamps
  biasUpdatedAt: Date
  correlationUpdatedAt: Date
}

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

function buildIndicatorRows(table: any[]): IndicatorRow[] {
  return table.map((row) => ({
    key: row.key ?? row.originalKey ?? '',
    label: row.label ?? row.key ?? '',
    category: row.category ?? 'Otros',
    previous: row.value_previous ?? row.previous ?? null,
    value: row.value ?? null,
    trend: row.trend ?? null,
    posture: row.posture ?? null,
    weight: row.weight ?? null,
    date: row.date ?? null,
    originalKey: row.originalKey ?? row.key ?? null,
    unit: row.unit ?? null,
    isStale: row.isStale ?? false,
  }))
}

function buildScenarioItems(table: any[]) {
  return table.map((row) => ({
    key: row.key ?? row.originalKey ?? '',
    label: row.label ?? row.key ?? '',
    value: row.value ?? null,
    value_previous: row.value_previous ?? null,
    trend: row.trend ?? null,
    posture: row.posture ?? null,
    weight: row.weight ?? null,
    category: row.category ?? 'Otros',
    date: row.date ?? null,
    originalKey: row.originalKey ?? row.key ?? null,
  }))
}

function buildTacticalSafe(rows: any[]): TacticalRowSafe[] {
  return rows.map((row) => ({
    pair: row.pair ?? row.par ?? row.symbol ?? '',
    trend: row.trend ?? row.tactico ?? 'Neutral',
    action: row.action ?? row.accion ?? 'Rango/táctico',
    confidence: row.confidence ?? row.confianza ?? 'Media',
    corr12m: row.corr12m ?? null,
    corr3m: row.corr3m ?? null,
  }))
}

function deriveLatestDataDate(rows: IndicatorRow[]): string | null {
  let latest: string | null = null
  for (const row of rows) {
    if (!row.date) continue
    if (!latest || row.date > latest) {
      latest = row.date
    }
  }
  return latest
}

function buildCorrInsight(tacticalRows: any[]): CorrInsight {
  if (!Array.isArray(tacticalRows) || tacticalRows.length === 0) {
    return {
      usdBiasSignal: 'Sin señal clara (no hay datos suficientes)',
      strongPairs: [],
      decoupledPairs: [],
    }
  }

  const MIN_STRONG = 0.6
  const MIN_DECOUPLED_12 = 0.4
  const MAX_DECOUPLED_3 = 0.25

  const validRows = tacticalRows.filter(
    (r: any) => typeof r.corr12m === 'number' || typeof r.corr3m === 'number'
  )

  const strong12 = validRows.filter(
    (r: any) => typeof r.corr12m === 'number' && Math.abs(r.corr12m) >= MIN_STRONG
  )

  const pos = strong12.filter((r: any) => (r.corr12m as number) > 0).length
  const neg = strong12.filter((r: any) => (r.corr12m as number) < 0).length

  let usdBiasSignal = 'Señal mixta / indefinida'
  if (pos + neg === 0) {
    usdBiasSignal = 'Sin señal clara (pocas correlaciones fuertes con el USD)'
  } else if (pos >= 2 * neg) {
    usdBiasSignal = 'Conjunto de activos muy alineado con un USD fuerte'
  } else if (neg >= 2 * pos) {
    usdBiasSignal = 'Conjunto de activos muy alineado con un USD débil'
  } else {
    usdBiasSignal = 'Señal mixta: hay correlaciones fuertes en ambos sentidos'
  }

  const decoupled = validRows.filter(
    (r: any) =>
      typeof r.corr12m === 'number' &&
      Math.abs(r.corr12m as number) >= MIN_DECOUPLED_12 &&
      (r.corr3m == null || Math.abs(r.corr3m as number) <= MAX_DECOUPLED_3)
  )

  const strongPairs = strong12
    .slice()
    .sort((a: any, b: any) => String(a.pair ?? a.par).localeCompare(String(b.pair ?? b.par)))
    .map((r: any) => String(r.pair ?? r.par ?? '—'))

  const decoupledPairs = decoupled
    .slice()
    .sort((a: any, b: any) => String(a.pair ?? a.par).localeCompare(String(b.pair ?? b.par)))
    .map((r: any) => String(r.pair ?? r.par ?? '—'))

  return { usdBiasSignal, strongPairs, decoupledPairs }
}

function buildUsdMarketInsights(rows: TacticalRowSafe[]): UsdMarketInsights {
  if (!rows.length) {
    return {
      topPairsSummary: 'Sin pares destacados (no hay datos).',
      actionBiasSummary: 'Sin sesgo detectado (faltan pares USD).',
      divergenceSummary: 'Sin divergencias relevantes.',
    }
  }

  const corrRows = rows
    .filter((row) => typeof row.corr12m === 'number')
    .sort(
      (a, b) =>
        Math.abs((b.corr12m as number) ?? 0) - Math.abs((a.corr12m as number) ?? 0)
    )

  const topPairs = corrRows
    .slice(0, 2)
    .map((row) => `${row.pair || '—'} (${(row.corr12m as number).toFixed(2)})`)

  const topPairsSummary = topPairs.length
    ? `Pares con correlación USD más marcada: ${topPairs.join(', ')}.`
    : 'Sin pares con correlación fuerte frente al USD.'

  const usdRows = rows.filter((row) =>
    (row.pair || '').toUpperCase().includes('USD')
  )
  const buyBias = usdRows.filter((row) =>
    (row.action || '').toLowerCase().includes('compr')
  ).length
  const sellBias = usdRows.filter((row) =>
    (row.action || '').toLowerCase().includes('venta')
  ).length

  let actionBiasSummary = 'Sin sesgo dominante en pares USD.'
  if (usdRows.length > 0) {
    if (buyBias >= sellBias * 1.5) {
      actionBiasSummary = 'Predomina búsqueda de compras en pares vinculados al USD.'
    } else if (sellBias >= buyBias * 1.5) {
      actionBiasSummary = 'Predomina búsqueda de ventas en pares vinculados al USD.'
    } else {
      actionBiasSummary = 'Sesgo mixto: compras y ventas equilibradas en pares USD.'
    }
  }

  const divergenceRows = rows.filter(
    (row) =>
      typeof row.corr12m === 'number' &&
      typeof row.corr3m === 'number' &&
      (row.corr12m as number) * (row.corr3m as number) < 0 &&
      Math.abs(row.corr12m as number) >= 0.4 &&
      Math.abs(row.corr3m as number) >= 0.2
  )

  const divergenceSummary = divergenceRows.length
    ? `Divergencia destacada en: ${divergenceRows
        .slice(0, 3)
        .map((row) => row.pair || '—')
        .join(', ')}${divergenceRows.length > 3 ? ` (+${divergenceRows.length - 3} más)` : ''}.`
    : 'Correlaciones 3m alineadas con las de 12m.'

  return { topPairsSummary, actionBiasSummary, divergenceSummary }
}

/**
 * Get all dashboard data from database
 * This function ONLY reads from SQLite, no external API calls
 */
export async function getDashboardData(): Promise<DashboardData> {
  // Fetch data in parallel from database
  const [biasState, correlationState] = await Promise.all([
    getBiasState(),
    getCorrelationState(),
  ])

  // Build indicator rows
  const indicatorRows = buildIndicatorRows(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  
  // Build scenario items
  const scenarioItems = buildScenarioItems(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  
  // Build tactical rows
  const tacticalRows = Array.isArray(biasState.tableTactical)
    ? biasState.tableTactical
    : []
  const tacticalRowsSafe = buildTacticalSafe(tacticalRows)

  // Detect scenarios
  let scenarios: Scenario[] = []
  try {
    scenarios = detectScenarios(scenarioItems, biasState.regime.overall)
  } catch (error) {
    console.warn('[dashboard-data] detectScenarios failed, using empty array', error)
    scenarios = []
  }

  // Build insights
  const corrInsight = buildCorrInsight(tacticalRows)
  const usdMarketInsights = buildUsdMarketInsights(tacticalRowsSafe)

  // Get latest data date
  const latestDataDate = deriveLatestDataDate(indicatorRows)
  
  // Format updated at
  const updatedAtIso = biasState.updatedAt
    ? new Date(biasState.updatedAt).toISOString()
    : null

  // Get USD label
  const usdLabel = USD_LABELS[biasState.regime.usd_direction] ?? 'Neutral'

  return {
    regime: {
      overall: biasState.regime.overall,
      usd_direction: biasState.regime.usd_direction,
      usd_label: usdLabel,
      quad: biasState.regime.quad,
      liquidity: biasState.regime.liquidity,
      credit: biasState.regime.credit,
      risk: biasState.regime.risk,
    },
    metrics: {
      usdScore: biasState.metrics.usdScore,
      quadScore: biasState.metrics.quadScore,
      liquidityScore: biasState.metrics.liquidityScore,
      creditScore: biasState.metrics.creditScore,
      riskScore: biasState.metrics.riskScore,
    },
    indicators: indicatorRows,
    tacticalRows: tacticalRowsSafe,
    scenarios,
    correlations: {
      count: correlationState.summary.length,
      summary: correlationState.summary,
      shifts: correlationState.shifts,
    },
    corrInsight,
    usdMarketInsights,
    latestDataDate,
    updatedAt: updatedAtIso,
    biasUpdatedAt: biasState.updatedAt,
    correlationUpdatedAt: correlationState.updatedAt,
  }
}





