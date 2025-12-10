/**
 * Get notifications system status
 * GET /api/notifications/status
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getInitializationStatus, ensureNotificationsInitialized } from '@/lib/notifications/init'
import { getCurrentNarrative } from '@/lib/notifications/narrative'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDay, setHours, setMinutes, addDays } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { isIngestKeyConfigured } from '@/lib/security/ingest'
import { getAggregatedMetrics } from '@/lib/notifications/metrics'

// Development guard: verify import works correctly
if (process.env.NODE_ENV !== 'production') {
  if (typeof toZonedTime !== 'function') {
    throw new Error('toZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
  if (typeof fromZonedTime !== 'function') {
    throw new Error('fromZonedTime import mismatch. Check date-fns/date-fns-tz versions.')
  }
}

export async function GET() {
  try {
    // Force initialization if not already done
    await ensureNotificationsInitialized()
    
    const initStatus = getInitializationStatus()
    let currentNarrative = 'NEUTRAL'
    let recentNotifications: Array<{
      tipo: string
      status: string
      sent_at: string | null
      created_at: string
      id_fuente?: string | null
      fuente?: string | null
    }> = []
    let weeklySent: { semana: string; sent_at: string } | undefined = undefined
    let dailyDigestSent: { fecha: string; sent_at: string } | undefined = undefined

    try {
      currentNarrative = await getCurrentNarrative()
    } catch (err) {
      console.warn('[notifications/status] Error getting narrative:', err)
    }

    try {
      const db = getUnifiedDB()
      const usingTurso = isUsingTurso()
      
      // Get recent notifications with id_fuente and fuente from news_items join
      try {
        if (usingTurso) {
          recentNotifications = await db.prepare(`
            SELECT 
              nh.tipo, 
              nh.status, 
              nh.sent_at, 
              nh.created_at,
              nh.mensaje,
              ni.id_fuente,
              ni.fuente
            FROM notification_history nh
            LEFT JOIN news_items ni ON nh.mensaje LIKE '%' || ni.titulo || '%'
            ORDER BY nh.created_at DESC
            LIMIT 20
          `).all() as Array<{
            tipo: string
            status: string
            sent_at: string | null
            created_at: string
            mensaje: string
            id_fuente: string | null
            fuente: string | null
          }>
        } else {
          recentNotifications = db.prepare(`
            SELECT 
              nh.tipo, 
              nh.status, 
              nh.sent_at, 
              nh.created_at,
              nh.mensaje,
              ni.id_fuente,
              ni.fuente
            FROM notification_history nh
            LEFT JOIN news_items ni ON nh.mensaje LIKE '%' || ni.titulo || '%'
            ORDER BY nh.created_at DESC
            LIMIT 20
          `).all() as Array<{
            tipo: string
            status: string
            sent_at: string | null
            created_at: string
            mensaje: string
            id_fuente: string | null
            fuente: string | null
          }>
        }
        
        // Map to expected format
        recentNotifications = recentNotifications.map(n => ({
          tipo: n.tipo,
          status: n.status,
          sent_at: n.sent_at,
          created_at: n.created_at,
          id_fuente: n.id_fuente,
          fuente: n.fuente,
        }))
      } catch (err) {
        // Fallback to simple query if join fails
        try {
          if (usingTurso) {
            recentNotifications = await db.prepare(`
              SELECT tipo, status, sent_at, created_at
              FROM notification_history
              ORDER BY created_at DESC
              LIMIT 20
            `).all() as Array<{
              tipo: string
              status: string
              sent_at: string | null
              created_at: string
              id_fuente?: string | null
              fuente?: string | null
            }>
          } else {
            recentNotifications = db.prepare(`
              SELECT tipo, status, sent_at, created_at
              FROM notification_history
              ORDER BY created_at DESC
              LIMIT 20
            `).all() as Array<{
              tipo: string
              status: string
              sent_at: string | null
              created_at: string
              id_fuente?: string | null
              fuente?: string | null
            }>
          }
        } catch (err2) {
          console.warn('[notifications/status] notification_history table not found, skipping')
        }
      }

      // Get weekly sent status
      try {
        if (usingTurso) {
          weeklySent = await db.prepare(`
            SELECT semana, sent_at
            FROM weekly_sent
            ORDER BY sent_at DESC
            LIMIT 1
          `).get() as { semana: string; sent_at: string } | undefined
        } else {
          weeklySent = db.prepare(`
            SELECT semana, sent_at
            FROM weekly_sent
            ORDER BY sent_at DESC
            LIMIT 1
          `).get() as { semana: string; sent_at: string } | undefined
        }
      } catch (err) {
        console.warn('[notifications/status] weekly_sent table not found, skipping')
      }

      // Get daily digest sent status
      try {
        if (usingTurso) {
          dailyDigestSent = await db.prepare(`
            SELECT fecha, sent_at
            FROM daily_digest_sent
            ORDER BY sent_at DESC
            LIMIT 1
          `).get() as { fecha: string; sent_at: string } | undefined
        } else {
          dailyDigestSent = db.prepare(`
            SELECT fecha, sent_at
            FROM daily_digest_sent
            ORDER BY sent_at DESC
            LIMIT 1
          `).get() as { fecha: string; sent_at: string } | undefined
        }
      } catch (err) {
        console.warn('[notifications/status] daily_digest_sent table not found, skipping')
      }
    } catch (err) {
      console.warn('[notifications/status] Error accessing DB:', err)
    }

    // Get next weekly time (Sunday 18:00 Europe/Madrid)
    const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'
    const nowUTC = new Date()
    let madridNow = toZonedTime(nowUTC, TIMEZONE)
    const currentDay = getDay(madridNow) // 0 = Sunday, 6 = Saturday
    
    // Calculate days until next Sunday
    let daysUntilSunday: number
    if (currentDay === 0) {
      // Today is Sunday, check if we've passed 18:00
      const currentHour = madridNow.getHours()
      const currentMinute = madridNow.getMinutes()
      if (currentHour < 18 || (currentHour === 18 && currentMinute === 0)) {
        daysUntilSunday = 0 // Today, but hasn't run yet
      } else {
        daysUntilSunday = 7 // Next Sunday
      }
    } else {
      daysUntilSunday = 7 - currentDay
    }
    
    let nextSunday = addDays(madridNow, daysUntilSunday)
    nextSunday = setHours(nextSunday, 18)
    nextSunday = setMinutes(nextSunday, 0)
    const nextSundayUTC = fromZonedTime(nextSunday, TIMEZONE)

    // Get bot and chat status from validation
    const validation = initStatus.validation
    const botOk = validation?.bot_ok ?? false
    const chatOk = validation?.chat_ok ?? false

    // Get metrics
    const metrics = await getAggregatedMetrics()

    // Get server times (reuse nowUTC from above)
    const nowMadrid = toZonedTime(nowUTC, TIMEZONE)

    // Log alert if status changed to false
    if (!botOk || !chatOk) {
      console.error('[notifications/status] ⚠️ ALERT: bot_ok or chat_ok is false', {
        bot_ok: botOk,
        chat_ok: chatOk,
        errors: validation?.errors || [],
      })
    }

    return NextResponse.json({
      initialized: initStatus.initialized,
      validation: {
        valid: validation?.valid ?? false,
        bot_ok: botOk,
        chat_ok: chatOk,
        checked_at: validation?.checked_at || null,
        errors: validation?.errors || [],
        warnings: validation?.warnings || [],
      },
      bot_ok: botOk,
      chat_ok: chatOk,
      ingest_key_loaded: isIngestKeyConfigured(),
      currentNarrative,
      recentNotifications,
      weeklyLastSent: weeklySent?.sent_at || null,
      weekly_next_run: nextSundayUTC.toISOString(),
      daily_last_sent_at: dailyDigestSent?.sent_at || null,
      enabled: process.env.ENABLE_TELEGRAM_NOTIFICATIONS === 'true',
      server_time_utc: nowUTC.toISOString(),
      server_time_madrid: nowMadrid.toISOString(),
      timezone: TIMEZONE,
      counters: {
        sent_total: metrics.sent_total,
        failed_total: metrics.failed_total,
        rate_limited_total: metrics.rate_limited_total,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[notifications/status] Error:', errorMessage)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

