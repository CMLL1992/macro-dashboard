/**
 * News item notification handler
 * Caso A: Notificar cada vez que se inserta una noticia nueva
 */

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { sendTelegramMessage } from './telegram'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { incrementMetric } from './metrics'
import { getNotificationSettingNumber } from './settings'

// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

export interface NewsItem {
  id_fuente: string
  fuente: string
  pais?: string
  tema?: string
  titulo: string
  impacto: 'low' | 'med' | 'high'
  published_at: string // UTC ISO string
  resumen?: string
  valor_publicado?: number
  valor_esperado?: number
}

// Get dedup window from settings (DB) or env or default
async function getDedupWindowHours(): Promise<number> {
  return (await getNotificationSettingNumber('NEWS_DEDUP_WINDOW_HOURS')) || 2
}

/**
 * Insert news item and trigger notification if new
 */
export async function insertNewsItem(item: NewsItem): Promise<{ inserted: boolean; notified: boolean; error?: string }> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()

  try {
    // Check if already exists (deduplication)
    let existing: { id: number; notificado_at: string | null; published_at: string } | undefined
    if (usingTurso) {
      existing = await db.prepare(`
        SELECT id, notificado_at, published_at 
        FROM news_items 
        WHERE fuente = ? AND id_fuente = ?
      `).get(item.fuente, item.id_fuente) as { id: number; notificado_at: string | null; published_at: string } | undefined
    } else {
      existing = db.prepare(`
        SELECT id, notificado_at, published_at 
        FROM news_items 
        WHERE fuente = ? AND id_fuente = ?
      `).get(item.fuente, item.id_fuente) as { id: number; notificado_at: string | null; published_at: string } | undefined
    }

    if (existing) {
      // Check if within dedup window
      const publishedAt = new Date(existing.published_at)
      const now = new Date()
      const hoursDiff = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60)

      const dedupWindowHours = await getDedupWindowHours()
      if (hoursDiff < dedupWindowHours && existing.notificado_at) {
        return { inserted: false, notified: false }
      }
    }

    // Insert or update
    if (usingTurso) {
      await db.prepare(`
        INSERT INTO news_items (
          id_fuente, fuente, pais, tema, titulo, impacto, 
          published_at, resumen, valor_publicado, valor_esperado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fuente, id_fuente) DO UPDATE SET
          titulo = excluded.titulo,
          impacto = excluded.impacto,
          published_at = excluded.published_at,
          resumen = excluded.resumen,
          valor_publicado = excluded.valor_publicado,
          valor_esperado = excluded.valor_esperado
      `).run(
        item.id_fuente,
        item.fuente,
        item.pais || null,
        item.tema || null,
        item.titulo,
        item.impacto,
        item.published_at,
        item.resumen || null,
        item.valor_publicado ?? null,
        item.valor_esperado ?? null
      )
    } else {
      db.prepare(`
        INSERT INTO news_items (
          id_fuente, fuente, pais, tema, titulo, impacto, 
          published_at, resumen, valor_publicado, valor_esperado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(fuente, id_fuente) DO UPDATE SET
          titulo = excluded.titulo,
          impacto = excluded.impacto,
          published_at = excluded.published_at,
          resumen = excluded.resumen,
          valor_publicado = excluded.valor_publicado,
          valor_esperado = excluded.valor_esperado
      `).run(
        item.id_fuente,
        item.fuente,
        item.pais || null,
        item.tema || null,
        item.titulo,
        item.impacto,
        item.published_at,
        item.resumen || null,
        item.valor_publicado ?? null,
        item.valor_esperado ?? null
      )
    }

    // Get the inserted/updated row
    let row: { id: number; notificado_at: string | null }
    if (usingTurso) {
      row = await db.prepare(`
        SELECT id, notificado_at FROM news_items 
        WHERE fuente = ? AND id_fuente = ?
      `).get(item.fuente, item.id_fuente) as { id: number; notificado_at: string | null }
    } else {
      row = db.prepare(`
        SELECT id, notificado_at FROM news_items 
        WHERE fuente = ? AND id_fuente = ?
      `).get(item.fuente, item.id_fuente) as { id: number; notificado_at: string | null }
    }

    // If not notified yet, send notification
    if (!row.notificado_at) {
      const notified = await notifyNewsItem(item)
      const now = new Date().toISOString()
      
      // Log to notification_history
      try {
        if (usingTurso) {
          await db.prepare(`
            INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            'news',
            `[NEW] ${item.pais || 'N/A'}/${item.tema || 'N/A'} — ${item.titulo}`,
            notified.success ? 'sent' : 'failed',
            notified.success ? now : null,
            now
          )
        } else {
          db.prepare(`
            INSERT INTO notification_history (tipo, mensaje, status, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            'news',
            `[NEW] ${item.pais || 'N/A'}/${item.tema || 'N/A'} — ${item.titulo}`,
            notified.success ? 'sent' : 'failed',
            notified.success ? now : null,
            now
          )
        }
      } catch (err) {
        console.warn('[news] Could not log to notification_history:', err)
      }

      if (notified.success) {
        // Mark as notified
        if (usingTurso) {
          await db.prepare('UPDATE news_items SET notificado_at = ? WHERE id = ?').run(now, row.id)
        } else {
          db.prepare('UPDATE news_items SET notificado_at = ? WHERE id = ?').run(now, row.id)
        }
        await incrementMetric('notification_sent', 'status=sent')
        console.log(`[news] sent id=${item.id_fuente} reason=success`)
        return { inserted: true, notified: true }
      } else {
        // CAUSA RAÍZ: Cuando las notificaciones están desactivadas, sendTelegramMessage
        // retorna { success: false, error: 'Notifications disabled' }, lo cual se loguea
        // como "failed" aunque no es realmente un error.
        // SOLUCIÓN: Distinguir entre "notificaciones desactivadas" (skipped) y errores reales (failed)
        const isDisabled = notified.error === 'Notifications disabled'
        
        if (isDisabled) {
          // Notificaciones desactivadas por configuración - no es un error
          console.log(`[news] skipped id=${item.id_fuente} reason=notifications_disabled`)
          return { inserted: true, notified: false, error: 'Notifications disabled' }
        } else {
          // Error real (red, token inválido, etc.)
          await incrementMetric('notification_sent', 'status=failed')
          console.error(`[news] failed id=${item.id_fuente} reason=${notified.error || 'unknown'}`)
          return { inserted: true, notified: false, error: notified.error }
        }
      }
    }

    return { inserted: true, notified: false }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[news] Error inserting news item:', errorMessage)
    return { inserted: false, notified: false, error: errorMessage }
  }
}

