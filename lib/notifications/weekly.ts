/**
 * Weekly ahead notification
 * Caso C: Enviar resumen semanal cada domingo 18:00 Europe/Madrid
 */

import { getUnifiedDB } from '@/lib/db/unified-db'
import { sendTelegramMessage } from './telegram'
import { format, addDays, startOfWeek, endOfWeek, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { incrementMetric } from './metrics'

// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

export interface CalendarEvent {
  fecha: string // YYYY-MM-DD
  hora_local?: string // HH:mm
  pais?: string
  tema: string
  evento: string
  importancia: 'low' | 'med' | 'high'
  consenso?: string
}

/**
 * Insert calendar event (with deduplication)
 * Returns true if inserted, false if duplicate
 */
export async function insertCalendarEvent(event: CalendarEvent): Promise<{ inserted: boolean }> {
  const db = getUnifiedDB()
  
  // Check if event already exists (same fecha, tema, evento)
  const existing = (await db.prepare(`
    SELECT id FROM macro_calendar
    WHERE fecha = ? AND tema = ? AND evento = ?
  `).get(event.fecha, event.tema, event.evento)) as { id: number } | null
  
  if (existing) {
    // Update existing event (in case consenso or hora_local changed)
    await db.prepare(`
      UPDATE macro_calendar
      SET hora_local = ?,
          pais = ?,
          importancia = ?,
          consenso = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      event.hora_local || null,
      event.pais || null,
      event.importancia,
      event.consenso || null,
      existing.id
    )
    return { inserted: false }
  }
  
  // Insert new event
  await db.prepare(`
    INSERT INTO macro_calendar (fecha, hora_local, pais, tema, evento, importancia, consenso)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.fecha,
    event.hora_local || null,
    event.pais || null,
    event.tema,
    event.evento,
    event.importancia,
    event.consenso || null
  )
  
  return { inserted: true }
}

/**
 * Get events for next week (Monday to Sunday)
 * Calculates week range in Europe/Madrid timezone
 */
async function getNextWeekEvents(): Promise<CalendarEvent[]> {
  const db = getUnifiedDB()
  // Get current time in Madrid
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  // Calculate next week (Monday to Sunday) in Madrid timezone
  const nextMonday = startOfWeek(addDays(currentMadrid, 7), { weekStartsOn: 1 })
  const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 })

  const mondayStr = format(nextMonday, 'yyyy-MM-dd')
  const sundayStr = format(nextSunday, 'yyyy-MM-dd')

  const rows = (await db.prepare(`
    SELECT fecha, hora_local, pais, tema, evento, importancia, consenso
    FROM macro_calendar
    WHERE fecha >= ? AND fecha <= ?
      AND importancia IN ('high', 'med')
    ORDER BY fecha, hora_local
  `).all(mondayStr, sundayStr)) as Array<{
    fecha: string
    hora_local: string | null
    pais: string | null
    tema: string
    evento: string
    importancia: string
    consenso: string | null
  }>

  return rows.map(row => ({
    fecha: row.fecha,
    hora_local: row.hora_local || undefined,
    pais: row.pais || undefined,
    tema: row.tema,
    evento: row.evento,
    importancia: row.importancia as 'low' | 'med' | 'high',
    consenso: row.consenso || undefined,
  }))
}

/**
 * Check if weekly was already sent this week
 */
async function wasWeeklySentThisWeek(): Promise<boolean> {
  const db = getUnifiedDB()
  // Use current week in Madrid timezone
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const weekStart = startOfWeek(currentMadrid, { weekStartsOn: 1 })
  const weekKey = format(weekStart, 'yyyy-MM-dd')

  const row = (await db
    .prepare('SELECT semana FROM weekly_sent WHERE semana = ?')
    .get(weekKey)) as { semana: string } | null
  return !!row?.semana
}

/**
 * Mark weekly as sent
 */
async function markWeeklySent(): Promise<void> {
  const db = getUnifiedDB()
  // Use current week in Madrid timezone
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const weekStart = startOfWeek(currentMadrid, { weekStartsOn: 1 })
  const weekKey = format(weekStart, 'yyyy-MM-dd')

  await db.prepare(`
    INSERT OR REPLACE INTO weekly_sent (semana, sent_at)
    VALUES (?, ?)
  `).run(weekKey, new Date().toISOString())
}

/**
 * Format day name in Spanish
 */
function getDayName(date: Date): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return days[date.getDay()]
}

