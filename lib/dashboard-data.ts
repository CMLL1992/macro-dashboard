/**
 * Centralized dashboard data fetching
 * Reads all data from SQLite database only (no external API calls)
 * 
 * This is the single source of truth for dashboard data.
 * All data should come from tables populated by automated jobs.
 */

import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { detectScenarios, getInstitutionalScenarios } from '@/domain/scenarios'
import type { BiasState } from '@/domain/macro-engine/bias'
import type { CorrelationState } from '@/domain/macro-engine/correlations'
import { WEIGHTS } from '@/domain/posture'
import { MAP_KEY_TO_WEIGHT_KEY } from '@/domain/diagnostic'
import type { BiasRow } from '@/domain/bias'
import { getRecentEventsWithImpact } from '@/lib/db/recent-events'
import type { RecentEventWithImpact } from '@/lib/db/recent-events'

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
  observation_period?: string | null // Periodo del dato (observation_date) para mostrar en tooltip
  originalKey?: string | null
  unit?: string | null
  isStale?: boolean
  section?: string | null
}

export type TacticalRowSafe = {
  pair: string
  trend: string
  action: string
  confidence: string
  corr12m?: number | null
  corr3m?: number | null
  last_relevant_event?: {
    currency: string
    name: string
    surprise_direction: string
    surprise_score: number
    release_time_utc: string
  } | null
  updated_after_last_event?: boolean
}

