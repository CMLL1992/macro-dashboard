export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // No cache, always fresh data

import { getDashboardData, type DashboardData } from '@/lib/dashboard-data'
import { CATEGORY_ORDER } from '@/domain/categories'
import React from 'react'
import { isStaleByFrequency, getFrequencyLabel, SLA_BY_FREQUENCY } from '@/lib/utils/freshness'
import { getIndicatorSource } from '@/lib/sources'
import TacticalTablesClient from '@/components/TacticalTablesClient'
import DateDisplay from '@/components/DateDisplay'
import { TableSkeleton, RegimeSkeleton, ScenariosSkeleton } from '@/components/DashboardSkeleton'
import RecentMacroEvents from '@/components/RecentMacroEvents'
import type { RecentEvent } from '@/components/RecentMacroEvents'
import JobStatusIndicator from '@/components/JobStatusIndicator'
import { Accordion } from '@/components/ui/accordion'
import { formatIndicatorDate, formatIndicatorDateTooltip } from '@/lib/utils/format-indicator-date'
import { formatIndicatorValueSimple } from '@/lib/utils/format-indicator-value'

// Types and helper functions are now in lib/dashboard-data.ts

export default async function DashboardPage({ searchParams }: { searchParams?: Record<string, string> }) {
  void searchParams

  // Get all dashboard data from database (single source of truth)
  let data: DashboardData
  try {
    // Starting data fetch
    data = await getDashboardData()
    
    // Validate that we have actual data
    const hasIndicators = data?.indicators && Array.isArray(data.indicators) && data.indicators.length > 0
    const hasTacticalRows = data?.tacticalRows && Array.isArray(data.tacticalRows) && data.tacticalRows.length > 0
    
    if (!hasIndicators && !hasTacticalRows) {
      console.warn('[Dashboard] No data available, showing loading state')
      // Return loading state if no data
      return (
        <main className="p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 p-6 text-yellow-900 dark:text-yellow-200">
              <h1 className="text-xl font-semibold">Inicializando datos…</h1>
              <p className="mt-2 text-sm">Estamos preparando la base de datos y recalculando correlaciones y sesgos. La página se actualizará automáticamente.</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-yellow-500 dark:bg-yellow-400 animate-pulse"></div>
                <span className="text-xs">Verificando estado del sistema...</span>
              </div>
            </div>
          </div>
        </main>
      )
    }
    
    // Data loaded successfully - simplified logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Dashboard] Data loaded successfully', {
        indicatorsCount: data?.indicators?.length || 0,
        tacticalRowsCount: data?.tacticalRows?.length || 0,
        regime: data?.regime?.overall || 'unknown',
      })
    }
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
          <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-6 text-red-800 dark:text-red-300">
            <h1 className="text-xl font-semibold mb-2">Error al cargar datos del dashboard</h1>
            <p className="text-sm mt-1 font-mono">{errorMessage}</p>
            {errorStack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs">Ver detalles técnicos</summary>
                <pre className="mt-2 text-xs overflow-auto bg-red-100 dark:bg-red-900/30 p-2 rounded">
                  {errorStack}
                </pre>
              </details>
            )}
            <p className="text-xs mt-4 text-red-600 dark:text-red-400">
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
    currencyRegimes,
    indicators: indicatorRows,
    tacticalRows: tacticalRowsSafe,
    scenarios,
    scenariosActive,
    scenariosWatchlist,
    correlations,
    corrInsight,
    usdMarketInsights,
    latestDataDate,
    updatedAt,
    recentEvents,
    meta,
    coverage, // Coverage metrics (EU/US)
  } = data

  // Removed debug logs that could cause serialization issues

  return (
    <main className="p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">CM11 Trading</p>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard macro</h1>
            <p className="text-sm text-muted-foreground">
              Visión consolidada de sesgos, correlaciones y calendario
            </p>
          </div>
          <JobStatusIndicator />
        </div>

        {/* Coverage Metrics (null-safe) */}
        {coverage && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="text-xs text-muted-foreground mb-1">Cobertura de Datos</div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">EU:</span>
                    <span className={`text-sm font-semibold ${coverage.EU.percentage === 100 ? 'text-green-600 dark:text-green-400' : coverage.EU.percentage >= 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {coverage.EU.percentage}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({coverage.EU.withData}/{coverage.EU.total})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">US:</span>
                    <span className={`text-sm font-semibold ${coverage.US.percentage === 100 ? 'text-green-600 dark:text-green-400' : coverage.US.percentage >= 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                      {coverage.US.percentage}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({coverage.US.withData}/{coverage.US.total})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Explicación de la página Dashboard */}
        <Accordion 
          title="📊 ¿Qué muestra esta página?"
          description="Guía completa para entender el dashboard y cómo interpretar todos los datos"
        >
          <div className="space-y-4 text-sm text-foreground">
            <div>
              <h3 className="font-semibold mb-2">1️⃣ Régimen Global del Mercado</h3>
              <p className="mb-2">
                El <strong>Régimen</strong> clasifica el entorno macroeconómico actual combinando múltiples factores:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Régimen:</strong> Clasificación general (Risk ON/OFF, Expansión, Recesión, etc.)</li>
                <li><strong>USD:</strong> Dirección del dólar (Fuerte/Débil/Neutral) basada en datos macro</li>
                <li><strong>Cuadrante:</strong> Combinación de crecimiento e inflación (Reflation, Stagflation, Recession, Goldilocks)</li>
                <li><strong>Liquidez:</strong> Condiciones de liquidez del mercado</li>
                <li><strong>Crédito:</strong> Estado del crédito y condiciones financieras</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo interpretarlo?</strong> Un régimen Risk ON con USD Débil favorece activos de riesgo. Un régimen Risk OFF con USD Fuerte favorece refugios seguros.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2️⃣ Regímenes por Moneda</h3>
              <p className="mb-2">
                Cada moneda principal (USD, EUR, GBP, JPY, AUD) tiene su propio régimen macro calculado independientemente:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Regímenes posibles:</strong> Reflación, Estanflación, Recesión, Goldilocks, Mixto</li>
                <li><strong>Probabilidad (%):</strong> Qué tan probable es que ese régimen sea el correcto según los datos</li>
                <li><strong>Descripción:</strong> Explicación breve del régimen actual</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo usarlo?</strong> Compara los regímenes de diferentes monedas para identificar cuál es más fuerte macroeconómicamente. 
                Una moneda en Goldilocks vs otra en Recesión sugiere que la primera es más fuerte.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3️⃣ Indicadores Económicos</h3>
              <p className="mb-2">
                La tabla muestra los indicadores macro más importantes con:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Valor Actual:</strong> Último dato publicado del indicador</li>
                <li><strong>Valor Previo:</strong> Dato anterior para comparar</li>
                <li><strong>Tendencia:</strong> Mejora/Empeora/Estable respecto al valor anterior</li>
                <li><strong>Postura:</strong> Hawkish (restrictiva), Neutral, o Dovish (laxa) para política monetaria</li>
                <li><strong>Peso:</strong> Qué tan importante es este indicador en el cálculo del score macro</li>
                <li><strong>Score:</strong> Contribución de este indicador al score total de la moneda</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo leerlo?</strong> Valores en verde indican mejora, en rojo empeoramiento. 
                Postura Hawkish normalmente fortalece la moneda, Dovish la debilita.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4️⃣ Sesgos Tácticos</h3>
              <p className="mb-2">
                Cada par de divisas muestra su sesgo macro:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Alcista (Long):</strong> El contexto macro favorece movimientos alcistas del par</li>
                <li><strong>Bajista (Short):</strong> El contexto macro favorece movimientos bajistas del par</li>
                <li><strong>Neutral:</strong> Señales mixtas, priorizar análisis técnico</li>
                <li><strong>Convicción:</strong> Alta/Media/Baja - qué tan fuerte es la señal macro</li>
                <li><strong>Último evento:</strong> El último release económico que afectó a este par</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>⚠️ Importante:</strong> Los sesgos NO son señales de entrada. Son contexto macro que debes combinar con análisis técnico y gestión de riesgo.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">5️⃣ Últimos Eventos Macro</h3>
              <p className="mb-2">
                Muestra los releases económicos más recientes y su impacto:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Evento:</strong> Nombre del indicador publicado (ej: NFP, CPI)</li>
                <li><strong>Sorpresa:</strong> Diferencia entre el valor real y el consenso esperado</li>
                <li><strong>Impacto:</strong> Cómo cambió el score de la moneda tras el release</li>
                <li><strong>Score Antes/Después:</strong> Comparación del score macro antes y después del evento</li>
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                <strong>¿Cómo usarlo?</strong> Los eventos con sorpresas grandes y positivas fortalecen la moneda. 
                Los eventos con sorpresas negativas la debilitan.
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-yellow-900 mb-2">🔒 Recordatorio Importante</p>
              <p className="text-xs text-yellow-800">
                Esta página muestra <strong>contexto macro</strong>, no señales de trading. 
                Tú decides tus operaciones combinando esta información con tu análisis técnico, gestión de riesgo y criterio personal.
              </p>
            </div>
          </div>
        </Accordion>

        {/* Bloque principal de régimen con DateDisplay (UI 3) */}
        <section className="rounded-lg border bg-card p-6">
          <h1 className="text-2xl font-bold mb-2">Régimen actual del mercado</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Visión macro agregada del mercado con los indicadores clave y sesgos tácticos.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm mb-2">
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              Régimen: <strong>{regime.overall || 'Sin clasificar'}</strong>
              {regime.coverage && !regime.coverage.isReliable && (
                <span className="text-xs text-amber-600 dark:text-amber-400" title={regime.coverage.warnings?.join(', ')}>
                  ⚠️
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              USD: <strong>{regime.usd_label || 'Neutral'}</strong>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              Cuadrante: <strong>{regime.quad || 'Sin clasificar'}</strong>
            </span>
            {regime.liquidity && (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                Liquidez: <strong>{regime.liquidity}</strong>
              </span>
            )}
            {regime.credit && (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                Crédito: <strong>{regime.credit}</strong>
              </span>
            )}
            {regime.risk && (
              <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                Riesgo: <strong>{regime.risk}</strong>
              </span>
            )}
          </div>
          {regime.coverage && !regime.coverage.isReliable && (
            <div className="mb-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3 text-xs">
              <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                ⚠️ Régimen calculado con datos incompletos/obsoletos
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                Cobertura: {Math.round(regime.coverage.percentage * 100)}% · 
                Datos obsoletos: {Math.round(regime.coverage.staleRatio * 100)}%
                {regime.coverage.warnings && regime.coverage.warnings.length > 0 && (
                  <span className="ml-2">· {regime.coverage.warnings.join(', ')}</span>
                )}
              </p>
            </div>
          )}
          <div className="text-xs text-muted-foreground mb-3">
            Indicadores (items): {indicatorRows.length} · Pares tácticos: {tacticalRowsSafe.length} · Escenarios detectados: {scenarios.length} · Correlaciones: {correlations.count}
          </div>
          
          {/* Regímenes macro por moneda */}
          {currencyRegimes && (currencyRegimes.USD || currencyRegimes.EUR || currencyRegimes.GBP || currencyRegimes.JPY || currencyRegimes.AUD) && (
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Regímenes Macro por Moneda</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {currencyRegimes.USD && (
                  <div className="border rounded-lg p-3 bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">USD (Estados Unidos)</span>
                      {currencyRegimes.USD.probability != null && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
                          {Math.round((currencyRegimes.USD.probability || 0) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {currencyRegimes.USD.regime === 'reflation' && '🟠 Reflación'}
                      {currencyRegimes.USD.regime === 'stagflation' && '🔴 Estanflación'}
                      {currencyRegimes.USD.regime === 'recession' && '🔵 Recesión'}
                      {currencyRegimes.USD.regime === 'goldilocks' && '🟢 Goldilocks'}
                      {currencyRegimes.USD.regime === 'mixed' && '⚪ Mixto'}
                      {currencyRegimes.USD.regime === 'insufficient_data' && '⚪ Datos insuficientes'}
                      {!currencyRegimes.USD.regime && '⚪ Sin clasificar'}
                    </div>
                    {currencyRegimes.USD.description && (
                      <div className="text-xs text-muted-foreground">{currencyRegimes.USD.description}</div>
                    )}
                  </div>
                )}
                {currencyRegimes.EUR && (
                  <div className="border rounded-lg p-3 bg-yellow-50/30 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">EUR (Eurozona)</span>
                      {currencyRegimes.EUR.probability != null && (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-medium">
                          {Math.round((currencyRegimes.EUR.probability || 0) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {currencyRegimes.EUR.regime === 'reflation' && '🟠 Reflación'}
                      {currencyRegimes.EUR.regime === 'stagflation' && '🔴 Estanflación'}
                      {currencyRegimes.EUR.regime === 'recession' && '🔵 Recesión'}
                      {currencyRegimes.EUR.regime === 'goldilocks' && '🟢 Goldilocks'}
                      {currencyRegimes.EUR.regime === 'mixed' && '⚪ Mixto'}
                      {currencyRegimes.EUR.regime === 'insufficient_data' && '⚪ Datos insuficientes'}
                      {!currencyRegimes.EUR.regime && '⚪ Sin clasificar'}
                    </div>
                    {currencyRegimes.EUR.description && (
                      <div className="text-xs text-muted-foreground">{currencyRegimes.EUR.description}</div>
                    )}
                  </div>
                )}
                {currencyRegimes.GBP && (
                  <div className="border rounded-lg p-3 bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-red-900 dark:text-red-200">GBP (Reino Unido)</span>
                      {currencyRegimes.GBP.probability != null && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-medium">
                          {Math.round((currencyRegimes.GBP.probability || 0) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {currencyRegimes.GBP.regime === 'reflation' && '🟠 Reflación'}
                      {currencyRegimes.GBP.regime === 'stagflation' && '🔴 Estanflación'}
                      {currencyRegimes.GBP.regime === 'recession' && '🔵 Recesión'}
                      {currencyRegimes.GBP.regime === 'goldilocks' && '🟢 Goldilocks'}
                      {currencyRegimes.GBP.regime === 'mixed' && '⚪ Mixto'}
                      {currencyRegimes.GBP.regime === 'insufficient_data' && '⚪ Datos insuficientes'}
                      {!currencyRegimes.GBP.regime && '⚪ Sin clasificar'}
                    </div>
                    {currencyRegimes.GBP.description && (
                      <div className="text-xs text-muted-foreground">{currencyRegimes.GBP.description}</div>
                    )}
                  </div>
                )}
                {currencyRegimes.JPY && (
                  <div className="border rounded-lg p-3 bg-purple-50/30 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">JPY (Japón)</span>
                      {currencyRegimes.JPY.probability != null && (
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 font-medium">
                          {Math.round((currencyRegimes.JPY.probability || 0) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {currencyRegimes.JPY.regime === 'reflation' && '🟠 Reflación'}
                      {currencyRegimes.JPY.regime === 'stagflation' && '🔴 Estanflación'}
                      {currencyRegimes.JPY.regime === 'recession' && '🔵 Recesión'}
                      {currencyRegimes.JPY.regime === 'goldilocks' && '🟢 Goldilocks'}
                      {currencyRegimes.JPY.regime === 'mixed' && '⚪ Mixto'}
                      {currencyRegimes.JPY.regime === 'insufficient_data' && '⚪ Datos insuficientes'}
                      {!currencyRegimes.JPY.regime && '⚪ Sin clasificar'}
                    </div>
                    {currencyRegimes.JPY.description && (
                      <div className="text-xs text-muted-foreground">{currencyRegimes.JPY.description}</div>
                    )}
                  </div>
                )}
                {currencyRegimes.AUD && (
                  <div className="border rounded-lg p-3 bg-green-50/30 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-green-900 dark:text-green-200">AUD (Australia)</span>
                      {currencyRegimes.AUD.probability != null && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-medium">
                          {Math.round((currencyRegimes.AUD.probability || 0) * 100)}%
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {currencyRegimes.AUD.regime === 'reflation' && '🟠 Reflación'}
                      {currencyRegimes.AUD.regime === 'stagflation' && '🔴 Estanflación'}
                      {currencyRegimes.AUD.regime === 'recession' && '🔵 Recesión'}
                      {currencyRegimes.AUD.regime === 'goldilocks' && '🟢 Goldilocks'}
                      {currencyRegimes.AUD.regime === 'mixed' && '⚪ Mixto'}
                      {currencyRegimes.AUD.regime === 'insufficient_data' && '⚪ Datos insuficientes'}
                      {!currencyRegimes.AUD.regime && '⚪ Sin clasificar'}
                    </div>
                    {currencyRegimes.AUD.description && (
                      <div className="text-xs text-muted-foreground">{currencyRegimes.AUD.description}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <JobStatusIndicator />
            <span className="inline-flex items-center gap-2 rounded-full border px-2 py-0.5">
              <DateDisplay
                isoString={updatedAt}
                format="datetime"
                label="Última actualización de datos macro"
                showTimezone={true}
              />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-2 py-0.5 text-sm text-muted-foreground">
              <DateDisplay
                isoString={latestDataDate ? `${latestDataDate}T00:00:00` : null}
                format="date"
                label="Datos macro hasta"
              />
            </span>
          </div>

          {/* Resumen rápido de correlaciones USD */}
          {corrInsight && (
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-semibold">Resumen correlaciones USD:</span>{' '}
                {corrInsight.usdBiasSignal || 'Sin señal clara'}
              </div>
              {corrInsight.strongPairs && corrInsight.strongPairs.length > 0 && (
                <div>
                  <span className="font-semibold">
                    Pares más ligados al USD (|ρ 12m| ≥ 0,60):
                  </span>{' '}
                  {corrInsight.strongPairs.join(', ')}
                </div>
              )}
              {corrInsight.decoupledPairs && corrInsight.decoupledPairs.length > 0 && (
                <div>
                  <span className="font-semibold">
                    Pares desconectados (12m fuerte, 3m débil):
                  </span>{' '}
                  {corrInsight.decoupledPairs.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Insights adicionales del mercado */}
          {usdMarketInsights && (
            <div className="mt-3 text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-semibold">Pares destacados:</span>{' '}
                {usdMarketInsights.topPairsSummary || 'Sin pares destacados'}
              </div>
              <div>
                <span className="font-semibold">Sesgo en pares USD:</span>{' '}
                {usdMarketInsights.actionBiasSummary || 'Sin sesgo detectado'}
              </div>
              <div>
                <span className="font-semibold">Divergencias corr. 3m vs 12m:</span>{' '}
                {usdMarketInsights.divergenceSummary || 'Sin divergencias relevantes'}
              </div>
            </div>
          )}
        </section>

        {/* Últimos eventos macro */}
        {recentEvents && recentEvents.length > 0 && (
          <RecentMacroEvents
            events={recentEvents as RecentEvent[]}
            biasUpdatedAt={meta.bias_updated_at}
            lastEventAppliedAt={meta.last_event_applied_at}
          />
        )}

        {/* Escenarios institucionales - Activos y Watchlist */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-3">Escenarios Institucionales</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Macro decide dirección → Confianza decide si operamos → Técnicos definen timing
          </p>
          
          {/* Escenarios Activos (Confianza Alta) */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-emerald-700 mb-3 uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              Activos (Confianza Alta) - Operar con tamaño normal
            </h3>
            {!scenariosActive || scenariosActive.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted rounded-lg p-4 border border-border">
                <p>Sin escenarios activos.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Los escenarios activos aparecen cuando hay pares con bias fuerte y confianza Alta.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const buyActive = scenariosActive.filter(s => s.direction === 'BUY')
                  const sellActive = scenariosActive.filter(s => s.direction === 'SELL')
                  
                  return (
                    <>
                      {sellActive.length > 0 && (
                        <details className="group border rounded-lg border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30" open>
                          <summary className="cursor-pointer list-none p-3 flex items-center justify-between hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                                SELL (USD Hawkish)
                              </h4>
                              <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-medium">
                                {sellActive.length} {sellActive.length === 1 ? 'par' : 'pares'}
                              </span>
                            </div>
                            <svg 
                              className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="p-3 pt-0 space-y-2">
                            {sellActive.map((s) => (
                              <div key={s.id} className="border rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="font-semibold text-base">{s.title}</div>
                                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    Alta
                                  </span>
                                </div>
                                {s.macroReasons && s.macroReasons.length > 0 && (
                                  <div className="text-xs text-foreground mb-2">
                                    <span className="font-semibold">Razones macro:</span>{' '}
                                    {s.macroReasons.join(' • ')}
                                  </div>
                                )}
                                {s.setupRecommendation && (
                                  <div className="text-sm text-foreground bg-muted/50 rounded p-2 mt-2">
                                    <span className="font-semibold">Setup recomendado:</span>{' '}
                                    {s.setupRecommendation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      
                      {buyActive.length > 0 && (
                        <details className="group border rounded-lg border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30" open>
                          <summary className="cursor-pointer list-none p-3 flex items-center justify-between hover:bg-emerald-100/50 dark:hover:bg-emerald-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-green-700">
                                BUY (USD Dovish)
                              </h4>
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                {buyActive.length} {buyActive.length === 1 ? 'par' : 'pares'}
                              </span>
                            </div>
                            <svg 
                              className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="p-3 pt-0 space-y-2">
                            {buyActive.map((s) => (
                              <div key={s.id} className="border rounded-lg p-4 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="font-semibold text-base">{s.title}</div>
                                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    Alta
                                  </span>
                                </div>
                                {s.macroReasons && s.macroReasons.length > 0 && (
                                  <div className="text-xs text-foreground mb-2">
                                    <span className="font-semibold">Razones macro:</span>{' '}
                                    {s.macroReasons.join(' • ')}
                                  </div>
                                )}
                                {s.setupRecommendation && (
                                  <div className="text-sm text-foreground bg-muted/50 rounded p-2 mt-2">
                                    <span className="font-semibold">Setup recomendado:</span>{' '}
                                    {s.setupRecommendation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
          
          {/* Watchlist (Confianza Media) */}
          <div>
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3 uppercase tracking-wide flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
              Watchlist (Confianza Media) - Scalping / Riesgo controlado
            </h3>
            {!scenariosWatchlist || scenariosWatchlist.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted rounded-lg p-4 border border-border">
                <p>Sin escenarios en watchlist.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Los escenarios en watchlist aparecen cuando hay pares con bias fuerte y confianza Media.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const buyWatchlist = scenariosWatchlist.filter(s => s.direction === 'BUY')
                  const sellWatchlist = scenariosWatchlist.filter(s => s.direction === 'SELL')
                  
                  return (
                    <>
                      {sellWatchlist.length > 0 && (
                        <details className="group border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                          <summary className="cursor-pointer list-none p-3 flex items-center justify-between hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-red-700 dark:text-red-300">
                                SELL (USD Hawkish)
                              </h4>
                              <span className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 font-medium">
                                {sellWatchlist.length} {sellWatchlist.length === 1 ? 'par' : 'pares'}
                              </span>
                            </div>
                            <svg 
                              className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="p-3 pt-0 space-y-2">
                            {sellWatchlist.map((s) => (
                              <div key={s.id} className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="font-medium text-base">{s.title}</div>
                                  <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
                                    Media
                                  </span>
                                </div>
                                {s.macroReasons && s.macroReasons.length > 0 && (
                                  <div className="text-xs text-foreground mb-2">
                                    <span className="font-semibold">Razones macro:</span>{' '}
                                    {s.macroReasons.join(' • ')}
                                  </div>
                                )}
                                {s.setupRecommendation && (
                                  <div className="text-sm text-foreground bg-muted/50 rounded p-2 mt-2">
                                    <span className="font-semibold">Setup recomendado:</span>{' '}
                                    {s.setupRecommendation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      
                      {buyWatchlist.length > 0 && (
                        <details className="group border rounded-lg border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
                          <summary className="cursor-pointer list-none p-3 flex items-center justify-between hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-green-700">
                                BUY (USD Dovish)
                              </h4>
                              <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                {buyWatchlist.length} {buyWatchlist.length === 1 ? 'par' : 'pares'}
                              </span>
                            </div>
                            <svg 
                              className="w-5 h-5 text-muted-foreground transition-transform group-open:rotate-180" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </summary>
                          <div className="p-3 pt-0 space-y-2">
                            {buyWatchlist.map((s) => (
                              <div key={s.id} className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="font-medium text-base">{s.title}</div>
                                  <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium">
                                    Media
                                  </span>
                                </div>
                                {s.macroReasons && s.macroReasons.length > 0 && (
                                  <div className="text-xs text-foreground mb-2">
                                    <span className="font-semibold">Razones macro:</span>{' '}
                                    {s.macroReasons.join(' • ')}
                                  </div>
                                )}
                                {s.setupRecommendation && (
                                  <div className="text-sm text-foreground bg-muted/50 rounded p-2 mt-2">
                                    <span className="font-semibold">Setup recomendado:</span>{' '}
                                    {s.setupRecommendation}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        </section>

        {/* Tabla de indicadores macro */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold mb-3">Indicadores macro</h2>
          {!indicatorRows || indicatorRows.length === 0 ? (
            <TableSkeleton rows={10} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Variable</th>
                    <th className="px-3 py-2 text-left">Dato anterior</th>
                    <th className="px-3 py-2 text-left">Dato actual</th>
                    <th className="px-3 py-2 text-left">Evolución</th>
                    <th className="px-3 py-2 text-left">Postura</th>
                    <th className="px-3 py-2 text-left">Peso</th>
                    <th className="px-3 py-2 text-left">Fecha dato</th>
                    <th className="px-3 py-2 text-left">Última actualización</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Removed debug logging that could cause hydration issues */}
                  {(() => {
                    // Normalize category names for comparison (handle encoding issues)
                    const normalizeCategory = (cat: string) => {
                      if (!cat || typeof cat !== 'string') return ''
                      return cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    }
                    
                    // Group indicators by section (EUROZONA vs GLOBAL)
                    const groupedBySection: Record<string, typeof indicatorRows> = {}
                    for (const row of indicatorRows) {
                      const section = row.section ?? 'GLOBAL'
                      if (!groupedBySection[section]) {
                        groupedBySection[section] = []
                      }
                      groupedBySection[section].push(row)
                    }
                    
                    // Render sections in order: EUROZONA first, then GLOBAL
                    const sections = ['EUROZONA', 'GLOBAL']
                    
                    return sections.map((section) => {
                      const sectionRows = groupedBySection[section] || []
                      if (sectionRows.length === 0) return null
                      
                      return (
                        <React.Fragment key={section}>
                          {/* Section header */}
                          <tr className="bg-blue-50 dark:bg-blue-950/30 border-t-2 border-blue-200 dark:border-blue-800">
                            <td colSpan={8} className="text-sm font-bold uppercase tracking-wide py-3 px-4 text-blue-900 dark:text-blue-200">
                              {section}
                            </td>
                          </tr>
                          {/* Category rows within section */}
                          {CATEGORY_ORDER.map((cat) => {
                            const normalizedCat = normalizeCategory(cat)
                            const categoryRows = sectionRows.filter((row) => {
                              const normalizedRowCategory = normalizeCategory(row.category ?? '')
                              return normalizedRowCategory === normalizedCat
                            })

                            if (!categoryRows.length) {
                              return null
                            }
                            return (
                              <React.Fragment key={`${section}-${cat}`}>
                                <tr className="bg-muted border-t">
                                  <td colSpan={8} className="text-sm font-semibold uppercase tracking-wide py-2 px-3">
                                    {cat}
                                  </td>
                                </tr>
                                {categoryRows.map((row) => {
                        // Format values using indicator config
                         const indicatorKey = (row.originalKey ?? row.key) ?? undefined
                         const valCurrent = formatIndicatorValueSimple(row.value, indicatorKey, row.unit ?? undefined)
                         const valPrevious = formatIndicatorValueSimple(row.previous, indicatorKey, row.unit ?? undefined)

                        const p = row.posture ?? 'Neutral'

                        const trend = row.trend

                        const trendBadge =
                          trend === 'Mejora'
                            ? 'bg-green-600/10 dark:bg-green-500/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                            : trend === 'Empeora'
                            ? 'bg-red-600/10 dark:bg-red-500/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            : trend === 'Estable'
                            ? 'bg-gray-500/10 dark:bg-gray-500/30 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                            : 'bg-gray-500/10 dark:bg-gray-500/30 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'

                          return (
                            <tr key={`${row.originalKey || row.key}-${row.date || 'no-date'}`} className="border-t">
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <span>{row.label}</span>
                                {(() => {
                                  // Use originalKey if available (for EU indicators), otherwise use key
                                  const sourceKey = row.originalKey ?? row.key
                                  const meta = getIndicatorSource(sourceKey)
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
                                      className="text-muted-foreground hover:text-foreground"
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
                            <td className="px-3 py-2 text-muted-foreground">
                              {valPrevious}
                            </td>
                            <td className="px-3 py-2">
                              {valCurrent}
                            </td>
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
                            <td className="px-3 py-2">
                              {row.weight != null ? row.weight.toFixed(2) : '—'}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <span 
                                  title={row.date ? formatIndicatorDateTooltip(row.date, row.observation_period) : ''}
                                >
                                  {formatIndicatorDate(row.date, indicatorKey)}
                                </span>
                                {row.isStale && row.date && (
                                  <span
                                    className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] px-1.5 py-0.5"
                                    title={`Dato desactualizado según frecuencia de la serie; último dato: ${formatIndicatorDateTooltip(row.date)}`}
                                  >
                                    Desactualizado
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {row.lastUpdated ? (
                                <span title={`Última actualización del indicador en BD: ${row.lastUpdated}`}>
                                  {formatIndicatorDate(row.lastUpdated, indicatorKey)}
                                </span>
                              ) : row.date ? (
                                <span title={`Fecha del dato (última actualización no disponible): ${row.date}`}>
                                  {formatIndicatorDate(row.date, indicatorKey)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                              </React.Fragment>
                            )
                          })}
                        </React.Fragment>
                      )
                    })
                  })()}
                  </tbody>
                </table>
              </div>
            )}
        </section>

        {tacticalRowsSafe && tacticalRowsSafe.length > 0 ? (
          <TacticalTablesClient rows={tacticalRowsSafe} />
        ) : (
          <section className="rounded-lg border bg-card p-6">
            <h2 className="text-lg font-semibold mb-3">Pares tácticos</h2>
            <p className="text-sm text-muted-foreground">Cargando datos tácticos...</p>
          </section>
        )}
      </div>
    </main>
  )
}
