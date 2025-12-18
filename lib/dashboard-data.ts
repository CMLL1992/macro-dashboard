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
import { MAP_KEY_TO_WEIGHT_KEY, getMacroDiagnosis } from '@/domain/diagnostic'
import type { BiasRow } from '@/domain/bias'
import { getRecentEventsWithImpact } from '@/lib/db/recent-events'
import type { RecentEventWithImpact } from '@/lib/db/recent-events'
import { getEuropeanIndicatorsForDashboard } from '@/domain/eurozone-indicators'

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
  // Drivers para explicar el sesgo
  drivers?: Array<{ key: string; text: string }>
  macroReasons?: string[]
  why?: string | null
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

export type MacroSection = {
  id: string
  title: string
  region: string
  indicators: Array<{
    key: string
    label: string
    currentValue: number | null
    previousValue: number | null
    currentDate: string | null
    previousDate: string | null
    weight: number | null
  }>
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
  
  // Coverage metrics (percentage of indicators with data per region)
  coverage?: {
    EU: { total: number; withData: number; percentage: number }
    US: { total: number; withData: number; percentage: number }
  }
  
  // Datos principales
  indicators: IndicatorRow[]
  tacticalRows: TacticalRowSafe[]
  scenarios: Scenario[]
  scenariosActive: Scenario[]      // Confianza Alta
  scenariosWatchlist: Scenario[]    // Confianza Media
  
  // Secciones macro (EUROZONA, GLOBAL, etc.)
  macroSections?: MacroSection[]
  
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
  
  // Timestamps (ISO strings for serialization)
  biasUpdatedAt: string | null
  correlationUpdatedAt: string | null
  
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
  // Simplified - removed debug logs that were causing errors
  
  const rows: IndicatorRow[] = table
    .filter((row: any) => row != null)
    .map((row: any) => {
      // Use originalKey if available, otherwise use key
      // This ensures European indicators use their original key (eu_cpi_yoy) instead of transformed key (EU_CPI_YOY)
      const finalKey = String(row?.originalKey ?? row?.key ?? '')
      
      // Determine section: EUROZONA for EU indicators, undefined for others
      const section = (finalKey && finalKey.startsWith('eu_')) ? 'EUROZONA' : undefined
      
      // Obtener unidad del mapping (prioridad: row.unit > mapping > null)
      const { getIndicatorUnit } = require('@/domain/indicators/units')
      const unit = row?.unit ?? getIndicatorUnit(finalKey) ?? null
      
      // Warning en dev si falta unidad
      if (process.env.NODE_ENV !== 'production' && !unit && row?.value !== null) {
        console.warn('[unit-missing]', finalKey)
      }
      
      return {
        key: finalKey,
        label: String(row?.label ?? row?.key ?? ''),
        category: String(row?.category ?? 'Otros'),
        previous: row?.value_previous ?? row?.previous ?? null,
        value: row?.value ?? null,
        trend: row?.trend ?? null,
        posture: row?.posture ?? null,
        weight: row?.weight ?? null,
        date: row?.date ?? null,
        observation_period: row?.observation_period ?? null,
        originalKey: row?.originalKey ?? row?.key ?? null,
        unit,
        isStale: row?.isStale ?? false,
        section: section ?? null,
      }
    })
  
  // Filter: Only show indicators that have weight > 0 in the macro engine
  // EXCEPTION: Always include European indicators (eu_*) even if weight is 0
  // This ensures European indicators appear in the dashboard even if they don't have weight configured
  const filteredRows: IndicatorRow[] = rows.filter((row) => {
    // Must have key and label
    if (!row.key || !row.label) return false
    
    // EXCEPTION: Always include European indicators
    if (row.key.startsWith('eu_')) {
      return true
    }
    
    // Check if indicator has weight configured
    const finalKey = row.originalKey ?? row.key
    const weightKey = MAP_KEY_TO_WEIGHT_KEY[finalKey] ?? finalKey
    
    // Priority 1: If weight is explicitly set in the row, use it
    if (row.weight != null && row.weight > 0) {
      return true
    }
    
    // Priority 2: Check WEIGHTS config
    const weight = WEIGHTS[weightKey]
    if (weight != null && weight > 0) {
      return true
    }
    
    // Priority 3: If no weight found but indicator has a value, include it (less restrictive)
    // This ensures indicators with data but missing weight config are still shown
    if (row.value != null) {
      return true
    }
    
    return false
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

function buildTacticalSafe(
  rows: any[],
  context?: {
    riskRegime?: string
    usdDirection?: string
    quad?: string
    liquidity?: string
    currencyRegimes?: Record<string, { regime?: string; probability?: number }>
  }
): TacticalRowSafe[] {
  const { buildDriversForPair } = require('@/domain/tactical-pairs/drivers')
  type TacticalDriver = { key: string; text: string; weight?: number }
  
  return rows.map((row) => {
    const pair = row.pair ?? row.par ?? row.symbol ?? ''
    
    // Construir drivers si hay contexto disponible
    let drivers: Array<{ key: string; text: string }> = []
    let macroReasons: string[] = []
    let why: string | null = null
    
    if (context && pair) {
      const tacticalContext = {
        riskRegime: context.riskRegime || 'Neutral',
        usdDirection: context.usdDirection,
        quad: context.quad,
        liquidity: context.liquidity,
        currencyRegimes: context.currencyRegimes,
      }
      
      const driverObjects: TacticalDriver[] = buildDriversForPair(pair, tacticalContext)
      drivers = driverObjects.map((d: TacticalDriver) => ({ key: d.key, text: d.text }))
      macroReasons = driverObjects.map((d: TacticalDriver) => d.text)
      why = driverObjects.map((d: TacticalDriver) => `• ${d.text}`).join('\n')
    }
    
    // Si no hay drivers y estamos en dev, warning
    if (drivers.length === 0 && process.env.NODE_ENV !== 'production') {
      console.warn('[drivers-missing]', pair)
      // Fallback mínimo
      drivers = [{ key: 'insufficient_signals', text: 'Drivers insuficientes con el set actual de señales' }]
      macroReasons = drivers.map((d) => d.text)
      why = drivers.map((d) => `• ${d.text}`).join('\n')
    }
    
    return {
      pair,
      trend: row.trend ?? row.tactico ?? 'Neutral',
      action: row.action ?? row.accion ?? 'Rango/táctico',
      confidence: row.confidence ?? row.confianza ?? 'Media',
      corr12m: row.corr12m ?? null,
      corr3m: row.corr3m ?? null,
      last_relevant_event: row.last_relevant_event ?? null,
      updated_after_last_event: row.updated_after_last_event ?? false,
      // Añadir drivers, macroReasons, why
      drivers,
      macroReasons,
      why,
    }
  })
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
  // TAREA 2: Fetch data in parallel for optimization (70-90% faster)
  const [biasState, correlationState, europeanIndicators, macroDiagnosis] =
    await Promise.all([
      getBiasState(),
      getCorrelationState(),
      getEuropeanIndicatorsForDashboard(),
      getMacroDiagnosis(), // Added for parallelization
    ])

  // Build indicator rows from biasState.table (for USA/GLOBAL only)
  const biasTable = Array.isArray(biasState.table) ? biasState.table : []
  const indicatorRows = buildIndicatorRows(biasTable)
  
  // TAREA 1: Create EUROZONA section explicitly (without using buildIndicatorRows)
  const euroSection: MacroSection = {
    id: 'EUROZONA',
    title: 'Eurozona',
    region: 'eurozone',
    indicators: europeanIndicators.map((row) => ({
      key: row.key,
      label: row.label,
      currentValue: row.value,
      previousValue: row.valuePrevious,
      currentDate: row.date,
      previousDate: row.datePrevious,
      weight: null, // European indicators don't use weight filtering
    })),
  }
  
  // Merge European indicators into finalIndicatorRows for backward compatibility
  // Create a map of existing indicators by key for quick lookup
  const indicatorMap = new Map<string, IndicatorRow>()
  indicatorRows.forEach(row => {
    indicatorMap.set(row.key, row)
  })
  
  // Add/update European indicators from the centralized helper
  europeanIndicators.forEach(euRow => {
    const existing = indicatorMap.get(euRow.key)
    if (existing) {
      // Update existing row with European data (may have better values)
      existing.value = euRow.value ?? existing.value
      existing.previous = euRow.valuePrevious ?? existing.previous
      existing.date = euRow.date ?? existing.date
      existing.unit = euRow.unit ?? existing.unit
      existing.isStale = euRow.isStale ?? existing.isStale
      existing.section = 'EUROZONA'
    } else {
      // Add new European indicator row
      indicatorMap.set(euRow.key, {
        key: euRow.key,
        label: euRow.label,
        category: 'Eurozona',
        previous: euRow.valuePrevious,
        value: euRow.value,
        trend: null,
        posture: null,
        weight: null,
        date: euRow.date,
        observation_period: null,
        originalKey: euRow.key,
        unit: euRow.unit,
        isStale: euRow.isStale ?? false,
        section: 'EUROZONA',
      })
    }
  })
  
  // Convert map back to array
  const finalIndicatorRows = Array.from(indicatorMap.values())
  
  // Create other sections (GLOBAL/USA) from buildIndicatorRows
  const otherSections: MacroSection[] = []
  const globalIndicators = finalIndicatorRows.filter(row => row.section !== 'EUROZONA')
  if (globalIndicators.length > 0) {
    otherSections.push({
      id: 'GLOBAL',
      title: 'Global / USA',
      region: 'global',
      indicators: globalIndicators.map((row) => ({
        key: row.key,
        label: row.label,
        currentValue: row.value,
        previousValue: row.previous,
        currentDate: row.date,
        previousDate: null, // TODO: Add previousDate if available
        weight: row.weight,
      })),
    })
  }
  
  // Combine sections: EUROZONA first, then others
  const macroSections: MacroSection[] = [
    euroSection,
    ...otherSections.filter((x) => x.id !== 'EUROZONA'),
  ]
  
  // Build scenario items
  const scenarioItems = buildScenarioItems(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  
  // Build tactical rows - FILTER to only show pairs from tactical-pairs.json
  let tacticalRows = Array.isArray(biasState.tableTactical)
    ? biasState.tableTactical
    : []
  
  // Load allowed pairs from tactical-pairs.json and filter
  // IMPORTANT: For Forex pairs, also apply FOREX_WHITELIST filter
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const { FOREX_WHITELIST, isForexWhitelisted } = await import('@/config/forex-whitelist')
    const tacticalPath = path.join(process.cwd(), 'config', 'tactical-pairs.json')
    const tacticalRaw = await fs.readFile(tacticalPath, 'utf8')
    const tacticalPairs = JSON.parse(tacticalRaw) as Array<{ symbol: string; type?: string }>
    const allowedSymbols = new Set(
      tacticalPairs.map(p => p.symbol.toUpperCase().replace('/', ''))
    )
    
    // Filter tactical rows to only include allowed pairs
    // IMPORTANT: FOREX_WHITELIST only applies to Forex pairs (type='fx')
    // Other pairs (crypto, commodity, index) should pass through if in tactical-pairs.json
    tacticalRows = tacticalRows.filter((row: any) => {
      const symbol = (row.pair ?? row.symbol ?? '').replace('/', '').toUpperCase()
      const isAllowed = allowedSymbols.has(symbol)
      
      if (!isAllowed) {
        return false
      }
      
      // If it's a Forex pair (type='fx'), also check FOREX_WHITELIST
      const pairConfig = tacticalPairs.find(p => p.symbol.toUpperCase().replace('/', '') === symbol)
      if (pairConfig?.type === 'fx') {
        // Forex pairs MUST be in FOREX_WHITELIST
        return isForexWhitelisted(symbol)
      }
      
      // Non-Forex pairs (crypto, commodity, index) pass through if in tactical-pairs.json
      return true
    })
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[dashboard-data] Filtered tactical rows:', {
        originalCount: biasState.tableTactical?.length || 0,
        filteredCount: tacticalRows.length,
        allowedSymbols: Array.from(allowedSymbols),
        forexWhitelist: FOREX_WHITELIST,
      })
    }
  } catch (error) {
    console.warn('[dashboard-data] Failed to load tactical-pairs.json for filtering, showing all pairs:', error)
    // If we can't load the config, show all pairs (fallback behavior)
  }
  
  // Construir contexto macro para drivers de pares tácticos
  const tacticalContext = {
    riskRegime: biasState.regime.overall || 'Neutral',
    usdDirection: biasState.regime.usd_direction,
    quad: biasState.regime.quad,
    liquidity: biasState.regime.liquidity,
    currencyRegimes: biasState.currencyRegimes,
  }
  
  const tacticalRowsSafe = buildTacticalSafe(tacticalRows, tacticalContext)

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
    
    // Get USD label from usd_direction (calculated below)
    const usdLabelFromDirection = USD_LABELS[biasState.regime.usd_direction] ?? 'Neutral'
    const usdBiasLabel = usdLabelFromDirection
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

  // Get latest data date (from all indicators including European)
  const latestDataDate = deriveLatestDataDate(finalIndicatorRows)
  
  // Format updated at - ensure it's a valid ISO string or null
  let updatedAtIso: string | null = null
  try {
    if (biasState.updatedAt) {
      const date = typeof biasState.updatedAt === 'string' 
        ? new Date(biasState.updatedAt)
        : biasState.updatedAt instanceof Date
        ? biasState.updatedAt
        : null
      if (date && !isNaN(date.getTime())) {
        updatedAtIso = date.toISOString()
      }
    }
  } catch (e) {
    // Invalid date, keep as null
    updatedAtIso = null
  }

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

  const dashboardData = {
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
    indicators: finalIndicatorRows,
    tacticalRows: tacticalRowsSafe,
    scenarios,
    scenariosActive,
    scenariosWatchlist,
    macroSections, // TAREA 1: Added explicit EUROZONA section
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
    biasUpdatedAt: biasState.updatedAt instanceof Date 
      ? biasState.updatedAt.toISOString()
      : typeof biasState.updatedAt === 'string'
      ? biasState.updatedAt
      : null,
    correlationUpdatedAt: correlationState.updatedAt instanceof Date
      ? correlationState.updatedAt.toISOString()
      : typeof correlationState.updatedAt === 'string'
      ? correlationState.updatedAt
      : null,
    recentEvents,
    meta: {
      bias_updated_at: updatedAtIso,
      last_event_applied_at: lastEventAppliedAt,
    },
  }
  
  // Calculate coverage metrics (percentage of indicators with data per region)
  const EU_TOTAL_INDICATORS = 14 // From config/european-indicators.json
  const euWithData = europeanIndicators.filter(eu => eu.value != null && !isNaN(Number(eu.value))).length
  const euCoverage = {
    total: EU_TOTAL_INDICATORS,
    withData: euWithData,
    percentage: Math.round((euWithData / EU_TOTAL_INDICATORS) * 100),
  }
  
  // US indicators: count from biasState.table (excluding tactical pairs)
  const usIndicators = finalIndicatorRows.filter(row => 
    row.section !== 'EUROZONA' && 
    row.value != null && 
    !isNaN(Number(row.value))
  )
  const usTotal = finalIndicatorRows.filter(row => row.section !== 'EUROZONA').length
  const usCoverage = {
    total: usTotal,
    withData: usIndicators.length,
    percentage: usTotal > 0 ? Math.round((usIndicators.length / usTotal) * 100) : 0,
  }
  
  // Dashboard data ready
  const dashboardDataWithCoverage: DashboardData = {
    ...dashboardData,
    coverage: {
      EU: euCoverage,
      US: usCoverage,
    },
  }
  
  return dashboardDataWithCoverage
}