/**
 * Build weekly ahead message
 * All message building logic is inside this function (not at module level)
 */
function buildWeeklyMessage(events: CalendarEvent[]): string {
  // Get current time in Madrid for week calculation
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  // Calculate next week (Monday to Sunday) in Madrid timezone
  const nextMonday = startOfWeek(addDays(currentMadrid, 7), { weekStartsOn: 1 })
  const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 })
  const range = `${format(nextMonday, 'd')}–${format(nextSunday, 'd')} ${format(nextMonday, 'MMM')}`

  let message = `[WEEK AHEAD] ${range} (hora Madrid)\n\n`

  if (events.length === 0) {
    message += 'Sin eventos high/med la próxima semana.'
  } else {
    // Group by day and format
    const eventsByDay = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const date = parseISO(event.fecha)
      const dayKey = format(date, 'yyyy-MM-dd')
      if (!eventsByDay.has(dayKey)) {
        eventsByDay.set(dayKey, [])
      }
      eventsByDay.get(dayKey)!.push(event)
    }

    // Format up to 10 lines
    let lineCount = 0
    const maxLines = 10

    for (const [dayKey, dayEvents] of Array.from(eventsByDay.entries()).sort()) {
      const date = parseISO(dayKey)
      const dayName = getDayName(date)

      for (const event of dayEvents) {
        if (lineCount >= maxLines) break

        let line = `${dayName} — `
        if (event.pais) line += `${event.pais} `
        line += `${event.evento}`
        if (event.hora_local) line += ` ${event.hora_local}`
        if (event.consenso) line += ` (consenso: ${event.consenso})`

        message += line + '\n'
        lineCount++
      }

      if (lineCount >= maxLines) break
    }

    // Add overflow indicator
    if (events.length > maxLines) {
      message += `\n(+${events.length - maxLines} más)`
    }
  }

  return message
}

/**
 * Send weekly ahead notification
 */
export async function sendWeeklyAhead(): Promise<{ success: boolean; error?: string; eventCount?: number }> {
  // Check if already sent this week
  if (await wasWeeklySentThisWeek()) {
    console.log('[weekly] skipped reason=already_sent_this_week')
    return { success: false, error: 'Already sent this week' }
  }

  const events = await getNextWeekEvents()

  // Build message (all logic inside function, not at module level)
  const message = buildWeeklyMessage(events)

  // Send notification
  const result = await sendTelegramMessage(message, { noParseMode: true })
  const sentAtISO = new Date().toISOString()
  
  // Log to notification_history
  try {
    const db = getUnifiedDB()
    await db.prepare(`
      INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'weekly',
      message.substring(0, 200), // Truncate if too long
      result.success ? 'sent' : 'failed',
      result.success ? sentAtISO : null,
      sentAtISO
    )
  } catch (err) {
    console.warn('[weekly] Could not log to notification_history:', err)
  }

  if (result.success) {
    await markWeeklySent()
    incrementMetric('notification_sent', 'status=sent')
    console.log(`[weekly] sent eventCount=${events.length}`)
    return { success: true, eventCount: events.length }
  } else {
    incrementMetric('notification_sent', 'status=failed')
    console.error(`[weekly] failed reason=${result.error || 'unknown'}`)
    return { success: false, error: result.error }
  }
}

/**
 * Get calendar events
 */
export async function getCalendarEvents(startDate?: string, endDate?: string): Promise<CalendarEvent[]> {
  const db = getUnifiedDB()

  let query = 'SELECT fecha, hora_local, pais, tema, evento, importancia, consenso FROM macro_calendar WHERE 1=1'
  const params: any[] = []

  if (startDate) {
    query += ' AND fecha >= ?'
    params.push(startDate)
  }
  if (endDate) {
    query += ' AND fecha <= ?'
    params.push(endDate)
  }

  query += ' ORDER BY fecha, hora_local'

  const rows = (await db.prepare(query).all(...params)) as Array<{
    fecha: string
    hora_local: string | null
    pais: string | null
    tema: string
    evento: string
    importancia: string
    consenso: string | null
  }>

  return rows.map(row => ({
    fecha: row.fecha,
    hora_local: row.hora_local || undefined,
    pais: row.pais || undefined,
    tema: row.tema,
    evento: row.evento,
    importancia: row.importancia as 'low' | 'med' | 'high',
    consenso: row.consenso || undefined,
  }))
}

