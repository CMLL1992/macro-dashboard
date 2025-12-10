/**
 * Daily digest notification
 * Optional daily summary at 17:00 Europe/Madrid
 */

import { getDB } from '@/lib/db/schema'
import { sendTelegramMessage } from './telegram'
import { format, startOfDay, endOfDay, addDays, parseISO } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { incrementMetric } from './metrics'
import { getCurrentNarrative } from './narrative'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'
const ENABLE_DAILY_DIGEST = process.env.ENABLE_DAILY_DIGEST === 'true'

/**
 * Check if digest was already sent today
 */
function wasDigestSentToday(): boolean {
  if (!ENABLE_DAILY_DIGEST) return false

  const db = getDB()
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const today = format(startOfDay(currentMadrid), 'yyyy-MM-dd')

  const row = db.prepare('SELECT fecha FROM daily_digest_sent WHERE fecha = ?').get(today) as { fecha: string } | undefined
  return !!row
}

/**
 * Mark digest as sent today
 */
function markDigestSent(): void {
  const db = getDB()
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const today = format(startOfDay(currentMadrid), 'yyyy-MM-dd')
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO daily_digest_sent (fecha, sent_at)
    VALUES (?, ?)
    ON CONFLICT(fecha) DO UPDATE SET sent_at = excluded.sent_at
  `).run(today, now)
}

/**
 * Get news count by impact for today
 */
function getTodayNewsCounts(): { high: number; med: number; low: number } {
  const db = getDB()
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const todayStart = format(startOfDay(currentMadrid), 'yyyy-MM-dd')
  const todayEnd = format(endOfDay(currentMadrid), 'yyyy-MM-dd')

  const rows = db.prepare(`
    SELECT impacto, COUNT(*) as count
    FROM news_items
    WHERE DATE(published_at) BETWEEN ? AND ?
    GROUP BY impacto
  `).all(todayStart, todayEnd) as Array<{ impacto: string; count: number }>

  const counts = { high: 0, med: 0, low: 0 }
  for (const row of rows) {
    if (row.impacto === 'high') counts.high = row.count
    else if (row.impacto === 'med') counts.med = row.count
    else if (row.impacto === 'low') counts.low = row.count
  }

  return counts
}

/**
 * Get next 3 high-impact events until tomorrow 12:00
 */
function getNextHighEvents(): Array<{ fecha: string; hora_local: string | null; pais: string | null; evento: string }> {
  const db = getDB()
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const tomorrow = addDays(currentMadrid, 1)
  const tomorrowNoon = format(tomorrow.setHours(12, 0, 0, 0), 'yyyy-MM-dd HH:mm')

  const rows = db.prepare(`
    SELECT fecha, hora_local, pais, evento
    FROM macro_calendar
    WHERE importancia = 'high'
      AND (fecha || ' ' || COALESCE(hora_local, '00:00')) <= ?
    ORDER BY fecha, hora_local
    LIMIT 3
  `).all(tomorrowNoon) as Array<{
    fecha: string
    hora_local: string | null
    pais: string | null
    evento: string
  }>

  return rows
}

/**
 * Check if narrative changed today
 */
function getNarrativeChangeToday(): { changed: boolean; from?: string; to?: string } {
  const db = getDB()
  const currentUTC = new Date()
  const currentMadrid = toZonedTime(currentUTC, TIMEZONE)
  const todayStart = format(startOfDay(currentMadrid), 'yyyy-MM-dd')

  const row = db.prepare(`
    SELECT narrativa_anterior, narrativa_actual, cambiado_en
    FROM narrative_state
    WHERE DATE(cambiado_en) = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(todayStart) as {
    narrativa_anterior: string | null
    narrativa_actual: string
    cambiado_en: string
  } | undefined

  if (row && row.narrativa_anterior && row.narrativa_anterior !== row.narrativa_actual) {
    return {
      changed: true,
      from: row.narrativa_anterior,
      to: row.narrativa_actual,
    }
  }

  return { changed: false }
}

/**
 * Build daily digest message
 */
function buildDigestMessage(): string {
  const counts = getTodayNewsCounts()
  const narrative = getCurrentNarrative()
  const narrativeChange = getNarrativeChangeToday()
  const nextEvents = getNextHighEvents()

  let message = '[DIGEST] Resumen del día\n\n'

  // News counts
  message += `📊 Noticias hoy:\n`
  message += `  • High: ${counts.high}\n`
  message += `  • Med: ${counts.med}\n`
  message += `  • Low: ${counts.low}\n\n`

  // Narrative
  message += `📈 Narrativa actual: ${narrative}\n`
  if (narrativeChange.changed) {
    message += `  (Cambio: ${narrativeChange.from} → ${narrativeChange.to})\n`
  }
  message += '\n'

  // Next events
  if (nextEvents.length > 0) {
    message += `📅 Próximos eventos high (hasta mañana 12:00):\n`
    for (const event of nextEvents) {
      const hora = event.hora_local || 'TBD'
      const pais = event.pais || 'N/A'
      message += `  • ${event.fecha} ${hora} — ${pais} ${event.evento}\n`
    }
  } else {
    message += `📅 Sin eventos high hasta mañana 12:00\n`
  }

  return message
}

/**
 * Send daily digest
 */
export async function sendDailyDigest(): Promise<{ success: boolean; error?: string }> {
  if (!ENABLE_DAILY_DIGEST) {
    return { success: false, error: 'Daily digest is disabled' }
  }

  // Check idempotency
  if (wasDigestSentToday()) {
    console.log('[digest] skipped reason=already_sent_today')
    return { success: false, error: 'Already sent today' }
  }

  try {
    const message = buildDigestMessage()
    const result = await sendTelegramMessage(message, { noParseMode: true })
    const sentAtISO = new Date().toISOString()

    // Log to notification_history
    try {
      const db = getDB()
      db.prepare(`
        INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'digest',
        message.substring(0, 200),
        result.success ? 'sent' : 'failed',
        result.success ? sentAtISO : null,
        sentAtISO
      )
    } catch (err) {
      console.warn('[digest] Could not log to notification_history:', err)
    }

    if (result.success) {
      markDigestSent()
      await incrementMetric('notification_sent', 'status=sent')
      console.log('[digest] sent')
      return { success: true }
    } else {
      await incrementMetric('notification_sent', 'status=failed')
      console.error(`[digest] failed reason=${result.error || 'unknown'}`)
      return { success: false, error: result.error }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await incrementMetric('notification_sent', 'status=failed')
    console.error(`[digest] failed reason=${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}




