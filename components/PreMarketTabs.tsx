'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/components/ui/utils'

type TimeFrame = 'm' | 'w' | 'd'

type OverviewData = {
  regimeGlobal: {
    risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
    usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
    growthTrend: 'acelerando' | 'desacelerando' | 'estable'
    inflationTrend: 'acelerando' | 'desacelerando' | 'estable'
    confidence: 'Alta' | 'Media' | 'Baja'
    topDrivers: Array<{ key: string; label: string; reason: string }>
  }
  currencyScoreboard: Array<{
    currency: string
    score: number
    status: 'Fuerte' | 'Neutro' | 'Débil'
  }>
  coreIndicators: Array<{
    key: string
    label: string
    category: 'Crecimiento' | 'Empleo' | 'Inflación' | 'Tipos/Condiciones'
    value: number | null
    previous: number | null
    date: string | null
    date_previous?: string | null
    trend: 'acelera' | 'desacelera' | 'estable'
    importance: 'Alta' | 'Media' | 'Baja'
    unit?: string
    change?: number | null
    hasNewPublication?: boolean
  }>
}

type CorrelationSummary = {
  symbol: string
  benchmark: string
  correlationNow: number | null
  trend: string
}

export type TodayEvent = {
  id: number
  country: string
  currency: string
  indicator: string
  datetime: string
  previous: number | null
  forecast: number | null
  actual: number | null
  surprise: number | null
  impact: 'low' | 'medium' | 'high' | null
  hasNewPublication: boolean
  type: 'upcoming' | 'release'
}

type PreMarketTabsProps = {
  overviewM: OverviewData | null
  overviewW: OverviewData | null
  overviewD: OverviewData | null
  liquidityDisplayState: string
  liquidityRegime: string
  correlations: CorrelationSummary[]
  correlationBenchmark: string
  eventsToday?: TodayEvent[]
}

function formatEventTime(datetimeIso: string): string {
  try {
    const d = new Date(datetimeIso)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })
  } catch {
    return '—'
  }
}

