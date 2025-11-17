import { getMacroDiagnosisWithDelta } from '@/domain/diagnostic'
import { usdBias, macroQuadrant, getBiasTable, getBiasTableTactical } from '@/domain/bias'
import { getCorrMap } from '@/domain/corr-bridge'
import InfoTooltip from '@/components/InfoTooltip'
import CorrelationTooltip from '@/components/CorrelationTooltip'
import ConfidenceTooltip from '@/components/ConfidenceTooltip'
import { getCorrelations } from '@/domain/corr-dashboard'
import { CATEGORY_ORDER } from '@/domain/categories'
import { Fragment } from 'react'
import { detectScenarios } from '@/domain/scenarios'
import DashboardInitializing from '@/components/DashboardInitializing'
import { isStaleByFrequency, getFrequencyLabel, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import Link from 'next/link'
import DateDisplay from '@/components/DateDisplay'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Fetch bias data with validation and error handling
 */
async function fetchBias() {
  const startTime = Date.now()
  const base = process.env.APP_URL || 'http://localhost:3000'
  const endpoint = `${base}/api/bias`

  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
    })

    const duration = Date.now() - startTime

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error')
      console.error('[Dashboard] API error', {
        endpoint,
        status: res.status,
        statusText: res.statusText,
        duration_ms: duration,
        error: errorText,
      })
      throw new Error(`API error: ${res.status} ${res.statusText} - ${endpoint}`)
    }

    const data = await res.json().catch((error) => {
      console.error('[Dashboard] JSON parse error', {
        endpoint,
        duration_ms: duration,
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`Invalid JSON response from ${endpoint}`)
    })

    // Log successful fetch
    console.log('[Dashboard] API fetch success', {
      endpoint,
      status: res.status,
      duration_ms: duration,
      items_count: Array.isArray(data?.items) ? data.items.length : 0,
    })

    return data
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    console.error('[Dashboard] Fetch failed', {
      endpoint,
      duration_ms: duration,
      error: errorMessage,
    })

    // Re-throw to be caught by error boundary
    throw new Error(`Failed to fetch bias data: ${errorMessage}`)
  }
}