export type Scenario = {
  id: string
  title: string
  severity: string
  actionHint: string
  // Campos adicionales para escenarios institucionales
  pair?: string
  direction?: 'BUY' | 'SELL'
  confidence?: 'Alta' | 'Media' | 'Baja'
  macroReasons?: string[]
  setupRecommendation?: string
  why?: string
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
  
  // Regímenes macro por moneda (nuevo)
  currencyRegimes?: {
    USD?: { regime: string; probability: number; description: string }
    EUR?: { regime: string; probability: number; description: string }
    GBP?: { regime: string; probability: number; description: string }
    JPY?: { regime: string; probability: number; description: string }
    AUD?: { regime: string; probability: number; description: string }
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
  scenariosActive: Scenario[]      // Confianza Alta
  scenariosWatchlist: Scenario[]    // Confianza Media
  
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
  
  // Eventos recientes
  recentEvents: RecentEventWithImpact[]
  meta: {
    bias_updated_at: string | null
    last_event_applied_at: string | null
  }
}

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

function buildIndicatorRows(table: any[]): IndicatorRow[] {
  // Log raw input for debugging
  if (table.length > 0) {
    console.log('[dashboard-data] buildIndicatorRows - Raw input sample:', {
      key: table[0]?.key,
      value: table[0]?.value,
      value_previous: table[0]?.value_previous,
      previous: table[0]?.previous,
      date: table[0]?.date,
      date_previous: table[0]?.date_previous,
      allKeys: Object.keys(table[0] || {}),
    })
  }
  
  // DEBUG: Log European indicators in raw input
  const euRows = table.filter((r: any) => (r.originalKey ?? r.key ?? '').toString().startsWith('eu_'))
  if (euRows.length > 0) {
    console.log('[dashboard-data] buildIndicatorRows - DEBUG: European rows in raw input:', euRows.map((r: any) => ({
      key: r.key,
      originalKey: r.originalKey,
      value: r.value,
      value_previous: r.value_previous,
      label: r.label,
      date: r.date,
    })))
  }
  
  const rows = table.map((row) => {
    // Use originalKey if available, otherwise use key
    // This ensures European indicators use their original key (eu_cpi_yoy) instead of transformed key (EU_CPI_YOY)
    const finalKey = row.originalKey ?? row.key ?? ''
    
    // Determine section: EUROZONA for EU indicators, undefined for others
    const section = finalKey.startsWith('eu_') ? 'EUROZONA' : undefined
    
    return {
      key: finalKey,
      label: row.label ?? row.key ?? '',
      category: row.category ?? 'Otros',
      previous: row.value_previous ?? row.previous ?? null,
      value: row.value ?? null,
      trend: row.trend ?? null,
      posture: row.posture ?? null,
      weight: row.weight ?? null,
      date: row.date ?? null,
      observation_period: row.observation_period ?? null,
      originalKey: row.originalKey ?? row.key ?? null,
      unit: row.unit ?? null,
      isStale: row.isStale ?? false,
      section: section ?? null,
    }
  })
  
  // Log first row for debugging (only in development or when explicitly enabled)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_DASHBOARD === 'true') {
    if (rows.length > 0) {
      console.log('[dashboard-data] buildIndicatorRows - First row sample:', {
        key: rows[0].key,
        label: rows[0].label,
        value: rows[0].value,
        previous: rows[0].previous,
        date: rows[0].date,
        isStale: rows[0].isStale,
        rawInput: {
          key: table[0]?.key,
          value: table[0]?.value,
          value_previous: table[0]?.value_previous,
          previous: table[0]?.previous,
          date: table[0]?.date,
          isStale: table[0]?.isStale,
        },
      })
    }
  }
  
  // DEBUG: Log final European rows
  const euFinalRows = rows.filter(r => (r.originalKey ?? r.key ?? '').toString().startsWith('eu_'))
  if (euFinalRows.length > 0) {
    console.log('[dashboard-data] buildIndicatorRows - DEBUG: Final European rows:', euFinalRows.map(r => ({
      key: r.key,
      originalKey: r.originalKey,
      value: r.value,
      previous: r.previous,
      label: r.label,
      date: r.date,
      category: r.category,
    })))
    
    // Log specifically CPI indicators
    const cpiRows = euFinalRows.filter(r => r.key.includes('cpi'))
    if (cpiRows.length > 0) {
      console.log('[dashboard-data] buildIndicatorRows - DEBUG: CPI rows specifically:', cpiRows.map(r => ({
        key: r.key,
        value: r.value,
        previous: r.previous,
        date: r.date,
      })))
    }
  }
  
  // Filter: Only show indicators that have weight > 0 in the macro engine
  // This ensures VIX, PCEPI (headline), and other excluded indicators don't appear
  const filteredRows: IndicatorRow[] = rows.filter((row) => {
    // Must have key and label
    if (!row.key || !row.label) return false
    
    // Check if indicator has weight configured
    const finalKey = row.originalKey ?? row.key
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[finalKey] ?? finalKey
    
    // If weight is explicitly set in the row, use it
    if (row.weight != null) {
      return row.weight > 0
    }
    
    // Otherwise check WEIGHTS config
    const weight = WEIGHTS[weightKey]
    return weight != null && weight > 0
  }) as IndicatorRow[]
  
  return filteredRows
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
    last_relevant_event: row.last_relevant_event ?? null,
    updated_after_last_event: row.updated_after_last_event ?? false,
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
  let biasState, correlationState
  try {
    [biasState, correlationState] = await Promise.all([
      getBiasState(),
      getCorrelationState(),
    ])
  } catch (error) {
    console.error('[dashboard-data] Error fetching bias or correlation state:', error)
    // Propagate the original error without wrapping it
    throw error instanceof Error ? error : new Error(String(error))
  }

  // Build indicator rows
  // DEBUG: Log biasState.table before building indicator rows
  const biasTable = Array.isArray(biasState.table) ? biasState.table : []
  const euBiasRows = biasTable.filter((r: any) => (r.originalKey ?? r.key ?? '').toString().startsWith('eu_'))
  if (euBiasRows.length > 0) {
    console.log('[dashboard-data] getDashboardData - DEBUG: European rows in biasState.table:', euBiasRows.map((r: any) => ({
      key: r.key,
      originalKey: r.originalKey,
      value: r.value,
      value_previous: r.value_previous,
      label: r.label,
      date: r.date,
    })))
  }
  
  const indicatorRows = buildIndicatorRows(biasTable)
  
  // Build scenario items
  const scenarioItems = buildScenarioItems(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  
  // Build tactical rows
  const tacticalRows = Array.isArray(biasState.tableTactical)
    ? biasState.tableTactical
    : []
  const tacticalRowsSafe = buildTacticalSafe(tacticalRows)

  // Detect scenarios (método institucional + macro)
  let scenarios: Scenario[] = []
  let scenariosActive: Scenario[] = []
  let scenariosWatchlist: Scenario[] = []
  
  try {
    // Usar el nuevo método institucional que combina macro + confianza + pares tácticos
    const tacticalRowsForScenarios = Array.isArray(biasState.tableTactical)
      ? biasState.tableTactical.map((row: any) => ({
          par: row.pair ?? row.par ?? row.symbol ?? '',
          pair: row.pair ?? row.par ?? row.symbol ?? '',
          sesgoMacro: row.sesgoMacro ?? row.macroBias ?? row.bias ?? '',
          accion: row.accion ?? row.action ?? (row.trend === 'Alcista' ? 'Buscar compras' : row.trend === 'Bajista' ? 'Buscar ventas' : 'Rango/táctico'),
          action: row.action ?? row.accion ?? (row.trend === 'Alcista' ? 'Buscar compras' : row.trend === 'Bajista' ? 'Buscar ventas' : 'Rango/táctico'),
          motivo: row.motivo ?? row.reason ?? '',
          confianza: row.confianza ?? row.confidence ?? 'Media',
          confidence: row.confidence ?? row.confianza ?? 'Media',
          trend: row.trend ?? row.tactico ?? null,
        }))
      : []
    
    const usdBiasLabel = biasState.regime.usd_label || 'Neutral'
    const institutionalScenariosGrouped = getInstitutionalScenarios(
      tacticalRowsForScenarios,
      usdBiasLabel,
      biasState.regime.overall
    )
    
    // Combinar con escenarios tradicionales (si los hay)
    const traditionalScenarios = detectScenarios(scenarioItems, biasState.regime.overall)
    
    // Separar escenarios institucionales en Activos y Watchlist
    scenariosActive = institutionalScenariosGrouped.active
    scenariosWatchlist = institutionalScenariosGrouped.watchlist
    
    // Todos los escenarios (para compatibilidad)
    scenarios = [...institutionalScenariosGrouped.active, ...institutionalScenariosGrouped.watchlist, ...traditionalScenarios]
  } catch (error) {
    console.warn('[dashboard-data] detectScenarios failed, using empty array', error)
    scenarios = []
    scenariosActive = []
    scenariosWatchlist = []
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

  // Get recent events with impact
  let recentEvents: RecentEventWithImpact[] = []
  let lastEventAppliedAt: string | null = null
  try {
    recentEvents = await getRecentEventsWithImpact({
      hours: 48,
      currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD'],
      min_importance: 'medium',
      min_surprise_score: 0.3,
    })
    lastEventAppliedAt = recentEvents.length > 0 ? recentEvents[0].release_time_utc : null
  } catch (error) {
    console.warn('[dashboard-data] getRecentEventsWithImpact failed:', error)
  }

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
    scenariosActive,
    scenariosWatchlist,
    currencyRegimes: biasState.currencyRegimes, // Regímenes macro por moneda
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
    recentEvents,
    meta: {
      bias_updated_at: updatedAtIso,
      last_event_applied_at: lastEventAppliedAt,
    },
  }
}