export default function PreMarketTabs({
  overviewM,
  overviewW,
  overviewD,
  liquidityDisplayState,
  liquidityRegime,
  correlations,
  correlationBenchmark,
  eventsToday = [],
}: PreMarketTabsProps) {
  const [activeTab, setActiveTab] = useState<TimeFrame>('m')

  const currentOverview = activeTab === 'm' ? overviewM : activeTab === 'w' ? overviewW : overviewD
  const isDaily = activeTab === 'd'

  // Get today's publications for daily tab
  const todayPublications =
    isDaily && overviewD
      ? overviewD.coreIndicators.filter((ind) => {
          if (ind.hasNewPublication) return true
          if (!ind.date) return false
          const today = new Date().toISOString().split('T')[0]
          return ind.date.startsWith(today)
        })
      : []

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveTab('m')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'm'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Mensual
        </button>
        <button
          onClick={() => setActiveTab('w')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'w'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Semanal
        </button>
        <button
          onClick={() => setActiveTab('d')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'd'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          Diario
        </button>
      </div>

      {/* Regla fija bajo tabs */}
      <p className="text-xs text-muted-foreground">
        Mensual define contexto, semanal confirma, diario informa publicaciones recientes.
      </p>

      {/* Error state */}
      {!currentOverview && (
        <Card className="border-red-500/50">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No se pudo cargar el overview {activeTab === 'm' ? 'mensual' : activeTab === 'w' ? 'semanal' : 'diario'}.
          </CardContent>
        </Card>
      )}

      {/* Content for Daily tab */}
      {isDaily && currentOverview && (
        <div className="space-y-6">
          {/* Bloque 0 — Eventos macro relevantes — Hoy (estándar UI: Card, escenarios solo si hay forecast) */}
          <Card>
            <CardHeader>
              <CardTitle>Eventos macro relevantes — Hoy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {eventsToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay eventos macro relevantes programados para hoy.
                </p>
              ) : (
                <ul className="space-y-5 list-none pl-0">
                  {eventsToday.map((e) => {
                    const actualStr = e.actual != null ? String(e.actual) : '—'
                    const forecastStr = e.forecast != null ? String(e.forecast) : '—'
                    const previousStr = e.previous != null ? String(e.previous) : '—'
                    const hasForecast = e.forecast != null
                    return (
                      <li key={e.id} className="border-b border-border pb-5 last:border-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-sm font-medium text-foreground">{e.indicator}</span>
                          <span className="text-sm text-muted-foreground">({e.country})</span>
                          <span className="text-xs text-muted-foreground">· {formatEventTime(e.datetime)}</span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Actual: {actualStr} · Previsión: {forecastStr} · Anterior: {previousStr}
                        </p>
                        {hasForecast && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1.5">Escenarios (descriptivos):</p>
                            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside pl-0">
                              <li>Si el dato sale por encima de la previsión → contexto de fortaleza en el indicador.</li>
                              <li>Si sale en línea con la previsión → contexto estable.</li>
                              <li>Si sale por debajo de la previsión → contexto de debilidad en el indicador.</li>
                            </ul>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              <p className="text-xs text-muted-foreground pt-2 border-t border-border mt-4">
                Fuente: economic_events y economic_releases. Escenarios descriptivos. No predicciones. No recomendaciones.
              </p>
            </CardContent>
          </Card>

          {/* Bloque 1 — Publicaciones de hoy */}
          <Card>
            <CardHeader>
              <CardTitle>Publicaciones de hoy</CardTitle>
            </CardHeader>
            <CardContent>
              {todayPublications.length === 0 ? (
                <p className="text-sm text-muted-foreground">Hoy no hay nuevas publicaciones dentro del set CORE.</p>
              ) : (
                <div className="space-y-3">
                  {todayPublications.slice(0, 12).map((ind) => (
                    <div key={ind.key} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{ind.label}</span>
                          <Badge variant="outline" className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40">
                            NUEVO
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {ind.value !== null ? (
                            <>
                              <span className="font-medium">{ind.value}</span>
                              {ind.unit && <span className="ml-1">{ind.unit}</span>}
                              {ind.previous !== null && (
                                <span className="ml-2">
                                  (anterior: {ind.previous}
                                  {ind.unit && ` ${ind.unit}`})
                                </span>
                              )}
                            </>
                          ) : (
                            <span>N/A</span>
                          )}
                        </div>
                        {ind.date && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {ind.date.includes('T') ? ind.date.split('T')[0] : ind.date}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bloque 2 — Resumen de cambios */}
          <Card>
            <CardHeader>
              <CardTitle>Resumen de cambios</CardTitle>
            </CardHeader>
            <CardContent>
              {todayPublications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cambios recientes que reportar.</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Hoy se actualizaron {todayPublications.length} indicadores del CORE.{' '}
                  {todayPublications.length > 0 && (
                    <>
                      Cambios más relevantes:{' '}
                      {todayPublications
                        .slice(0, 3)
                        .map((ind) => {
                          const change = ind.change
                          const trend = ind.trend
                          if (change === null || change === undefined) {
                            return `${ind.label} (${trend === 'acelera' ? 'subió' : trend === 'desacelera' ? 'bajó' : 'estable'})`
                          }
                          return `${ind.label} (${change > 0 ? 'subió' : change < 0 ? 'bajó' : 'estable'})`
                        })
                        .join(', ')}
                    </>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content for Mensual/Semanal tabs */}
      {!isDaily && currentOverview && (
        <div className="space-y-6">
          {/* Snapshot Global */}
          <Card>
            <CardHeader>
              <CardTitle>
                Snapshot Global {activeTab === 'w' && <span className="text-sm font-normal text-muted-foreground">(overlay)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="font-medium">Régimen:</span>{' '}
                <Badge variant="outline">{currentOverview.regimeGlobal.risk}</Badge>
              </div>
              <div>
                <span className="font-medium">Confianza:</span> {currentOverview.regimeGlobal.confidence}
              </div>
              <div>
                <span className="font-medium">Crecimiento:</span> {currentOverview.regimeGlobal.growthTrend}
              </div>
              <div>
                <span className="font-medium">Inflación:</span> {currentOverview.regimeGlobal.inflationTrend}
              </div>
              <div>
                <span className="font-medium">USD:</span> {currentOverview.regimeGlobal.usdDirection}
              </div>
              {currentOverview.regimeGlobal.topDrivers.length > 0 && (
                <div>
                  <span className="font-medium">Drivers principales:</span>
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {currentOverview.regimeGlobal.topDrivers.slice(0, 3).map((driver, idx) => (
                      <li key={idx}>
                        • {driver.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liquidez */}
          <Card>
            <CardHeader>
              <CardTitle>Liquidez</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Estado global:</span>{' '}
                <Badge
                  variant="outline"
                  className={
                    liquidityDisplayState === 'Expansiva'
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/40'
                      : liquidityDisplayState === 'Restrictiva'
                      ? 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40'
                      : 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/40'
                  }
                >
                  {liquidityDisplayState}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Régimen:</span> {liquidityRegime}
              </div>
              <p className="text-muted-foreground mt-2">
                {liquidityDisplayState === 'Expansiva' &&
                  'El entorno favorece la asunción de riesgo. La liquidez fluye hacia activos de crecimiento y mercados con mayor volatilidad.'}
                {liquidityDisplayState === 'Restrictiva' &&
                  'La liquidez se reduce. Predomina la preservación de capital y los movimientos defensivos.'}
                {liquidityDisplayState === 'Neutral' &&
                  'La liquidez se mantiene estable, sin una dirección clara del flujo de capital. El mercado muestra un comportamiento mixto y selectivo.'}
              </p>
            </CardContent>
          </Card>

          {/* Monedas clave */}
          <Card>
            <CardHeader>
              <CardTitle>Monedas clave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['USD', 'EUR', 'GBP', 'JPY'].map((ccy) => {
                  const row = currentOverview.currencyScoreboard.find((c) => c.currency === ccy)
                  const status = row?.status ?? '—'
                  return (
                    <div key={ccy} className="border rounded-lg p-3">
                      <div className="font-mono font-medium">{ccy}</div>
                      <Badge variant="outline" className="mt-2">
                        {status}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Correlaciones clave vs DXY */}
          <Card>
            <CardHeader>
              <CardTitle>Correlaciones clave vs {correlationBenchmark}</CardTitle>
            </CardHeader>
            <CardContent>
              {correlations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay correlaciones disponibles.</p>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Símbolo</th>
                          <th className="text-left py-2 px-3 font-medium">Correlación</th>
                          <th className="text-left py-2 px-3 font-medium">Intensidad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {correlations.slice(0, 10).map((corr) => {
                          const intensity =
                            corr.correlationNow === null
                              ? 'N/A'
                              : Math.abs(corr.correlationNow) >= 0.6
                              ? 'Fuerte'
                              : Math.abs(corr.correlationNow) >= 0.3
                              ? 'Moderada'
                              : 'Débil'
                          return (
                            <tr key={corr.symbol} className="border-b">
                              <td className="py-2 px-3 font-medium">{corr.symbol}</td>
                              <td className="py-2 px-3">{corr.correlationNow?.toFixed(2) ?? 'N/A'}</td>
                              <td className="py-2 px-3">
                                <Badge variant="outline">{intensity}</Badge>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Solo se muestran activos con datos suficientes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
