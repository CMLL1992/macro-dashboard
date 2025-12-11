/**
 * Job: Notificaciones de calendario económico por Telegram
 * 
 * Objetivo: Enviar alertas automáticas cuando eventos de alto impacto están a punto de publicarse
 * Frecuencia: Cada 5 minutos (configurar en Vercel cron)
 * 
 * Protegido con CRON_TOKEN igual que los otros jobs
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { assertCronAuth } from '@/lib/security/cron'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { getRegionCode } from '@/config/calendar-countries'
import { REGION_NAMES } from '@/config/calendar-countries'

export async function POST(req: Request) {
  // Verificar autenticación CRON
  const request = req as any
  const host = request.headers?.get?.('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  if (!(isLocalhost && (!hasCronToken || !isVercel))) {
    try {
      assertCronAuth(req as any)
    } catch (authError) {
      return Response.json(
        { error: authError instanceof Error ? authError.message : 'Unauthorized' },
        { status: 401 }
      )
    }
  } else {
    console.log('[notify/calendar] Allowing request from localhost without token')
  }

  try {
    const now = new Date()
    const leadMinutes = 30 // Margen antes del evento (30 minutos)
    const windowMinutes = 5 // Margen de ejecución del cron (5 minutos)
    
    // Calcular ventana de tiempo: eventos que están entre (now + leadMinutes) y (now + leadMinutes + windowMinutes)
    const from = new Date(now.getTime() + leadMinutes * 60_000)
    const to = new Date(from.getTime() + windowMinutes * 60_000)
    
    console.log('[notify/calendar] Checking for events:', {
      now: now.toISOString(),
      from: from.toISOString(),
      to: to.toISOString(),
      leadMinutes,
      windowMinutes,
    })

    // All methods are async now, so always use await
    const db = getUnifiedDB()
    
    // Buscar eventos que cumplan:
    // - importancia: High (y opcionalmente Medium)
    // - scheduled_time_utc está en la ventana [from, to]
    // - notified_at IS NULL (aún no se han notificado)
    const sql = `
      SELECT 
        id,
        name,
        country,
        currency,
        category,
        importance,
        scheduled_time_utc,
        scheduled_time_local,
        notify_lead_minutes
      FROM economic_events
      WHERE importance = 'high'
        AND scheduled_time_utc >= ?
        AND scheduled_time_utc < ?
        AND (notified_at IS NULL OR notified_at = '')
      ORDER BY scheduled_time_utc ASC
    `
    
    // All methods are async now, so always use await
    const rows = await db.prepare(sql).all(from.toISOString(), to.toISOString()) as any[]
    
    console.log(`[notify/calendar] Found ${rows.length} events to notify`)
    
    if (rows.length === 0) {
      return Response.json({
        success: true,
        notified: 0,
        message: 'No events to notify',
      })
    }

    const notifiedIds: number[] = []
    const errors: Array<{ eventId: number; error: string }> = []
    
    // Procesar cada evento
    for (const row of rows) {
      try {
        const eventTime = new Date(row.scheduled_time_utc)
        const minutesUntilEvent = Math.max(1, Math.round((eventTime.getTime() - now.getTime()) / (60 * 1000)))
        
        // Obtener región
        const regionCode = getRegionCode(row.country) || 'US'
        const regionName = REGION_NAMES[regionCode as keyof typeof REGION_NAMES] || row.country
        
        // Formatear hora local si no está disponible
        const localTime = row.scheduled_time_local || eventTime.toLocaleString('es-ES', {
          timeZone: 'Europe/Madrid',
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
        })
        
        // Construir mensaje
        const messageParts = [
          `⚠️ *Evento macro en ${minutesUntilEvent} min*`,
          '',
          `*${row.name}*`,
          `Importancia: 🔴 Alta`,
          `Zona: ${regionName} · ${row.country} (${row.currency})`,
          `Hora: ${localTime} (Madrid)`,
        ]
        
        if (row.category) {
          messageParts.push(`Categoría: ${row.category}`)
        }
        
        const message = messageParts.filter(Boolean).join('\n')
        
        // Enviar mensaje a Telegram
        const result = await sendTelegramMessage(message, { noParseMode: false })
        
        if (result.success) {
          notifiedIds.push(row.id)
          console.log(`[notify/calendar] Notified event ${row.id}: ${row.name}`)
        } else {
          errors.push({
            eventId: row.id,
            error: result.error || 'Unknown error',
          })
          console.error(`[notify/calendar] Failed to notify event ${row.id}:`, result.error)
        }
        
        // Pequeña pausa para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push({
          eventId: row.id,
          error: errorMsg,
        })
        console.error(`[notify/calendar] Error processing event ${row.id}:`, error)
      }
    }
    
    // Marcar eventos como notificados
    if (notifiedIds.length > 0) {
      const nowIso = new Date().toISOString()
      const updateSql = `
        UPDATE economic_events
        SET notified_at = ?
        WHERE id IN (${notifiedIds.map(() => '?').join(',')})
      `
      
      if (isUsingTurso()) {
        await db.prepare(updateSql).run(nowIso, ...notifiedIds)
      } else {
        db.prepare(updateSql).run(nowIso, ...notifiedIds)
      }
      
      console.log(`[notify/calendar] Marked ${notifiedIds.length} events as notified`)
    }
    
    return Response.json({
      success: true,
      notified: notifiedIds.length,
      errors: errors.length,
      errorDetails: errors.length > 0 ? errors : undefined,
      events: notifiedIds.map(id => {
        const event = rows.find(r => r.id === id)
        return event ? { id, name: event.name } : null
      }).filter(Boolean),
    })
  } catch (error) {
    console.error('[notify/calendar] Error:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(req: Request) {
  return POST(req)
}