/**
 * Build and send notification for news item
 */
async function notifyNewsItem(item: NewsItem): Promise<{ success: boolean; error?: string }> {
  try {
    // Format published_at to Europe/Madrid
    const publishedAtUTC = new Date(item.published_at)
    const madridTime = toZonedTime(publishedAtUTC, TIMEZONE)
    const horaMadrid = format(madridTime, 'HH:mm')

    // Build message
    let message = `[NEW] ${item.pais || 'N/A'}/${item.tema || 'N/A'} — ${item.titulo}\n\n`

    // Add valores if available
    if (item.valor_publicado != null) {
      message += `Publicado: ${item.valor_publicado}`
      if (item.valor_esperado != null) {
        message += ` | Esperado: ${item.valor_esperado}`
      }
      message += '\n'
    }

    message += `Impacto: ${item.impacto} | ${horaMadrid} (Madrid)`

    if (item.resumen) {
      message += `\n\nResumen: ${item.resumen}`
    }

    // Send with retry
    const result = await sendTelegramMessageWithRetry(message)
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

/**
 * Send message with one retry on transient error
 */
async function sendTelegramMessageWithRetry(
  text: string,
  retryDelayMs: number = 2500
): Promise<{ success: boolean; error?: string }> {
  // First attempt
  const result1 = await sendTelegramMessage(text, { noParseMode: true })
  if (result1.success) {
    return { success: true }
  }

  // Check if transient error (rate limit, network)
  const isTransient = result1.error?.includes('Rate limit') || 
                      result1.error?.includes('timeout') ||
                      result1.error?.includes('network')

  if (isTransient) {
    // Wait and retry once
    await new Promise(resolve => setTimeout(resolve, retryDelayMs))
    const result2 = await sendTelegramMessage(text, { noParseMode: true })
    return { success: result2.success, error: result2.error }
  }

  return { success: false, error: result1.error }
}

/**
 * Get recent news items
 */
export async function getRecentNewsItems(limit: number = 20): Promise<Array<NewsItem & { id: number; created_at: string; notificado_at: string | null }>> {
  const db = getUnifiedDB()
  const usingTurso = isUsingTurso()
  
  let rows: Array<any>
  if (usingTurso) {
    rows = await db.prepare(`
      SELECT * FROM news_items 
      ORDER BY published_at DESC 
      LIMIT ?
    `).all(limit) as Array<any>
  } else {
    rows = db.prepare(`
      SELECT * FROM news_items 
      ORDER BY published_at DESC 
      LIMIT ?
    `).all(limit) as Array<any>
  }

  return rows.map(row => ({
    id: row.id,
    id_fuente: row.id_fuente,
    fuente: row.fuente,
    pais: row.pais,
    tema: row.tema,
    titulo: row.titulo,
    impacto: row.impacto,
    published_at: row.published_at,
    resumen: row.resumen,
    valor_publicado: row.valor_publicado,
    valor_esperado: row.valor_esperado,
    created_at: row.created_at,
    notificado_at: row.notificado_at,
  }))
}

