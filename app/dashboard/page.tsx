import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'
import { CATEGORY_ORDER } from '@/domain/categories'
import { detectScenarios } from '@/domain/scenarios'
import React from 'react'
import { isStaleByFrequency, getFrequencyLabel, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import { getIndicatorSource } from '@/lib/sources'
import TacticalTablesClient from '@/components/TacticalTablesClient'
import DateDisplay from '@/components/DateDisplay'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const USD_LABELS: Record<string, 'Fuerte' | 'Débil' | 'Neutral'> = {
  Bullish: 'Fuerte',
  Bearish: 'Débil',
  Neutral: 'Neutral',
}

const normalizeSymbol = (symbol?: string | null) =>
  symbol ? symbol.replace('/', '').toUpperCase() : ''

type IndicatorRow = {
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
}

type TacticalRowSafe = {
  pair: string
  trend: string
  action: string
  confidence: string
  corr12m?: number | null
  corr3m?: number | null
}

const buildIndicatorRows = (table: any[]): IndicatorRow[] =>
  table.map((row) => ({
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
  }))

const buildScenarioItems = (table: any[]) =>
  table.map((row) => ({
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

const buildTacticalSafe = (rows: any[]): TacticalRowSafe[] =>
  rows.map((row) => ({
    pair: row.pair ?? row.par ?? row.symbol ?? '',
    trend: row.trend ?? row.tactico ?? 'Neutral',
    action: row.action ?? row.accion ?? 'Rango/táctico',
    confidence: row.confidence ?? row.confianza ?? 'Media',
    corr12m: row.corr12m ?? null,
    corr3m: row.corr3m ?? null,
  }))

const deriveLatestDataDate = (rows: IndicatorRow[]): string | null => {
  let latest: string | null = null
  for (const row of rows) {
    if (!row.date) continue
    if (!latest || row.date > latest) {
      latest = row.date
    }
  }
  return latest
}

type CorrInsight = {
  usdBiasSignal: string
  strongPairs: string[]
  decoupledPairs: string[]
}

const buildCorrInsight = (tacticalRows: any[]): CorrInsight => {
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

type UsdMarketInsights = {
  topPairsSummary: string
  actionBiasSummary: string
  divergenceSummary: string
}

const buildUsdMarketInsights = (rows: TacticalRowSafe[]): UsdMarketInsights => {
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

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  void searchParams

  // Load data with error handling to prevent page blocking
  let biasState: Awaited<ReturnType<typeof getBiasState>> | null = null
  let correlationState: Awaited<ReturnType<typeof getCorrelationState>> | null = null
  let loadError: string | null = null

  try {
    const results = await Promise.allSettled([
      getBiasState(),
      getCorrelationState(),
    ])

    if (results[0].status === 'fulfilled') {
      biasState = results[0].value
    } else {
      loadError = `Error loading bias state: ${results[0].reason instanceof Error ? results[0].reason.message : String(results[0].reason)}`
      console.error('[Dashboard] getBiasState failed:', results[0].reason)
    }

    if (results[1].status === 'fulfilled') {
      correlationState = results[1].value
    } else {
      const corrError = `Error loading correlation state: ${results[1].reason instanceof Error ? results[1].reason.message : String(results[1].reason)}`
      console.error('[Dashboard] getCorrelationState failed:', results[1].reason)
      if (!loadError) loadError = corrError
    }

    // If both failed, we can't render the page
    if (!biasState && !correlationState) {
      return (
        <main className="p-6">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-lg border border-red-200 bg-red-50 p-6">
              <h1 className="text-xl font-semibold text-red-900 mb-2">Error al cargar datos</h1>
              <p className="text-sm text-red-800">{loadError || 'Error desconocido al cargar el dashboard'}</p>
              <p className="text-xs text-red-700 mt-2">Por favor, intenta recargar la página.</p>
            </div>
          </div>
        </main>
      )
    }

    // Provide fallback empty states if one fails
    if (!biasState) {
      biasState = {
        updatedAt: new Date(),
        regime: {
          overall: 'Neutral',
          usd_direction: 'Neutral',
          quad: 'Expansivo',
          liquidity: 'Medium',
          credit: 'Medium',
          risk: 'Neutral',
        },
        metrics: {
          usdScore: 0,
          quadScore: 0,
          liquidityScore: null,
          creditScore: null,
          riskScore: null,
        },
        table: [],
        tableTactical: [],
      }
    }

    if (!correlationState) {
      correlationState = {
        updatedAt: new Date(),
        benchmark: 'DXY',
        windows: ['3m', '6m', '12m', '24m'],
        points: [],
        shifts: [],
        summary: [],
      }
    }
  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error)
    loadError = error instanceof Error ? error.message : 'Error inesperado'
    // Provide minimal fallback states
    biasState = {
      updatedAt: new Date(),
      regime: {
        overall: 'Neutral',
        usd_direction: 'Neutral',
        quad: 'Expansivo',
        liquidity: 'Medium',
        credit: 'Medium',
        risk: 'Neutral',
      },
      metrics: {
        usdScore: 0,
        quadScore: 0,
        liquidityScore: null,
        creditScore: null,
        riskScore: null,
      },
      table: [],
      tableTactical: [],
    }
    correlationState = {
      updatedAt: new Date(),
      benchmark: 'DXY',
      windows: ['3m', '6m', '12m', '24m'],
      points: [],
      shifts: [],
      summary: [],
    }
  }


  const indicatorRows = buildIndicatorRows(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  const scenarioItems = buildScenarioItems(
    Array.isArray(biasState.table) ? biasState.table : []
  )
  const tacticalRows = Array.isArray(biasState.tableTactical)
    ? biasState.tableTactical
    : []
  const tacticalRowsSafe = buildTacticalSafe(tacticalRows)

  let scenarios: any[] = []
  try {
    scenarios = detectScenarios(scenarioItems, biasState.regime.overall)
  } catch (error) {
    console.warn('[Dashboard] detectScenarios failed, using empty array', error)
    scenarios = []
  }

  const corrInsight = buildCorrInsight(tacticalRows)
  const usdMarketInsights = buildUsdMarketInsights(tacticalRowsSafe)

  const usd = USD_LABELS[biasState.regime.usd_direction] ?? biasState.regime.usd_direction
  const quad = biasState.regime.quad
  const correlationsCount = correlationState.summary.length
  const latestDataDate = deriveLatestDataDate(indicatorRows)
  const updatedAtIso = biasState.updatedAt
    ? new Date(biasState.updatedAt).toISOString()
    : null
  const overallRegime = biasState.regime.overall

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Bloque principal de régimen con DateDisplay (UI 3) */}
        <section className="rounded-lg border bg-white p-6">
          <h1 className="text-2xl font-bold mb-2">Régimen actual del mercado</h1>
          <p className="text-sm text-gray-600 mb-4">
            Visión macro agregada del mercado con los indicadores clave y sesgos tácticos.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              Régimen: <strong>{overallRegime}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              USD: <strong>{usd}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              Cuadrante: <strong>{quad}</strong>
            </span>
          </div>
          <div className="text-xs text-gray-600 mb-3">
            Indicadores (items): {indicatorRows.length} · Pares tácticos: {tacticalRowsSafe.length} · Escenarios detectados: {scenarios.length} · Correlaciones: {correlationsCount}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5">
              <DateDisplay
                isoString={updatedAtIso}
                format="datetime"
                label="Última actualización de datos macro"
                showTimezone={true}
              />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-gray-50 px-2 py-0.5 text-sm text-gray-700">
              <DateDisplay
                isoString={latestDataDate ? `${latestDataDate}T00:00:00` : null}
                format="date"
                label="Datos macro hasta"
              />
            </span>
          </div>

          {/* Resumen rápido de correlaciones USD */}
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-semibold">Resumen correlaciones USD:</span>{' '}
              {corrInsight.usdBiasSignal}
            </div>
            {corrInsight.strongPairs.length > 0 && (
              <div>
                <span className="font-semibold">
                  Pares más ligados al USD (|ρ 12m| ≥ 0,60):
                </span>{' '}
                {corrInsight.strongPairs.join(', ')}
              </div>
            )}
            {corrInsight.decoupledPairs.length > 0 && (
              <div>
                <span className="font-semibold">
                  Pares desconectados (12m fuerte, 3m débil):
                </span>{' '}
                {corrInsight.decoupledPairs.join(', ')}
              </div>
            )}
          </div>

          {/* Insights adicionales del mercado */}
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <div>
              <span className="font-semibold">Pares destacados:</span>{' '}
              {usdMarketInsights.topPairsSummary}
            </div>
            <div>
              <span className="font-semibold">Sesgo en pares USD:</span>{' '}
              {usdMarketInsights.actionBiasSummary}
            </div>
            <div>
              <span className="font-semibold">Divergencias corr. 3m vs 12m:</span>{' '}
              {usdMarketInsights.divergenceSummary}
            </div>
          </div>
        </section>

        {/* Escenarios simplificados */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold mb-3">Escenarios (UI test)</h2>
          {scenarios.length === 0 ? (
            <p className="text-sm text-gray-500">Sin escenarios detectados.</p>
          ) : (
            <ul className="space-y-3">
              {scenarios.map((s) => (
                <li key={s.id} className="border rounded p-3 bg-gray-50">
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-xs text-gray-500 mb-1">Severidad: {s.severity}</div>
                  <div className="text-sm">
                    Acción sugerida: <strong>{s.actionHint}</strong>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tabla de indicadores macro */}
        <section className="rounded-lg border bg-white p-6">
          <h2 className="text-lg font-semibold mb-3">Indicadores macro</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Variable</th>
                  <th className="px-3 py-2 text-left">Dato anterior</th>
                  <th className="px-3 py-2 text-left">Dato actual</th>
                  <th className="px-3 py-2 text-left">Evolución</th>
                  <th className="px-3 py-2 text-left">Postura</th>
                  <th className="px-3 py-2 text-left">Peso</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((cat) => {
                  const categoryRows = indicatorRows.filter((row) => row.category === cat)

                  if (!categoryRows.length) {
                    return (
                      <React.Fragment key={cat}>
                        <tr className="bg-gray-50 border-t">
                          <td colSpan={7} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">
                            {cat}
                          </td>
                        </tr>
                        <tr className="border-t">
                          <td colSpan={7} className="px-3 py-2 text-center text-gray-400 text-sm">
                            No hay indicadores en esta categoría
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  }
                  return (
                    <React.Fragment key={cat}>
                      <tr className="bg-gray-50 border-t">
                        <td colSpan={7} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">
                          {cat}
                        </td>
                      </tr>
                      {categoryRows.map((row) => {
                        const isPayemsDelta =
                          typeof row.label === 'string' && row.label.includes('Payrolls Δ')

                        const formatValue = (v: number | null | undefined) => {
                          if (v === null || v === undefined) return '—'
                          if (!Number.isFinite(v)) return String(v)
                          return isPayemsDelta ? Math.round(v).toString() : v.toFixed(2)
                        }

                        const valCurrent = formatValue(row.value)
                        const valPrevious = formatValue(row.previous)

                        const p = row.posture ?? 'Neutral'

                        const trend = row.trend

                        const trendBadge =
                          trend === 'Mejora'
                            ? 'bg-green-600/10 text-green-700'
                            : trend === 'Empeora'
                            ? 'bg-red-600/10 text-red-700'
                            : trend === 'Estable'
                            ? 'bg-gray-500/10 text-gray-700'
                            : 'bg-gray-500/10 text-gray-500'

                        return (
                          <tr key={String(row.key)} className="border-t">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <span>{row.label}</span>
                                {(() => {
                                  const meta = getIndicatorSource(row.key)
                                  if (!meta) return null

                                  const titleParts = [
                                    `Fuente: ${meta.source}`,
                                    meta.seriesId ? `ID: ${meta.seriesId}` : '',
                                    meta.description ? meta.description : '',
                                  ].filter(Boolean)
                                  const title = titleParts.join(' · ')

                                  return (
                                    <a
                                      href={meta.sourceUrl || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-gray-700"
                                      title={title}
                                    >
                                      <svg
                                        className="w-3 h-3"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="16" x2="12" y2="12" />
                                        <line x1="12" y1="8" x2="12.01" y2="8" />
                                      </svg>
                                    </a>
                                  )
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {valPrevious}
                              {row.previous != null && row.unit ? ` ${row.unit}` : ''}
                            </td>
                            <td className="px-3 py-2">
                              {valCurrent}
                              {row.value != null && row.unit ? ` ${row.unit}` : ''}
                            </td>
                            <td className="px-3 py-2">
                              {trend ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${trendBadge}`}>
                                  {trend}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{p}</td>
                            <td className="px-3 py-2">
                              {row.weight != null ? row.weight.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span>{row.date ?? '—'}</span>
                                {row.date && (() => {
                                  const indicatorKey = row.originalKey || row.key.toLowerCase()
                                  const freshness = isStaleByFrequency(row.date, indicatorKey)
                                  if (!freshness.isStale) return null

                                  const freqLabel = getFrequencyLabel(freshness.frequency)
                                  const sla = SLA_BY_FREQUENCY[freshness.frequency]
                                  const slaLabel = sla.useBusinessDays
                                    ? `${sla.maxDays} días hábiles`
                                    : `${sla.maxDays} días naturales`

                                  return (
                                    <span
                                      className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[11px] px-1.5 py-0.5"
                                      title={`Serie ${freqLabel}; último dato: ${row.date}; SLA: ${slaLabel}`}
                                    >
                                      Desactualizado
                                    </span>
                                  )
                                })()}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <TacticalTablesClient rows={tacticalRowsSafe} />
      </div>
    </main>
  )
}
