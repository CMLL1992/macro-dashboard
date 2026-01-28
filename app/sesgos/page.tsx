/**
 * Macro Bits v1 — FROZEN (2026-01-28)
 * Uses Macro Overview monthly (/api/overview?tf=m) as single source of truth.
 * Do not change semantics or PROD universe (USD/EUR/GBP/JPY) without a version bump.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { cn } from '@/components/ui/utils'
import InfoTooltip from '@/components/InfoTooltip'
import { headers } from 'next/headers'

type OverviewMonthly = {
  regimeGlobal: {
    risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
    usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
    growthTrend: 'acelerando' | 'desacelerando' | 'estable'
    inflationTrend: 'acelerando' | 'desacelerando' | 'estable'
    confidence: 'Alta' | 'Media' | 'Baja'
    topDrivers: Array<{ key: string; label: string; reason: string }>
  }
  currencyScoreboard: Array<{ currency: string; score: number; status: 'Fuerte' | 'Neutro' | 'Débil' }>
  coreIndicators: Array<{
    key: string
    label: string
    category: 'Crecimiento' | 'Empleo' | 'Inflación' | 'Tipos/Condiciones'
    trend: 'acelera' | 'desacelera' | 'estable'
    importance: 'Alta' | 'Media' | 'Baja'
  }>
}

const PROD_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const

function arrowFromTrend(trend: 'acelera' | 'desacelera' | 'estable'): '↑' | '↓' | '→' {
  if (trend === 'acelera') return '↑'
  if (trend === 'desacelera') return '↓'
  return '→'
}

function getCardBorderByStatus(status: 'Fuerte' | 'Neutro' | 'Débil' | '—') {
  if (status === 'Fuerte') return 'border-green-500/40'
  if (status === 'Débil') return 'border-red-500/40'
  return 'border-gray-500/30'
}

function pickCurrencyDrivers(
  core: OverviewMonthly['coreIndicators'],
  currency: (typeof PROD_CURRENCIES)[number],
): Array<{ label: string; arrow: '↑' | '↓' | '→'; reason?: string }> {
  const prefix =
    currency === 'USD' ? '' : currency === 'EUR' ? 'eu_' : currency === 'GBP' ? 'uk_' : 'jp_'

  const relevant = core.filter((c) => {
    const k = String(c.key || '').toLowerCase()
    if (currency === 'USD') return !k.startsWith('eu_') && !k.startsWith('uk_') && !k.startsWith('jp_')
    return k.startsWith(prefix)
  })

  const importanceRank = (imp: 'Alta' | 'Media' | 'Baja') => (imp === 'Alta' ? 3 : imp === 'Media' ? 2 : 1)

  const sorted = [...relevant]
    .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance))

  const nonStable = sorted.filter((x) => x.trend !== 'estable')
  const pickFrom = nonStable.length > 0 ? nonStable : sorted

  return pickFrom.slice(0, 3).map((d) => ({
    label: d.label,
    arrow: arrowFromTrend(d.trend),
  }))
}

/**
 * Macro Bits v1 — FROZEN (2026-01-28)
 * Helper to fetch the monthly overview used by Macro Bits.
 * Single source of truth: /api/overview?tf=m.
 */