// Minimum required counts
const MIN_ITEMS = 15
const MIN_CORRELATIONS = 9
const MIN_OBSERVATIONS = 1

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  let apiBias
  try {
    apiBias = await fetchBias()
  } catch (error) {
    // Error will be caught by error boundary
    throw error
  }

  // Guardrails: check minimum data requirements
  const itemsCount = Array.isArray(apiBias?.items) ? apiBias.items.length : 0
  const correlationCount = apiBias?.health?.correlationCount || 0
  const observationCount = apiBias?.health?.observationCount || 0

  const hasMinData =
    itemsCount >= MIN_ITEMS &&
    correlationCount >= MIN_CORRELATIONS &&
    observationCount >= MIN_OBSERVATIONS &&
    apiBias?.health?.hasData === true

  if (!apiBias || !hasMinData) {
    return <DashboardInitializing />
  }

  let data
  try {
    data = await getMacroDiagnosisWithDelta()
  } catch (error) {
    console.error('[Dashboard] getMacroDiagnosisWithDelta failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(`Failed to get macro diagnosis: ${error instanceof Error ? error.message : String(error)}`)
  }
  const CONFIDENCE_TOOLTIP = `\nConfianza = probabilidad de que el activo se mueva según el sesgo macro actual.\n\n• Alta: ~70–80% (correlación fuerte y régimen claro)\n• Media: ~50–60%\n• Baja: <50%\n\nEjemplo: Si el USD está fuerte y EUR/USD tiene confianza Alta, hay alta probabilidad de que EUR/USD caiga.\n`
  const showKeys = (searchParams?.showKeys ?? '') === '1'
  const usd = usdBias(data.items)
  const quad = macroQuadrant(data.items)
  const biasRows = getBiasTable(data.regime, usd, quad)
  const corrMap = await getCorrMap()
  const tacticalRows = await getBiasTableTactical(data.items as any[], data.regime, usd, data.score, [], corrMap)
  const color = data.regime === 'RISK ON' ? 'text-green-600' : data.regime === 'RISK OFF' ? 'text-red-600' : 'text-gray-600'
  const SHOW_CORR_ON_DASH = false
  const strongCorr: string[] = []
  const scenarios = detectScenarios(data.items as any[], data.regime)
  const corrs = await getCorrelations()
  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">Régimen actual del mercado</h1>
            <span title="Score ponderado: Dovish=+1, Neutral=0, Hawkish=−1, umbral |0.30| para RISK ON/OFF. Pesos configurables." className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs text-muted-foreground">i</span>
            <Link href="/ayuda#tecnico" className="text-sm text-muted-foreground hover:text-primary underline">
              ¿Cómo interpretar esto?
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${color}`}>Régimen: <strong>{data.regime}</strong> ({data.score.toFixed(2)})</span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">USD: <strong>{usd}</strong></span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">Cuadrante: <strong>{quad}</strong></span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Score: {data.score.toFixed(2)} | Umbral: {data.threshold.toFixed(2)} | Activos: {data.counts?.withValue ?? 0}/{data.counts?.total ?? 0} | Mejoran: {data.improving ?? 0} | Empeoran: {data.deteriorating ?? 0}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5">
              <DateDisplay
                isoString={apiBias?.updatedAt}
                format="datetime"
                label="Actualizado"
                showTimezone={true}
              />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-2 py-0.5 text-sm text-muted-foreground">
              <DateDisplay
                isoString={apiBias?.latestDataDate ? `${apiBias.latestDataDate}T00:00:00` : null}
                format="date"
                label="Datos macro hasta"
              />
            </span>
            <a href={`?${new URLSearchParams({ ...searchParams, showKeys: showKeys ? '0' : '1' } as any).toString()}`} className="inline-flex items-center gap-2 rounded border px-3 py-1">{showKeys ? 'Ocultar claves' : 'Mostrar claves'}</a>
            <a href="/api/export" className="ml-auto inline-flex items-center gap-2 rounded border px-3 py-1">Exportar CSV</a>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-2">Escenarios</h2>
          {scenarios.length ? (
            <ul className="space-y-2 text-sm">
              {scenarios
                .sort((a, b) => (a.severity === 'alta' ? -1 : a.severity === 'media' && b.severity === 'baja' ? -1 : 1))
                .map((s) => (
                  <li key={s.id} className="rounded border p-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs rounded-full border px-2 py-0.5 ${s.severity === 'alta' ? 'text-red-600' : s.severity === 'media' ? 'text-yellow-600' : 'text-muted-foreground'}`}>{s.severity.toUpperCase()}</span>
                      <span className="font-medium">{s.title}</span>
                    </div>
                    <div className="text-muted-foreground mt-1">{s.why}</div>
                    <div className="mt-1">Sugerencia: <strong>{s.actionHint}</strong></div>
                  </li>
                ))}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">Sin escenarios destacados.</div>
          )}
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold mb-2">Insights</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Régimen: <strong>{data.regime}</strong> (score {data.score.toFixed(2)})</li>
            <li>USD: <strong>{usd}</strong></li>
            {SHOW_CORR_ON_DASH && (
              <li>Correlación 12m fuerte: {strongCorr.length ? strongCorr.join(', ') : '—'}</li>
            )}
          </ul>
          {data.categoryCounts && (() => {
            // Expected counts según indicadores activos definidos:
            // Financieros/Curva: solo T10Y2Y (1)
            // Crecimiento/Actividad: GDP YoY, GDP QoQ anualizado, INDPRO YoY, Retail YoY (4)
            // Mercado laboral: NFP Δ, U3, Claims 4w (3)
            // Precios/Inflación: CPI YoY, Core CPI YoY, PCE YoY, Core PCE YoY, PPI YoY (5)
            // Otros: VIX + FEDFUNDS (2)
            const expectedCounts: Record<string, number> = {
              'Financieros / Curva': 1,
              'Crecimiento / Actividad': 4,
              'Mercado laboral': 3,
              'Precios / Inflación': 5,
              'Otros': 2,
            }
            const hasInconsistency = CATEGORY_ORDER.some(cat => {
              const c = (data.categoryCounts as any)[cat]
              if (!c || c.total === 0) return false
              const expected = expectedCounts[cat]
              return typeof expected === 'number' && c.total !== expected
            })
            
            return (
              <>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {CATEGORY_ORDER.map(cat => {
                    const c = (data.categoryCounts as any)[cat]
                    if (!c || c.total === 0) return null
                    return <span key={cat} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">{cat}: {c.withValue}/{c.total}</span>
                  })}
                </div>
                {hasInconsistency && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠️ Mapa-categorías inconsistente: verificar configuración
                  </div>
                )}
              </>
            )
          })()}
        </div>


        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Variable</th>
                  <th className="px-3 py-2 text-left">Dato anterior</th>
                  <th className="px-3 py-2 text-left">Dato actual</th>
                  <th className="px-3 py-2 text-left" title="Comparación entre el último dato y el anterior. Interpretación basada en el criterio macroeconómico del indicador.">Evolución</th>
                  <th className="px-3 py-2 text-left">Postura</th>
                  <th className="px-3 py-2 text-left">Peso</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map(cat => {
                  const rows = (data.items as any[]).filter(i => i.category === cat)
                  if (!rows.length) return null
                  return (
                    <Fragment key={cat}>
                      <tr className="bg-muted/50 border-t">
                        <td colSpan={7} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">{cat}</td>
                      </tr>
                      {rows
                        // Deduplicación defensiva por clave única (seriesId/key)
                        .filter((() => {
                          const seen = new Set<string>()
                          return (x: any) => {
                            const k = String(x.seriesId || x.key)
                            if (seen.has(k)) return false
                            seen.add(k)
                            return true
                          }
                        })())
                        .map((i) => {
                        const isPayemsDelta = typeof i.label === 'string' && i.label.includes('Payrolls Δ')
                        const formatValue = (v: number | null) => {
                          if (v == null) return '—'
                          if (!Number.isFinite(v)) return String(v)
                          return isPayemsDelta ? Math.round(v).toString() : v.toFixed(2)
                        }
                        const valCurrent = formatValue(i.value)
                        const valPrevious = formatValue(i.value_previous)
                        const p = i.value == null ? 'Neutral' : i.posture
                        const trend = i.trend
                        const trendColor = trend === 'Mejora' ? 'text-green-600' : trend === 'Empeora' ? 'text-red-600' : trend === 'Estable' ? 'text-gray-500' : 'text-muted-foreground'
                        const trendBadge = trend === 'Mejora' ? 'bg-green-600/10 text-green-700' : trend === 'Empeora' ? 'bg-red-600/10 text-red-700' : trend === 'Estable' ? 'bg-gray-500/10 text-gray-700' : 'bg-gray-500/10 text-gray-500'
                        return (
                          <tr key={String(i.seriesId || i.key)} className="border-t">
                            <td className="px-3 py-2">{i.label}{showKeys ? <span className="text-muted-foreground text-xs"> {' ' }[{i.key}]</span> : null}</td>
                            <td className="px-3 py-2 text-muted-foreground">{valPrevious}{i.value_previous != null && i.unit ? ` ${i.unit}` : ''}</td>
                            <td className="px-3 py-2">{valCurrent}{i.value != null && i.unit ? ` ${i.unit}` : ''}</td>
                            <td className="px-3 py-2">
                              {trend ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${trendBadge}`}>
                                  {trend}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">{p}</td>
                            <td className="px-3 py-2">{(i.weight ?? 0).toFixed(2)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <span>{i.date ?? '—'}</span>
                                {i.date && (() => {
                                  // Use originalKey for freshness (e.g., 'gdp_yoy', 'cpi_yoy') instead of weightKey (e.g., 'GDPC1')
                                  const indicatorKey = (i as any).originalKey || i.key.toLowerCase()
                                  const freshness = isStaleByFrequency(i.date, indicatorKey)
                                  if (freshness.isStale) {
                                    const freqLabel = getFrequencyLabel(freshness.frequency)
                                    const sla = SLA_BY_FREQUENCY[freshness.frequency]
                                    const slaLabel = sla.useBusinessDays ? `${sla.maxDays} días hábiles` : `${sla.maxDays} días naturales`
                                    return (
                                      <span 
                                        className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-xs px-1.5 py-0.5" 
                                        title={`Serie ${freqLabel}; último dato: ${i.date}; SLA: ${slaLabel}`}
                                      >
                                        Desactualizado
                                      </span>
                                    )
                                  }
                                  return null
                                })()}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b"><h2 className="font-semibold">Sesgo por par</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Par / Activo</th>
                  <th className="px-3 py-2 text-left">Sesgo macro</th>
                  <th className="px-3 py-2 text-left">Acción recomendada</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {biasRows.map(r => (
                  <tr key={r.par} className="border-t">
                    <td className="px-3 py-2">{r.par}</td>
                    <td className="px-3 py-2">{r.sesgoMacro}</td>
                    <td className="px-3 py-2">{r.accion}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Mapa de sesgos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Par / Activo</th>
                  <th className="px-3 py-2 text-left">Tendencia</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Confianza <InfoTooltip text={CONFIDENCE_TOOLTIP} /></th>
                  <th className="px-3 py-2 text-left" title="Correlación de Pearson entre rendimientos diarios (activo vs. DXY)">Corr. 12m (ref)</th>
                  <th className="px-3 py-2 text-left" title="Correlación de Pearson entre rendimientos diarios (activo vs. DXY)">Corr. 3m</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {tacticalRows.map(r => {
                  const badge = r.tactico === 'Alcista' ? 'bg-emerald-600/10 text-emerald-700' : r.tactico === 'Bajista' ? 'bg-rose-600/10 text-rose-700' : 'bg-gray-500/10 text-gray-700'
                  const confBadge = r.confianza === 'Alta' ? 'bg-green-600/10 text-green-700' : r.confianza === 'Media' ? 'bg-amber-600/10 text-amber-700' : 'bg-gray-500/10 text-gray-700'
                  const corrIntensity = (v?: number | null) => {
                    if (v == null) return { color: 'text-muted-foreground', label: '—' }
                    const abs = Math.abs(v)
                    // |ρ| ≥ 0.60 → fuerte (verde si +, rojo si –)
                    if (abs >= 0.60) return { color: v > 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold', label: 'fuerte' }
                    // 0.30 ≤ |ρ| < 0.60 → moderada
                    if (abs >= 0.30) return { color: v > 0 ? 'text-green-600' : 'text-red-600', label: 'moderada' }
                    // |ρ| < 0.30 → débil (gris)
                    return { color: 'text-gray-500', label: 'débil' }
                  }
                  const corr12Int = corrIntensity(r.corr12m)
                  const corr3Int = corrIntensity(r.corr3m)
                  
                  const formatCorr = (v: number | null | undefined, window: '3m' | '12m', symbol: string, row: any) => {
                    if (v == null) {
                      return (
                        <span className="text-muted-foreground" title="Correlación no disponible o datos insuficientes">
                          —
                        </span>
                      )
                    }
                    const corrColor = corrIntensity(v).color
                    return (
                      <CorrelationTooltip 
                        correlation={v} 
                        symbol={symbol} 
                        window={window} 
                        usdBias={usd}
                        corr12m={row.corr12m}
                        corr3m={row.corr3m}
                      >
                        <span className={corrColor}>
                          {v.toFixed(2)} (DXY)
                        </span>
                      </CorrelationTooltip>
                    )
                  }
                  
                  return (
                    <tr key={r.par} className="border-t">
                      <td className="px-3 py-2">
                        <Link href={`/narrativas/${r.par.replace('/', '')}`} className="hover:text-primary underline">
                          {r.par}
                        </Link>
                      </td>
                      <td className="px-3 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${badge}`}>{r.tactico}</span></td>
                      <td className="px-3 py-2">{r.accion}</td>
                      <td className="px-3 py-2">
                        <ConfidenceTooltip
                          pair={r.par}
                          confianza={r.confianza || 'Baja'}
                          usdBias={usd}
                          corr12m={r.corr12m ?? null}
                          corr3m={r.corr3m ?? null}
                        >
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${confBadge} cursor-help`}>
                            {r.confianza || 'Baja'}
                          </span>
                        </ConfidenceTooltip>
                        <div className="text-[11px] text-muted-foreground">
                          {r.accion === 'Buscar ventas' ? '→ Mayor prob. de caída' : r.accion === 'Buscar compras' ? '→ Mayor prob. de subida' : '→ Prob. de rango lateral'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {formatCorr(r.corr12m, '12m', r.par, r)}
                      </td>
                      <td className="px-3 py-2">
                        {formatCorr(r.corr3m, '3m', r.par, r)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.motivo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {SHOW_CORR_ON_DASH ? (
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b"><h2 className="font-semibold">Correlaciones con USD amplio (mensual)</h2></div>
            <div className="overflow-x-auto">
              {/* Contenido oculto por flag */}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}


