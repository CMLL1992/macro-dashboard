/**
 * Job: Ingesta de calendario económico
 * 
 * Objetivo: Poblar/actualizar economic_events desde una API externa
 * Frecuencia: 1 vez al día (por la noche) para toda la semana
 * Opcional: Refresco cada 4-6 horas para cambios de consenso, horarios, etc.
 * 
 * Protegido con CRON_TOKEN igual que los otros jobs
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { assertCronAuth } from '@/lib/security/cron'
import { MultiProvider } from '@/lib/calendar/multiProvider'
import { upsertEconomicEvent, upsertEconomicRelease } from '@/lib/db/economic-events'
import { mapProviderEventToInternal } from '@/lib/calendar/mappers'
import { recordJobSuccess, recordJobError } from '@/lib/db/job-status'
import { notifyNewCalendarEvents } from '@/lib/notifications/calendar'
import { getUnifiedDB } from '@/lib/db/unified-db'
import { isHighImpactEvent } from '@/config/calendar-whitelist'
import { ALLOWED_COUNTRIES } from '@/config/calendar-constants'

// Get MultiProvider instance (fuentes oficiales: ICS, JSON, HTML)
const getProvider = () => {
  return new MultiProvider()
}

export async function POST(req: Request) {
  // In development on localhost, allow without token if CRON_TOKEN is not set
  const request = req as any
  const host = request.headers?.get?.('host') || ''
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('3000')
  const hasCronToken = process.env.CRON_TOKEN && process.env.CRON_TOKEN.length > 0
  const isVercel = !!process.env.VERCEL
  
  // Only check auth if not localhost or if CRON_TOKEN is set
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
    console.log('[calendar/route] Allowing request from localhost without token')
  }

  try {
    const provider = getProvider()
    const now = new Date()
    // Rango: -14 días (para generar releases) a +45 días (futuro largo)
    const from = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const to = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)

    const startTime = Date.now()
    console.log('[ingest/calendar] ===== Starting calendar ingestion =====')
    console.log('[ingest/calendar] Date range:', {
      from: from.toISOString(),
      to: to.toISOString(),
      days_back: Math.round((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
      days_ahead: Math.round((to.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    })

    // Fetch eventos desde providers oficiales (ICS, JSON, HTML)
    // Los providers ya filtran por whitelist (solo eventos de alta importancia)
    const providerEvents = await provider.fetchCalendar({
      from,
      to,
      minImportance: 'high', // SOLO high (importance = 3)
    })

    console.log(`[ingest/calendar] Provider returned ${providerEvents.length} events`)
    
    // Los eventos ya están filtrados por whitelist en los providers
    // Verificar que todos tienen importance = 'high'
    const filteredEvents = providerEvents.filter(ev => {
      // Verificar que está en whitelist (doble verificación)
      const whitelistMatch = isHighImpactEvent(ev.name, ev.country)
      return whitelistMatch !== null && ev.importance === 'high'
    })
    
    console.log(`[ingest/calendar] Filtered to ${filteredEvents.length} events (whitelist only, importance: high only)`)
    
    // Estadísticas por moneda
    const byCurrency: Record<string, number> = {}
    const byImportance: Record<string, number> = { high: 0, medium: 0, low: 0 }
    
    filteredEvents.forEach(ev => {
      byCurrency[ev.currency] = (byCurrency[ev.currency] || 0) + 1
      byImportance[ev.importance] = (byImportance[ev.importance] || 0) + 1
    })
    
    console.log('[ingest/calendar] Events breakdown:', {
      by_currency: byCurrency,
      by_importance: byImportance,
    })

    let upserted = 0
    let releasesCreated = 0
    let errors = 0
    const errorDetails: Array<{ eventId: string; error: string }> = []
    const newEvents: Array<{
      name: string
      currency: string
      country: string
      importance: 'low' | 'medium' | 'high'
      scheduled_time_utc: string
      consensus_value?: number | null
      previous_value?: number | null
    }> = []

    // Obtener eventos existentes para detectar nuevos
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const existingQuery = `
      SELECT source_event_id, id
      FROM economic_events 
      WHERE source_event_id IS NOT NULL
    `
    let existingIds: Set<string> = new Set()
    let existingEventMap: Map<string, number> = new Map() // source_event_id -> event.id
    try {
      // All methods are async now, so always use await
      const existingRows = await db.prepare(existingQuery).all() as any[]
      existingIds = new Set(existingRows.map(r => r.source_event_id))
      existingEventMap = new Map(existingRows.map(r => [r.source_event_id, r.id]))
    } catch (error) {
      console.warn('[ingest/calendar] Could not fetch existing events for deduplication:', error)
    }

    // Procesar cada evento (ya filtrado por país e importancia)
    for (const ev of filteredEvents) {
      try {
        const mapping = mapProviderEventToInternal(ev)
        const isNew = !existingIds.has(ev.externalId)
        
        // Normalizar valores: null en lugar de "N/A" o strings vacíos
        const previousValue = ev.previous != null && typeof ev.previous === 'number' ? ev.previous : null
        const consensusValue = ev.consensus != null && typeof ev.consensus === 'number' ? ev.consensus : null
        const actualValue = ev.actual != null && typeof ev.actual === 'number' ? ev.actual : null

        // Upsert evento
        const eventResult = await upsertEconomicEvent({
          source_event_id: ev.externalId,
          country: mapping.country,
          currency: mapping.currency,
          name: mapping.name,
          category: mapping.category,
          importance: mapping.importance,
          series_id: mapping.seriesId,
          indicator_key: mapping.indicatorKey,
          directionality: mapping.directionality,
          scheduled_time_utc: ev.scheduledTimeUTC,
          scheduled_time_local: new Date(ev.scheduledTimeUTC).toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
          }),
          previous_value: previousValue,
          consensus_value: consensusValue,
          consensus_range_min: ev.consensusRangeMin ?? null,
          consensus_range_max: ev.consensusRangeMax ?? null,
        })

        // Crear release automáticamente si:
        // 1. El evento ya pasó (scheduled_time_utc <= now)
        // 2. Tiene valor actual (actual !== null)
        const eventDate = new Date(ev.scheduledTimeUTC)
        const isPast = eventDate <= now
        
        if (isPast && actualValue !== null) {
          try {
            // Verificar si ya existe un release para este evento
            const existingRelease = await db.prepare(`
              SELECT id FROM economic_releases WHERE event_id = ?
            `).get(eventResult.id) as { id: number } | undefined
            
            if (!existingRelease) {
              // Crear release solo si no existe
              await upsertEconomicRelease({
                event_id: eventResult.id,
                release_time_utc: ev.scheduledTimeUTC,
                release_time_local: new Date(ev.scheduledTimeUTC).toLocaleString('es-ES', {
                  timeZone: 'Europe/Madrid',
                }),
                actual_value: actualValue,
                previous_value: previousValue,
                consensus_value: consensusValue,
                directionality: mapping.directionality,
              })
              releasesCreated++
              console.log(`[ingest/calendar] ✅ Created release for event ${ev.externalId} (${mapping.name})`)
            }
          } catch (releaseError) {
            console.warn(`[ingest/calendar] Failed to create release for event ${ev.externalId}:`, releaseError)
            // No incrementar errors, es opcional
          }
        }

        // Si es nuevo evento, agregarlo a la lista para notificar
        if (isNew && mapping.importance === 'high') {
          newEvents.push({
            name: mapping.name,
            currency: mapping.currency,
            country: mapping.country,
            importance: mapping.importance,
            scheduled_time_utc: ev.scheduledTimeUTC,
            consensus_value: consensusValue,
            previous_value: previousValue,
          })
        }

        upserted++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[ingest/calendar] Error processing event ${ev.externalId} (${ev.name}):`, errorMsg)
        errors++
        errorDetails.push({ eventId: ev.externalId, error: errorMsg })
      }
    }

    // Notificar nuevos eventos
    if (newEvents.length > 0) {
      try {
        await notifyNewCalendarEvents(newEvents)
        console.log(`[ingest/calendar] ✅ Notified ${newEvents.length} new events`)
      } catch (error) {
        console.error('[ingest/calendar] Error sending notifications:', error)
        // No fallar el job si falla la notificación
      }
    }

    const duration = Date.now() - startTime
    console.log(`[ingest/calendar] ===== Completed in ${duration}ms =====`)
    console.log(`[ingest/calendar] Summary: ${upserted} events upserted, ${releasesCreated} releases created, ${errors} errors`)
    
    if (errors > 0) {
      console.warn(`[ingest/calendar] Error details:`, errorDetails.slice(0, 5)) // Primeros 5 errores
    }

    // Record job success
    try {
      await recordJobSuccess('ingest/calendar')
    } catch (recordError) {
      console.warn('[ingest/calendar] Failed to record job success:', recordError)
    }

    return Response.json({
      status: 'ok',
      count: filteredEvents.length,
      upserted,
      releasesCreated,
      errors,
      from: from.toISOString(),
      to: to.toISOString(),
      countries: ALLOWED_COUNTRIES,
      importance: 'high only',
    })
  } catch (error) {
    console.error('[ingest/calendar] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordJobError('ingest/calendar', errorMessage)
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(req: Request) {
  return POST(req)
}

