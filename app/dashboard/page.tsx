export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { getDashboardData, type DashboardData } from '@/lib/dashboard-data'
import { CATEGORY_ORDER } from '@/domain/categories'
import React from 'react'
import { isStaleByFrequency, getFrequencyLabel, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import { getIndicatorSource } from '@/lib/sources'
import TacticalTablesClient from '@/components/TacticalTablesClient'
import DateDisplay from '@/components/DateDisplay'
import { TableSkeleton, RegimeSkeleton, ScenariosSkeleton } from '@/components/DashboardSkeleton'

// Types and helper functions are now in lib/dashboard-data.ts

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  void searchParams

  // Get all dashboard data from database (single source of truth)
  let data: DashboardData
  try {
    console.log('[Dashboard] Starting data fetch...')
    data = await getDashboardData()
    console.log('[Dashboard] Data loaded successfully', {
      hasData: !!data,
      indicatorsCount: data?.indicators?.length || 0,
      tacticalRowsCount: data?.tacticalRows?.length || 0,
      regime: data?.regime?.overall || 'unknown',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[Dashboard] Error loading data:', {
      message: errorMessage,
      stack: errorStack,
      error,
    })
    // Return error state instead of skeleton to prevent infinite loading
    return (
      <main className="p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="rounded-lg border bg-red-50 p-6 text-red-800">
            <h1 className="text-xl font-semibold mb-2">Error al cargar datos del dashboard</h1>
            <p className="text-sm mt-1 font-mono">{errorMessage}</p>
            {errorStack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs">Ver detalles técnicos</summary>
                <pre className="mt-2 text-xs overflow-auto bg-red-100 p-2 rounded">
                  {errorStack}
                </pre>
              </details>
            )}
            <p className="text-xs mt-4 text-red-600">
              Por favor, verifica los logs del servidor en Vercel para más información.
            </p>
          </div>
        </div>
      </main>
    )
  }

  // Extract data for easier access
  const {
    regime,
    indicators: indicatorRows,
    tacticalRows: tacticalRowsSafe,
    scenarios,
    correlations,
    corrInsight,
    usdMarketInsights,
    latestDataDate,
    updatedAt,
  } = data

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
              Régimen: <strong>{regime.overall}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              USD: <strong>{regime.usd_label}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              Cuadrante: <strong>{regime.quad}</strong>
            </span>
          </div>
          <div className="text-xs text-gray-600 mb-3">
            Indicadores (items): {indicatorRows.length} · Pares tácticos: {tacticalRowsSafe.length} · Escenarios detectados: {scenarios.length} · Correlaciones: {correlations.count}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5">
              <DateDisplay
                isoString={updatedAt}
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
          {!scenarios || scenarios.length === 0 ? (
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
          {!indicatorRows || indicatorRows.length === 0 ? (
            <TableSkeleton rows={10} />
          ) : (
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
                            <tr key={`${row.originalKey || row.key}-${row.date || 'no-date'}`} className="border-t">
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
                                {row.isStale && row.date && (
                                  <span
                                    className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[11px] px-1.5 py-0.5"
                                    title={`Dato desactualizado según frecuencia de la serie; último dato: ${row.date}`}
                                  >
                                    Desactualizado
                                  </span>
                                )}
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
            )}
        </section>

        {tacticalRowsSafe && tacticalRowsSafe.length > 0 ? (
          <TacticalTablesClient rows={tacticalRowsSafe} />
        ) : (
          <section className="rounded-lg border bg-white p-6">
            <h2 className="text-lg font-semibold mb-3">Pares tácticos</h2>
            <p className="text-sm text-gray-500">Cargando datos tácticos...</p>
          </section>
        )}
      </div>
    </main>
  )
}
