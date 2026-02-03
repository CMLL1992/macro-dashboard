/**
 * Telegram message builders — Opción A (configuración final aprobada)
 * Fuente: economic_events + economic_releases; sin activos, sin señales, sin recomendaciones.
 */

import { format, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { env } from '@/lib/env'
import getBiasState from '@/domain/macro-engine/bias'

const TIMEZONE = env.TIMEZONE

type OverviewData = {
  regimeGlobal: {
    risk: 'Risk ON' | 'Risk OFF' | 'Neutral'
    usdDirection: 'Fuerte' | 'Débil' | 'Neutral'
    growthTrend: 'acelerando' | 'desacelerando' | 'estable'
    inflationTrend: 'acelerando' | 'desacelerando' | 'estable'
    confidence: 'Alta' | 'Media' | 'Baja'
    topDrivers: Array<{ key: string; label: string; reason: string }>
  }
}

type ApiEvent = {
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

async function getApiBaseUrl(): Promise<string> {
  let baseUrl = env.APP_URL || 'http://127.0.0.1:3000'
  try {
    const { headers } = await import('next/headers')
    const h = headers()
    const host = h.get('host')
    const proto = h.get('x-forwarded-proto') || 'http'
    if (host) baseUrl = `${proto}://${host}`
  } catch {
    // Not in server context
  }
  return baseUrl
}

async function fetchOverview(tf: 'd' | 'w' | 'm'): Promise<OverviewData | null> {
  try {
    const baseUrl = await getApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/overview?tf=${tf}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as OverviewData
  } catch {
    return null
  }
}

/** Eventos del día desde /api/events (economic_events + economic_releases) */
async function fetchTodayEvents(dateMadrid: Date): Promise<ApiEvent[]> {
  try {
    const from = fromZonedTime(startOfDay(dateMadrid), TIMEZONE).toISOString()
    const to = fromZonedTime(endOfDay(dateMadrid), TIMEZONE).toISOString()
    const baseUrl = await getApiBaseUrl()
    const res = await fetch(`${baseUrl}/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = (await res.json()) as { events?: ApiEvent[] }
    return Array.isArray(data.events) ? data.events : []
  } catch {
    return []
  }
}

function formatEventTime(datetimeIso: string): string {
  try {
    const d = new Date(datetimeIso)
    const madrid = toZonedTime(d, TIMEZONE)
    return format(madrid, 'HH:mm')
  } catch {
    return '—'
  }
}

/** Interpretación macro condicional solo si hay forecast; sin inventar datos. */
function getInterpretationMacro(
  actual: number | null,
  forecast: number | null,
  _indicator: string
): string | null {
  if (forecast == null || actual == null) return null
  const eps = 1e-9
  if (Math.abs(actual - forecast) < eps) return 'Actual en línea con previsión → contexto estable.'
  if (actual > forecast) return 'Actual por encima de previsión → contexto de fortaleza en el indicador.'
  return 'Actual por debajo de previsión → contexto de debilidad en el indicador.'
}

/**
 * Agenda diaria — 08:00 Europe/Madrid
 * Fuente: economic_events + economic_releases. Solo eventos relevantes. Sin activos, sin señales.
 */
export async function buildTelegramDailySummary(chatId: string, date?: Date): Promise<string> {
  const targetDate = date || new Date()
  const madridDate = toZonedTime(targetDate, TIMEZONE)
  const dateStr = format(madridDate, 'yyyy-MM-dd')

  const events = await fetchTodayEvents(madridDate)

  let message = `📊 Resumen Macro Diario — ${format(madridDate, 'dd/MM/yyyy')}\n\n`
  message += `📌 Eventos de hoy:\n\n`

  if (events.length === 0) {
    message += `No hay eventos macro relevantes programados para hoy.\n\n`
  } else {
    for (const e of events) {
      const actualStr = e.actual != null ? String(e.actual) : '—'
      const forecastStr = e.forecast != null ? String(e.forecast) : '—'
      const previousStr = e.previous != null ? String(e.previous) : '—'
      const hora = formatEventTime(e.datetime)

      message += `• ${e.indicator} (${e.country})\n`
      message += `  Hora: ${hora}\n`
      message += `  Actual: ${actualStr}\n`
      message += `  Previsión: ${forecastStr}\n`
      message += `  Anterior: ${previousStr}\n`

      if (e.forecast != null) {
        message += `\n  Escenarios (descriptivos):\n`
        message += `  • Si el dato sale por encima de la previsión → contexto de fortaleza en el indicador.\n`
        message += `  • Si sale en línea con la previsión → contexto estable.\n`
        message += `  • Si sale por debajo de la previsión → contexto de debilidad en el indicador.\n`
      }
      message += '\n'
    }
  }

  message += `ℹ️ Mensaje informativo. No constituye recomendación de inversión.`
  return message
}

/**
 * Resumen semanal — Domingo 09:00 Europe/Madrid
 * Fuente: /api/overview?tf=w + getBiasState(). Sin activos, sin señales.
 */
export async function buildTelegramWeeklySummary(chatId: string, weekRange?: { start: Date; end: Date }): Promise<string> {
  const overview = await fetchOverview('w')
  const biasState = await getBiasState().catch(() => null)

  const liquidityRegime = biasState?.regime.liquidity ?? 'Medium'
  const liquidityDisplayState =
    liquidityRegime === 'High' ? 'Expansiva' : liquidityRegime === 'Low' || liquidityRegime === 'Contracting' ? 'Restrictiva' : 'Neutral'

  let message = `🧭 Resumen Macro Semanal\n\n`

  if (overview?.regimeGlobal) {
    message += `• Crecimiento: ${overview.regimeGlobal.growthTrend}\n`
    message += `• Inflación: ${overview.regimeGlobal.inflationTrend}\n`
    message += `• Liquidez: ${liquidityDisplayState}\n`
    message += `• USD: ${overview.regimeGlobal.usdDirection}\n`
    if (overview.regimeGlobal.topDrivers?.length > 0) {
      overview.regimeGlobal.topDrivers.slice(0, 3).forEach((d) => {
        message += `• ${d.label}: ${d.reason}\n`
      })
    }
  }

  message += `\nEl contexto general no muestra cambios estructurales relevantes.\n\n`
  message += `ℹ️ Resumen informativo. No constituye recomendación.`
  return message
}

/**
 * Mensaje post-dato — Trigger: registro nuevo en economic_releases (actual_value != null, importance high|medium)
 * Contenido: evento publicado, actual vs previsión vs anterior, interpretación macro, contexto /api/overview.
 */
export async function buildTelegramPostDataMessage(params: {
  indicator: string
  country: string
  actual: number
  forecast: number | null
  previous: number | null
  chatId: string
}): Promise<string> {
  const { indicator, country, actual, forecast, previous } = params
  const overview = await fetchOverview('d')
  const biasState = await getBiasState().catch(() => null)

  const liquidityRegime = biasState?.regime.liquidity ?? 'Medium'
  const liquidityDisplayState =
    liquidityRegime === 'High' ? 'Expansiva' : liquidityRegime === 'Low' || liquidityRegime === 'Contracting' ? 'Restrictiva' : 'Neutral'

  let message = `📊 Dato publicado — ${indicator} (${country})\n\n`
  message += `Actual: ${actual}\n`
  message += `Previsión: ${forecast != null ? forecast : '—'}\n`
  message += `Anterior: ${previous != null ? previous : '—'}\n\n`

  const lectura = getLecturaMacroPostDato(indicator, actual, forecast)
  if (lectura) {
    message += `Lectura macro:\n${lectura}\n\n`
  }

  message += `Contexto actual:\n`
  if (overview?.regimeGlobal) {
    message += `• Riesgo: ${overview.regimeGlobal.risk}\n`
    message += `• USD: ${overview.regimeGlobal.usdDirection}\n`
  }
  message += `• Liquidez: ${liquidityDisplayState}\n\n`
  message += `ℹ️ Mensaje informativo, no operativo.`
  return message
}

/** Interpretación macro según tipo de indicador (solo si hay forecast); sin inventar datos. */
function getLecturaMacroPostDato(indicator: string, actual: number, forecast: number | null): string | null {
  if (forecast == null) return null
  const lower = indicator.toLowerCase()
  const above = actual > forecast
  const below = actual < forecast
  if (lower.includes('cpi') || lower.includes('inflación') || lower.includes('consumer price')) {
    if (below) return 'El dato muestra moderación inflacionaria, reduciendo presión monetaria.'
    if (above) return 'El dato muestra presión inflacionaria, manteniendo atención en política monetaria.'
  }
  if (lower.includes('nfp') || lower.includes('payroll') || lower.includes('empleo')) {
    if (above) return 'El dato refleja fortaleza en empleo, contexto favorable para crecimiento.'
    if (below) return 'El dato refleja debilidad en empleo, contexto de cautela macro.'
  }
  if (lower.includes('pmi') || lower.includes('manufacturing')) {
    if (above) return 'El dato apunta a expansión del sector, contexto de actividad favorable.'
    if (below) return 'El dato apunta a contracción del sector, contexto de actividad débil.'
  }
  if (lower.includes('rate') || lower.includes('interest') || lower.includes('tipos')) {
    if (above) return 'Política monetaria más restrictiva; contexto de endurecimiento.'
    if (below) return 'Política monetaria más acomodaticia; contexto de relajación.'
  }
  if (above) return 'Actual por encima de previsión; contexto de fortaleza en el indicador.'
  if (below) return 'Actual por debajo de previsión; contexto de debilidad en el indicador.'
  return 'Actual en línea con previsión; contexto estable.'
}

/**
 * Build alert message (legacy: regime_change, liquidity_change, core_publication, correlation_change)
 */
export async function buildTelegramAlert(
  triggerPayload: {
    type: 'regime_change' | 'liquidity_change' | 'core_publication' | 'correlation_change'
    data: any
  },
  chatId: string
): Promise<string> {
  const now = new Date()
  const madridNow = toZonedTime(now, TIMEZONE)
  const dateStr = format(madridNow, 'dd/MM/yyyy HH:mm')

  let message = `🔔 Alerta Macro — ${dateStr}\n\n`
  message += `Qué pasó:\n`
  switch (triggerPayload.type) {
    case 'regime_change':
      message += `• Cambio de régimen detectado\n`
      if (triggerPayload.data.from && triggerPayload.data.to) {
        message += `  ${triggerPayload.data.from} → ${triggerPayload.data.to}\n`
      }
      break
    case 'liquidity_change':
      message += `• Cambio de liquidez detectado\n`
      if (triggerPayload.data.from && triggerPayload.data.to) {
        message += `  ${triggerPayload.data.from} → ${triggerPayload.data.to}\n`
      }
      break
    case 'core_publication':
      message += `• Nueva publicación CORE relevante\n`
      if (triggerPayload.data.label && triggerPayload.data.value) {
        message += `  ${triggerPayload.data.label}: ${triggerPayload.data.value}${triggerPayload.data.unit || ''}\n`
      }
      break
    case 'correlation_change':
      message += `• Cambio relevante en correlaciones\n`
      if (triggerPayload.data.symbol && triggerPayload.data.change) {
        message += `  ${triggerPayload.data.symbol}: ${triggerPayload.data.change.toFixed(2)}\n`
      }
      break
  }
  message += '\n'
  if (triggerPayload.data.reason) {
    message += `Por qué:\n• ${triggerPayload.data.reason}\n\n`
  }
  if (triggerPayload.data.impact) {
    message += `Impacto:\n• ${triggerPayload.data.impact}\n\n`
  }
  message += `ℹ️ Mensaje informativo. No es señal de trading.`
  return message
}

/**
 * Mensaje de prueba genérico (sin datos inventados).
 * Usado por POST /api/settings/telegram/test para verificar que llegan notificaciones.
 */
export function buildTelegramTestMessage(): string {
  const now = new Date()
  const madrid = toZonedTime(now, TIMEZONE)
  const fechaHora = format(madrid, "dd/MM/yyyy 'a las' HH:mm")
  return `✅ Prueba de Telegram — ${fechaHora}\n\nSi estás leyendo este mensaje, tu configuración de Telegram funciona correctamente.\n\nℹ️ Este canal envía resúmenes macro informativos. No son señales de trading.`
}