async function fetchOverviewMonthly(): Promise<OverviewMonthly> {
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') || 'http'
  const baseUrl = host ? `${proto}://${host}` : 'http://127.0.0.1:3000'

  const res = await fetch(`${baseUrl}/api/overview?tf=m`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch /api/overview?tf=m (${res.status})`)
  }
  return (await res.json()) as OverviewMonthly
}

export default async function MacroBiasPage() {
  let overview: OverviewMonthly | null = null
  let overviewError: string | null = null
  try {
    overview = await fetchOverviewMonthly()
  } catch (e) {
    overviewError = e instanceof Error ? e.message : String(e)
  }
  const isProd = process.env.NODE_ENV === 'production'

  const scoreboardMajors = overview
    ? overview.currencyScoreboard.filter((c) => (PROD_CURRENCIES as readonly string[]).includes(c.currency))
    : []
  const scoreboardOther = overview
    ? overview.currencyScoreboard.filter((c) => !(PROD_CURRENCIES as readonly string[]).includes(c.currency))
    : []

  const driversGlobal = overview && Array.isArray(overview.regimeGlobal?.topDrivers)
    ? overview.regimeGlobal.topDrivers.slice(0, 5)
    : []

  return (
    <main className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          Macro Bits
          <InfoTooltip text="Macro Bits ofrece contexto macroeconómico descriptivo. No es una recomendación de inversión ni una herramienta operativa." />
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Contexto macroeconómico por moneda basado en crecimiento, inflación, empleo y política monetaria.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-base">📘</span>
              <span>¿Qué es Macro Bits?</span>
              <svg
                className="w-4 h-4 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="mt-4 space-y-4 text-sm text-muted-foreground whitespace-pre-line">
{`📘 ¿Qué es Macro Bits?
Macro Bits ofrece una lectura clara y resumida del contexto macroeconómico actual, basada en datos reales y oficiales.
Su objetivo es ayudarte a entender en qué entorno económico estás operando, sin generar recomendaciones operativas ni recomendaciones de inversión.

🧠 ¿Qué representa Macro Bits?
Macro Bits traduce el estado macroeconómico en un formato fácil de interpretar:
No predice el mercado
No genera recomendaciones de acción
No intenta anticipar movimientos de corto plazo
👉 Su función es describir el entorno macro actual para que tú tomes decisiones con contexto.

🌍 1. Resumen Global
El bloque de Resumen Global muestra el estado general de la economía usando datos mensuales:
Régimen macro: Risk ON / Risk OFF / Neutral
Confianza: nivel de consistencia de los datos
Crecimiento: acelerando, desacelerando o estable
Inflación: tendencia actual
USD: fortaleza relativa de la divisa
Este resumen representa el marco macro de referencia, no el movimiento diario del mercado.

💱 2. Macro Bits por moneda
Cada tarjeta resume el contexto macro de una divisa principal:
Estado macro: Fuerte / Neutro / Débil
Drivers principales: indicadores que más influyen actualmente
Tendencia económica: basada en crecimiento, inflación y política monetaria
Solo se muestran:
🇺🇸 USD
🇪🇺 EUR
🇬🇧 GBP
🇯🇵 JPY
📌 El análisis es descriptivo, no operativo.

📊 3. Drivers principales (globales)
Este bloque muestra los indicadores que más están influyendo en el entorno macro actual, por ejemplo:
PIB
Inflación
Empleo
Actividad económica
Los drivers se seleccionan según:
relevancia económica
magnitud del cambio
impacto en el ciclo macro

⏱️ ¿Por qué se usa el marco mensual?
Macro Bits utiliza datos mensuales porque:
El ciclo macroeconómico cambia lentamente
Los datos oficiales se publican mensualmente
Evita ruido de corto plazo
Refleja mejor el entorno real del mercado
👉 El objetivo es mostrar contexto estructural, no volatilidad diaria.

ℹ️ Notas importantes
“N/A” significa que el dato no aplica o no está disponible
“—” indica que no hay comparación válida
Las flechas muestran dirección del cambio; no implican acción
Los datos provienen de fuentes oficiales (BLS, BEA, ECB, etc.)

⚠️ Aviso importante
Macro Bits no es un sistema de señales.
Es una herramienta de análisis macroeconómico para:
entender el entorno
contextualizar movimientos del mercado
apoyar decisiones, no tomarlas por ti`}
            </div>
          </details>
        </CardContent>
      </Card>

      {overviewError && (
        <Card>
          <CardHeader>
            <CardTitle>Estado</CardTitle>
            <CardDescription>No se pudo cargar el Overview mensual</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {overviewError}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Resumen Global</CardTitle>
          <CardDescription>
            Resumen mensual (base) del entorno macro global
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          <ul className="space-y-1 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Régimen (Mensual):</span>{' '}
              {overview?.regimeGlobal?.risk ?? '—'} (Confianza: {overview?.regimeGlobal?.confidence ?? '—'})
            </li>
            <li>
              <span className="font-medium text-foreground">Crecimiento:</span>{' '}
              {overview?.regimeGlobal?.growthTrend ?? '—'}
            </li>
            <li>
              <span className="font-medium text-foreground">Inflación:</span>{' '}
              {overview?.regimeGlobal?.inflationTrend ?? '—'}
            </li>
            <li>
              <span className="font-medium text-foreground">USD:</span>{' '}
              {overview?.regimeGlobal?.usdDirection ?? '—'}
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PROD_CURRENCIES.map((ccy) => {
          const row = scoreboardMajors.find((r) => r.currency === ccy)
          const status: 'Fuerte' | 'Neutro' | 'Débil' | '—' = row?.status ?? '—'
          const drivers = overview ? pickCurrencyDrivers(overview.coreIndicators, ccy) : []
          return (
            <Card key={ccy} className={cn('border', getCardBorderByStatus(status))}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="font-mono">{ccy}</span>
                  <Badge variant="outline">{status}</Badge>
                </CardTitle>
                <CardDescription>Bits por moneda (mensual)</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Estado macro:</span> {status}
                </div>
                <div className="text-muted-foreground">
                  <span className="font-medium text-foreground">Drivers principales:</span>
                  {drivers.length === 0 ? (
                    <span> Sin drivers disponibles</span>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {drivers.map((d, idx) => (
                        <li key={`${ccy}-d-${idx}`} className="flex items-start gap-2">
                          <span className="text-muted-foreground">{d.arrow}</span>
                          <span className="text-muted-foreground">{d.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Nota: contexto descriptivo (no operativo).
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Drivers principales (globales)
            <InfoTooltip text="Lista corta basada en los drivers del Overview mensual. Describe qué está influyendo más en el entorno macro global." />
          </CardTitle>
          <CardDescription>Top drivers del Overview mensual</CardDescription>
        </CardHeader>
        <CardContent>
          {driversGlobal.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sin drivers disponibles.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {driversGlobal.map((d) => (
                <li key={d.key} className="rounded-md border p-3">
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{d.reason}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!isProd && scoreboardOther.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <span>Experimental (solo desarrollo)</span>
                <Badge variant="outline" className="text-yellow-700 border-yellow-400/50 bg-yellow-500/10">
                  DEBUG/Experimental
                </Badge>
                <svg
                  className="w-4 h-4 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="mt-3 text-sm text-muted-foreground">
                <p className="mb-3">
                  En PROD solo se muestran USD/EUR/GBP/JPY. El resto se mantiene fuera de la vista principal.
                </p>
                <div className="flex flex-wrap gap-2">
                  {scoreboardOther.map((c) => (
                    <Badge key={c.currency} variant="outline">
                      {c.currency}: {c.status}
                    </Badge>
                  ))}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        Macro Bits ofrece contexto. No es una recomendación de inversión.
      </div>
    </main>
  )
}
