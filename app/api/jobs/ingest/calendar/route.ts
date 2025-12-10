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
import { upsertEconomicEvent } from '@/lib/db/economic-events'
import { mapProviderEventToInternal } from '@/lib/calendar/mappers'
import { recordJobSuccess, recordJobError } from '@/lib/db/job-status'
import { notifyNewCalendarEvents } from '@/lib/notifications/calendar'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'

// Get multi-provider instance (combina TradingEconomics, FRED, ECB)
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
    const from = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) // Hace 1 día
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) // +14 días (2 semanas) para capturar más eventos importantes

    const startTime = Date.now()
    console.log('[ingest/calendar] ===== Starting calendar ingestion =====')
    console.log('[ingest/calendar] Date range:', {
      from: from.toISOString(),
      to: to.toISOString(),
      days_ahead: Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
    })

    // Fetch eventos desde API externa usando provider
    // Solo eventos de importancia medium y high (excluir low)
    const providerEvents = await provider.fetchCalendar({
      from,
      to,
      minImportance: 'medium', // Solo medium y high, excluir low
    })

    console.log(`[ingest/calendar] Provider returned ${providerEvents.length} events`)
    
    // Filtrar solo eventos de importancia medium y high (ya filtrado por minImportance, pero por si acaso)
    // Incluir todas las monedas principales y secundarias relevantes
    const allowedCurrencies = ['USD', 'EUR', 'AUD', 'JPY', 'GBP', 'CAD', 'CHF', 'CNY', 'NZD']
    const filteredEvents = providerEvents.filter(ev => {
      const currencyUpper = ev.currency.toUpperCase()
      const isAllowedCurrency = allowedCurrencies.includes(currencyUpper)
      const isImportant = ev.importance === 'high' || ev.importance === 'medium'
      return isAllowedCurrency && isImportant
    })
    
    console.log(`[ingest/calendar] Filtered to ${filteredEvents.length} events (currencies: ${allowedCurrencies.join(', ')}, importance: medium/high only)`)
    
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
    const db = isUsingTurso() ? getUnifiedDB() : getDB()
    const existingQuery = `
      SELECT source_event_id 
      FROM economic_events 
      WHERE source_event_id IS NOT NULL
    `
    let existingIds: Set<string> = new Set()
    try {
      let existingRows: any[] = []
      if (isUsingTurso()) {
        existingRows = await db.prepare(existingQuery).all() as any[]
      } else {
        existingRows = db.prepare(existingQuery).all() as any[]
      }
      existingIds = new Set(existingRows.map(r => r.source_event_id))
    } catch (error) {
      console.warn('[ingest/calendar] Could not fetch existing events for deduplication:', error)
    }

    // Procesar cada evento (ya filtrado por moneda)
    for (const ev of filteredEvents) {
      try {
        const mapping = mapProviderEventToInternal(ev)
        const isNew = !existingIds.has(ev.externalId)

        await upsertEconomicEvent({
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
          previous_value: ev.previous ?? null,
          consensus_value: ev.consensus ?? null,
          consensus_range_min: ev.consensusRangeMin ?? null,
          consensus_range_max: ev.consensusRangeMax ?? null,
        })

        // Si es nuevo evento, agregarlo a la lista para notificar
        if (isNew && mapping.importance !== 'low') {
          newEvents.push({
            name: mapping.name,
            currency: mapping.currency,
            country: mapping.country,
            importance: mapping.importance,
            scheduled_time_utc: ev.scheduledTimeUTC,
            consensus_value: ev.consensus ?? null,
            previous_value: ev.previous ?? null,
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
    console.log(`[ingest/calendar] Summary: ${upserted} upserted, ${errors} errors`)
    
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
      errors,
      from: from.toISOString(),
      to: to.toISOString(),
      currencies: allowedCurrencies,
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

