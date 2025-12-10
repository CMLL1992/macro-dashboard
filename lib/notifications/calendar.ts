/**
 * Notificaciones de Telegram para calendario económico
 * - Nuevos eventos cuando se detectan
 * - Resumen semanal los domingos con eventos de la próxima semana
 */

import { sendTelegramMessage } from './telegram'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { es } from 'date-fns/locale'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

/**
 * Notificar nuevos eventos de calendario detectados
 */
export async function notifyNewCalendarEvents(newEvents: Array<{
  name: string
  currency: string
  country: string
  importance: 'low' | 'medium' | 'high'
  scheduled_time_utc: string
  consensus_value?: number | null
  previous_value?: number | null
}>): Promise<void> {
  if (newEvents.length === 0) return

  // Filtrar solo eventos de importancia medium y high
  const importantEvents = newEvents.filter(e => e.importance !== 'low')
  if (importantEvents.length === 0) return

  // Agrupar por moneda
  const byCurrency: Record<string, typeof importantEvents> = {}
  for (const event of importantEvents) {
    if (!byCurrency[event.currency]) {
      byCurrency[event.currency] = []
    }
    byCurrency[event.currency].push(event)
  }

  // Crear mensaje
  let message = '📅 *Nuevos Eventos de Calendario*\n\n'
  
  for (const [currency, events] of Object.entries(byCurrency)) {
    message += `*${currency}*\n`
    for (const event of events) {
      const date = toZonedTime(new Date(event.scheduled_time_utc), TIMEZONE)
      const dateStr = format(date, 'dd/MM HH:mm')
      const importanceEmoji = event.importance === 'high' ? '🔴' : '🟡'
      
      message += `${importanceEmoji} *${event.name}*\n`
      message += `   📍 ${event.country}\n`
      message += `   🕐 ${dateStr}\n`
      
      if (event.consensus_value != null) {
        message += `   📊 Consenso: ${event.consensus_value.toFixed(2)}\n`
      }
      if (event.previous_value != null) {
        message += `   📈 Anterior: ${event.previous_value.toFixed(2)}\n`
      }
      message += '\n'
    }
  }

  message += `_Total: ${importantEvents.length} evento${importantEvents.length !== 1 ? 's' : ''} nuevo${importantEvents.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

/**
 * Generar y enviar resumen semanal de eventos (domingos)
 */
export async function sendWeeklyCalendarSummary(): Promise<void> {
  const db = isUsingTurso() ? getUnifiedDB() : getDB()
  const now = new Date()
  
  // Calcular inicio y fin de la próxima semana (lunes a domingo)
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + (8 - now.getDay())) // Próximo lunes
  nextMonday.setHours(0, 0, 0, 0)
  
  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6) // Domingo de esa semana
  nextSunday.setHours(23, 59, 59, 999)

  const query = `
    SELECT 
      name, currency, country, importance,
      scheduled_time_utc, consensus_value, previous_value
    FROM economic_events
    WHERE scheduled_time_utc >= ? 
      AND scheduled_time_utc <= ?
      AND importance IN ('high', 'medium')
    ORDER BY scheduled_time_utc ASC, importance DESC
  `

  let events: any[] = []
  if (isUsingTurso()) {
    events = await db.prepare(query).all(
      nextMonday.toISOString(),
      nextSunday.toISOString()
    ) as any[]
  } else {
    events = db.prepare(query).all(
      nextMonday.toISOString(),
      nextSunday.toISOString()
    ) as any[]
  }

  if (events.length === 0) {
    await sendTelegramMessage(
      '📅 *Resumen Semanal de Calendario*\n\n' +
      'No hay eventos importantes programados para la próxima semana.',
      { noParseMode: false }
    )
    return
  }

  // Agrupar por día
  const byDay = new Map<string, typeof events>()
  for (const event of events) {
    const day = event.scheduled_time_utc.split('T')[0]
    if (!byDay.has(day)) {
      byDay.set(day, [])
    }
    byDay.get(day)!.push(event)
  }

  // Crear mensaje
  let message = '📅 *Resumen Semanal - Próximos Eventos*\n\n'
  message += `*Semana del ${format(nextMonday, 'dd/MM')} al ${format(nextSunday, 'dd/MM')}*\n\n`

  const sortedDays = Array.from(byDay.keys()).sort()
  
  for (const day of sortedDays) {
    const dayEvents = byDay.get(day)!
    const date = new Date(day)
    const dayName = format(date, 'EEEE dd/MM', { locale: es })
    
    message += `*${dayName}*\n`
    
    // Separar por importancia
    const highEvents = dayEvents.filter(e => e.importance === 'high')
    const mediumEvents = dayEvents.filter(e => e.importance === 'medium')
    
    if (highEvents.length > 0) {
      message += '🔴 *Alta Importancia*\n'
      for (const event of highEvents) {
        const time = format(toZonedTime(new Date(event.scheduled_time_utc), TIMEZONE), 'HH:mm')
        message += `  • ${event.name} (${event.currency}) - ${time}\n`
        if (event.consensus_value != null) {
          message += `    Consenso: ${event.consensus_value.toFixed(2)}\n`
        }
      }
    }
    
    if (mediumEvents.length > 0) {
      message += '🟡 *Media Importancia*\n'
      for (const event of mediumEvents) {
        const time = format(toZonedTime(new Date(event.scheduled_time_utc), TIMEZONE), 'HH:mm')
        message += `  • ${event.name} (${event.currency}) - ${time}\n`
      }
    }
    
    message += '\n'
  }

  message += `_Total: ${events.length} evento${events.length !== 1 ? 's' : ''} importante${events.length !== 1 ? 's' : ''}_`

  await sendTelegramMessage(message, { noParseMode: false })
}

