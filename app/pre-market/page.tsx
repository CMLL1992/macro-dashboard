/**
 * Pre-Market Macro — Opción A (configuración final)
 * Contexto macro descriptivo antes de analizar gráficos.
 * Tab Diario: eventos macro relevantes (economic_events + economic_releases) + publicaciones CORE.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { headers } from 'next/headers'
import { startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { env } from '@/lib/env'
import PreMarketInfoPanel from '@/components/PreMarketInfoPanel'
import PreMarketTabs, { type TodayEvent } from '@/components/PreMarketTabs'
import getBiasState from '@/domain/macro-engine/bias'
import getCorrelationState from '@/domain/macro-engine/correlations'

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

async function fetchOverview(tf: TimeFrame): Promise<OverviewData | null> {
  try {
    const h = await headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') || 'http'
    const baseUrl = host ? `${proto}://${host}` : 'http://127.0.0.1:3000'

    const res = await fetch(`${baseUrl}/api/overview?tf=${tf}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as OverviewData
  } catch {
    return null
  }
}

async function fetchTodayEvents(): Promise<TodayEvent[]> {
  try {
    const h = await headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') || 'http'
    const baseUrl = host ? `${proto}://${host}` : 'http://127.0.0.1:3000'
    const now = new Date()
    const madridNow = toZonedTime(now, env.TIMEZONE)
    const from = fromZonedTime(startOfDay(madridNow), env.TIMEZONE).toISOString()
    const to = fromZonedTime(endOfDay(madridNow), env.TIMEZONE).toISOString()
    const res = await fetch(`${baseUrl}/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { events?: unknown[] }
    return (Array.isArray(data.events) ? data.events : []) as TodayEvent[]
  } catch {
    return []
  }
}

export default async function PreMarketPage() {
  const [overviewM, overviewW, overviewD, biasState, correlationState, eventsToday] = await Promise.all([
    fetchOverview('m'),
    fetchOverview('w'),
    fetchOverview('d'),
    getBiasState().catch(() => null),
    getCorrelationState().catch(() => null),
    fetchTodayEvents(),
  ])

  // Get liquidity state
  const liquidityRegime = biasState?.regime.liquidity ?? 'Medium'
  const liquidityScore = biasState?.metrics.liquidityScore ?? null

  // Map liquidity regime to display state
  const liquidityDisplayState =
    liquidityRegime === 'High' ? 'Expansiva' : liquidityRegime === 'Low' || liquidityRegime === 'Contracting' ? 'Restrictiva' : 'Neutral'

  // Get top correlations (8-10)
  const correlations = correlationState?.summary
    ? correlationState.summary
        .filter((c) => c.correlationNow != null)
        .sort((a, b) => {
          const aAbs = Math.abs(a.correlationNow ?? 0)
          const bAbs = Math.abs(b.correlationNow ?? 0)
          return bAbs - aAbs
        })
        .slice(0, 10)
    : []

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pre-Market Macro</h1>
        <p className="text-xs text-muted-foreground mt-1 font-medium">Contexto Pre-Market</p>
        <p className="text-sm text-muted-foreground mt-2">
          Contexto macro descriptivo antes de analizar gráficos. Mensual define contexto, semanal confirma, diario informa publicaciones recientes.
        </p>
      </div>

      {/* InfoPanel desplegable arriba */}
      <PreMarketInfoPanel />

      {/* Cómo usar esta vista — refuerzo de propósito, sin interpretación operativa */}
      <div className="text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Cómo usar esta vista:</p>
        <p>Utiliza esta página como referencia macro previa al análisis de gráficos.</p>
        <p>El marco mensual define el contexto, el semanal lo confirma y el diario muestra los eventos recientes.</p>
      </div>

      {/* Tabs */}
      <PreMarketTabs
        overviewM={overviewM}
        overviewW={overviewW}
        overviewD={overviewD}
        liquidityDisplayState={liquidityDisplayState}
        liquidityRegime={liquidityRegime}
        correlations={correlations}
        correlationBenchmark={correlationState?.benchmark ?? 'DXY'}
        eventsToday={eventsToday}
      />
    </main>
  )
}
