/**
 * Notificaciones diarias de calendario con escenarios what-if
 * Envía eventos del día con posibles escenarios (mejor/peor/estable)
 */

import { sendTelegramMessage } from './telegram'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

/**
 * Generar escenarios what-if para un evento
 */
function generateWhatIfScenarios(event: {
  name: string
  currency: string
  consensus_value?: number | null
  previous_value?: number | null
  directionality: 'higher_is_positive' | 'lower_is_positive' | null
}): Array<{ scenario: string; impact: string; pairs: string[] }> {
  const scenarios: Array<{ scenario: string; impact: string; pairs: string[] }> = []
  
  const currency = event.currency
  const isPositiveHigher = event.directionality === 'higher_is_positive'
  const isPositiveLower = event.directionality === 'lower_is_positive'
  
  // Determinar pares afectados según la moneda
  const affectedPairs: Record<string, string[]> = {
    USD: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF', 'XAUUSD'],
    EUR: ['EURUSD', 'EURGBP', 'EURAUD', 'EURJPY', 'EURCHF'],
    GBP: ['GBPUSD', 'EURGBP', 'GBPAUD', 'GBPJPY', 'GBPCHF'],
    JPY: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY'],
    AUD: ['AUDUSD', 'EURAUD', 'GBPAUD', 'AUDJPY', 'AUDNZD'],
  }
  
  const pairs = affectedPairs[currency] || []
  
  // Escenario: Mejor de lo esperado
  if (isPositiveHigher) {
    scenarios.push({
      scenario: '📈 Mejor de lo esperado',
      impact: `Favorable para ${currency}. El dato supera el consenso, lo que podría fortalecer ${currency} y generar presión alcista en pares relacionados.`,
      pairs: pairs,
    })
  } else if (isPositiveLower) {
    scenarios.push({
      scenario: '📉 Mejor de lo esperado',
      impact: `Favorable para ${currency}. El dato es menor que el consenso (lo cual es positivo), lo que podría fortalecer ${currency} y generar presión alcista.`,
      pairs: pairs,
    })
  } else {
    // Sin directionality definida, usar lógica genérica
    scenarios.push({
      scenario: '📈 Mejor de lo esperado',
      impact: `Favorable para ${currency}. El dato supera el consenso, lo que podría fortalecer ${currency}.`,
      pairs: pairs,
    })
  }
  
  // Escenario: Peor de lo esperado
  if (isPositiveHigher) {
    scenarios.push({
      scenario: '📉 Peor de lo esperado',
      impact: `Desfavorable para ${currency}. El dato está por debajo del consenso, lo que podría debilitar ${currency} y generar presión bajista.`,
      pairs: pairs,
    })
  } else if (isPositiveLower) {
    scenarios.push({
      scenario: '📈 Peor de lo esperado',
      impact: `Desfavorable para ${currency}. El dato es mayor que el consenso (lo cual es negativo), lo que podría debilitar ${currency} y generar presión bajista.`,
      pairs: pairs,
    })
  } else {
    // Sin directionality definida, usar lógica genérica
    scenarios.push({
      scenario: '📉 Peor de lo esperado',
      impact: `Desfavorable para ${currency}. El dato está por debajo del consenso, lo que podría debilitar ${currency}.`,
      pairs: pairs,
    })
  }
  
  // Escenario: En línea con consenso
  scenarios.push({
    scenario: '➡️ En línea con consenso',
    impact: `Neutral para ${currency}. El dato está en línea con las expectativas, lo que sugiere continuidad en las tendencias actuales sin cambios significativos.`,
    pairs: pairs,
  })
  
  return scenarios
}

/**
 * Enviar resumen diario de eventos con escenarios what-if
 */
export async function sendDailyCalendarWithScenarios(): Promise<void> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const query = `
    SELECT 
      name, currency, country, importance,
      scheduled_time_utc, consensus_value, previous_value, directionality
    FROM economic_events
    WHERE scheduled_time_utc >= ? 
      AND scheduled_time_utc < ?
      AND importance IN ('high', 'medium')
    ORDER BY scheduled_time_utc ASC, importance DESC
  `

  let events: any[] = []
  if (usingTurso) {
    events = await db.prepare(query).all(
      today.toISOString(),
      tomorrow.toISOString()
    ) as any[]
  } else {
    events = db.prepare(query).all(
      today.toISOString(),
      tomorrow.toISOString()
    ) as any[]
  }

  if (events.length === 0) {
    await sendTelegramMessage(
      '📅 *Calendario del Día*\n\n' +
      `*${format(today, 'EEEE dd/MM/yyyy', { locale: es })}*\n\n` +
      'No hay eventos importantes programados para hoy.',
      { noParseMode: false }
    )
    return
  }

  // Agrupar por hora
  const byHour = new Map<string, typeof events>()
  for (const event of events) {
    const hour = format(toZonedTime(new Date(event.scheduled_time_utc), TIMEZONE), 'HH:mm')
    if (!byHour.has(hour)) {
      byHour.set(hour, [])
    }
    byHour.get(hour)!.push(event)
  }

  // Crear mensaje
  let message = '📅 *Calendario del Día*\n\n'
  message += `*${format(today, 'EEEE dd/MM/yyyy', { locale: es })}*\n\n`

  const sortedHours = Array.from(byHour.keys()).sort()
  
  for (const hour of sortedHours) {
    const hourEvents = byHour.get(hour)!
    
    message += `*🕐 ${hour}*\n\n`
    
    for (const event of hourEvents) {
      const importanceEmoji = event.importance === 'high' ? '🔴' : '🟡'
      message += `${importanceEmoji} *${event.name}* (${event.currency})\n`
      message += `   📍 ${event.country}\n`
      
      if (event.consensus_value != null) {
        message += `   📊 Consenso: ${event.consensus_value.toFixed(2)}\n`
      }
      if (event.previous_value != null) {
        message += `   📈 Anterior: ${event.previous_value.toFixed(2)}\n`
      }
      
      // Generar escenarios what-if
      const scenarios = generateWhatIfScenarios({
        name: event.name,
        currency: event.currency,
        consensus_value: event.consensus_value,
        previous_value: event.previous_value,
        directionality: event.directionality,
      })
      
      if (scenarios.length > 0) {
        message += `\n   *Escenarios posibles:*\n`
        for (const scenario of scenarios) {
          message += `   ${scenario.scenario}\n`
          message += `   ${scenario.impact}\n`
          if (scenario.pairs.length > 0) {
            message += `   Pares afectados: ${scenario.pairs.slice(0, 5).join(', ')}${scenario.pairs.length > 5 ? '...' : ''}\n`
          }
          message += `\n`
        }
      }
      
      message += '\n'
    }
  }

  message += `_Total: ${events.length} evento${events.length !== 1 ? 's' : ''} importante${events.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

