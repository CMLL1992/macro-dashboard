/**
 * Job: Ingesta de releases económicos
 * 
 * Objetivo: Cuando llega la hora de un dato, mirar la API, guardar el release,
 * calcular sorpresa y disparar recomputo de bias.
 * 
 * Frecuencia: Cada minuto, pero solo eventos próximos (ventana pequeña)
 * Ventana: eventos con scheduled_time_utc ∈ [now - 2m, now + 1m]
 *          y importance IN ('high','medium')
 *          y que todavía no tengan release registrado
 * 
 * Protegido con CRON_TOKEN
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getUnifiedDB } from '@/lib/db/unified-db'
import { assertCronAuth } from '@/lib/security/cron'
import { upsertEconomicRelease, recordMacroEventImpact } from '@/lib/db/economic-events'
import { getMacroDiagnosis } from '@/domain/diagnostic'
import { usdBias } from '@/domain/bias'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { fetchReleaseFromCalendarAPI } from '@/lib/calendar/fetchReleaseFromCalendarAPI'
import { recomputeAllBiasAndCorrelations } from '@/lib/jobs/recompute-bias'
import { recordJobSuccess, recordJobError } from '@/lib/db/job-status'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

type EventWithoutRelease = {
  id: number
  source_event_id: string | null
  currency: string
  name: string
  importance: string
  scheduled_time_utc: string
  previous_value: number | null
  consensus_value: number | null
  directionality: 'higher_is_positive' | 'lower_is_positive' | null
}

/**
 * Get events without release in the time window
 */
async function getEventsWithoutRelease(params: {
  from: Date
  to: Date
  minImportance: 'low' | 'medium' | 'high'
}): Promise<EventWithoutRelease[]> {
  const { from, to, minImportance } = params
  // All methods are async now, so always use await
  const db = getUnifiedDB()

  const importanceMap: Record<string, number> = { low: 1, medium: 2, high: 3 }
  const minImportanceLevel = importanceMap[minImportance] || 2

  const query = `
    SELECT 
      ee.id,
      ee.source_event_id,
      ee.currency,
      ee.name,
      ee.importance,
      ee.scheduled_time_utc,
      ee.previous_value,
      ee.consensus_value,
      ee.directionality
    FROM economic_events ee
    LEFT JOIN economic_releases er ON ee.id = er.event_id
    WHERE 
      ee.scheduled_time_utc >= ? 
      AND ee.scheduled_time_utc <= ?
      AND (
        CASE ee.importance
          WHEN 'high' THEN 3
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 1
          ELSE 0
        END
      ) >= ?
      AND er.id IS NULL
    ORDER BY ee.scheduled_time_utc ASC
  `

  // All methods are async now, so always use await
  const rows = await db.prepare(query).all(
    from.toISOString(),
    to.toISOString(),
    minImportanceLevel
  ) as any[]
  return rows.map(row => ({
    id: row.id,
    source_event_id: row.source_event_id,
    currency: row.currency,
    name: row.name,
    importance: row.importance,
    scheduled_time_utc: row.scheduled_time_utc,
    previous_value: row.previous_value,
    consensus_value: row.consensus_value,
    directionality: row.directionality,
  }))
}


/**
 * Registrar impacto para monedas afectadas
 */
async function recordMacroEventImpactForCurrenciesAffected(
  event: EventWithoutRelease,
  release: Awaited<ReturnType<typeof upsertEconomicRelease>>
): Promise<void> {
  try {
    // Obtener diagnosis antes (si no existe, usar valores por defecto)
    let diagnosisBefore: Awaited<ReturnType<typeof getMacroDiagnosis>> | null = null
    try {
      diagnosisBefore = await getMacroDiagnosis()
    } catch (error) {
      console.warn('[ingest/releases] Could not get diagnosis before, skipping impact recording')
      return
    }

    const currency = event.currency as 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD'
    const scoreBefore = diagnosisBefore.currencyScores?.[currency]?.totalScore ?? null
    const regimeBefore = diagnosisBefore.currencyRegimes?.[currency]?.regime ?? null
    const usdDirectionBefore = diagnosisBefore ? usdBias(diagnosisBefore.items) : null

    // Recomputar bias (esto actualiza los scores)
    await recomputeAllBiasAndCorrelations()

    // Obtener diagnosis después
    const diagnosisAfter = await getMacroDiagnosis()
    const scoreAfter = diagnosisAfter.currencyScores?.[currency]?.totalScore ?? null
    const regimeAfter = diagnosisAfter.currencyRegimes?.[currency]?.regime ?? null
    const usdDirectionAfter = usdBias(diagnosisAfter.items)

    // Registrar impacto
    await recordMacroEventImpact({
      release_id: release.id,
      currency,
      total_score_before: scoreBefore,
      total_score_after: scoreAfter,
      regime_before: regimeBefore || null,
      regime_after: regimeAfter || null,
      usd_direction_before: usdDirectionBefore,
      usd_direction_after: usdDirectionAfter,
    })

    console.log(`[ingest/releases] Impact recorded for ${currency}:`, {
      score_before: scoreBefore,
      score_after: scoreAfter,
      regime_before: regimeBefore,
      regime_after: regimeAfter,
    })
  } catch (error) {
    console.error('[ingest/releases] Error recording impact:', error)
    // No fallar el job completo si falla el impacto
  }
}

export async function POST(req: Request) {
  // Verificar autenticación
  try {
    assertCronAuth(req as any)
  } catch (authError) {
    return Response.json(
      { error: authError instanceof Error ? authError.message : 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const now = new Date()
    const windowStart = new Date(now.getTime() - 2 * 60 * 1000) // -2 minutos
    const windowEnd = new Date(now.getTime() + 1 * 60 * 1000) // +1 minuto

    const startTime = Date.now()
    console.log('[ingest/releases] ===== Starting releases ingestion =====')
    console.log('[ingest/releases] Time window:', {
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
      window_minutes: Math.round((windowEnd.getTime() - windowStart.getTime()) / (60 * 1000)),
    })

    // Obtener eventos pendientes sin release
    const pendingEvents = await getEventsWithoutRelease({
      from: windowStart,
      to: windowEnd,
      minImportance: 'medium',
    })

    console.log(`[ingest/releases] Found ${pendingEvents.length} pending events`)
    
    if (pendingEvents.length > 0) {
      const byCurrency: Record<string, number> = {}
      pendingEvents.forEach(ev => {
        byCurrency[ev.currency] = (byCurrency[ev.currency] || 0) + 1
      })
      console.log('[ingest/releases] Pending events by currency:', byCurrency)
      console.log('[ingest/releases] Event names:', pendingEvents.map(e => `${e.currency} ${e.name}`).join(', '))
    }

    const releasesCreated: Array<{ id: number; event: string }> = []

    // Procesar cada evento
    for (const event of pendingEvents) {
      try {
        // Verificar que tiene source_event_id
        if (!event.source_event_id) {
          console.warn(`[ingest/releases] Event ${event.id} has no source_event_id, skipping`)
          continue
        }

        // Fetch release data from API usando provider
        const providerRelease = await fetchReleaseFromCalendarAPI({
          externalId: event.source_event_id,
          scheduledTimeUTC: event.scheduled_time_utc,
        })

        if (!providerRelease || providerRelease.actual === null) {
          // Aún no publicado, continuar
          continue
        }

        // Crear release con sorpresa calculada
        const release = await upsertEconomicRelease({
          event_id: event.id,
          release_time_utc: providerRelease.releaseTimeUTC,
          release_time_local: new Date(providerRelease.releaseTimeUTC).toLocaleString('es-ES', {
            timeZone: 'Europe/Madrid',
          }),
          actual_value: providerRelease.actual,
          previous_value: providerRelease.previous ?? event.previous_value ?? null,
          consensus_value: providerRelease.consensus ?? event.consensus_value ?? null,
          directionality: event.directionality,
          notes: `${event.name} publicado`,
        })

        releasesCreated.push({ id: release.id, event: event.name })

        console.log(`[ingest/releases] ✅ Release created for ${event.currency} ${event.name}:`, {
          release_id: release.id,
          actual: release.actual_value,
          consensus: release.consensus_value,
          surprise_raw: release.surprise_raw,
          surprise_pct: release.surprise_pct?.toFixed(4),
          surprise_score: release.surprise_score?.toFixed(3),
          surprise_direction: release.surprise_direction,
        })

        // Notificar release publicado con impacto en pares
        try {
          const surpriseEmoji = release.surprise_direction === 'positive' ? '📈' : release.surprise_direction === 'negative' ? '📉' : '➡️'
          const importanceEmoji = event.importance === 'high' ? '🔴' : '🟡'
          const date = toZonedTime(new Date(release.release_time_utc), 'Europe/Madrid')
          const dateStr = format(date, 'dd/MM/yyyy HH:mm')
          
          // Determinar pares afectados
          const affectedPairs: Record<string, string[]> = {
            USD: ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDJPY', 'USDCAD', 'USDCHF', 'XAUUSD'],
            EUR: ['EURUSD', 'EURGBP', 'EURAUD', 'EURJPY'],
            GBP: ['GBPUSD', 'EURGBP', 'GBPAUD', 'GBPJPY'],
            JPY: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY'],
            AUD: ['AUDUSD', 'EURAUD', 'GBPAUD', 'AUDJPY'],
          }
          
          const pairs = affectedPairs[event.currency] || []
          const isPositiveHigher = event.directionality === 'higher_is_positive'
          const isPositiveLower = event.directionality === 'lower_is_positive'
          
          // Determinar impacto direccional
          let impactDirection = ''
          if (release.surprise_direction === 'positive') {
            if (isPositiveHigher || (isPositiveLower && release.actual_value! < release.consensus_value!)) {
              impactDirection = `Favorable para ${event.currency} → Presión alcista`
            } else {
              impactDirection = `Desfavorable para ${event.currency} → Presión bajista`
            }
          } else if (release.surprise_direction === 'negative') {
            if (isPositiveHigher || (isPositiveLower && release.actual_value! > release.consensus_value!)) {
              impactDirection = `Desfavorable para ${event.currency} → Presión bajista`
            } else {
              impactDirection = `Favorable para ${event.currency} → Presión alcista`
            }
          } else {
            impactDirection = `Neutral para ${event.currency} → Sin cambio significativo`
          }
          
          let releaseMessage = `${importanceEmoji} *${event.name}* (${event.currency})\n\n`
          releaseMessage += `📊 *Dato Publicado*\n`
          releaseMessage += `   Valor: *${release.actual_value?.toFixed(2) ?? 'N/A'}*\n`
          releaseMessage += `   Consenso: ${release.consensus_value?.toFixed(2) ?? 'N/A'}\n`
          releaseMessage += `   Anterior: ${release.previous_value?.toFixed(2) ?? 'N/A'}\n\n`
          
          if (release.surprise_direction) {
            releaseMessage += `${surpriseEmoji} *Sorpresa ${release.surprise_direction === 'positive' ? 'Positiva' : 'Negativa'}*\n`
            if (release.surprise_pct != null) {
              releaseMessage += `   Diferencia: ${release.surprise_pct > 0 ? '+' : ''}${release.surprise_pct.toFixed(2)}%\n`
            }
            if (release.surprise_score != null) {
              releaseMessage += `   Score: ${release.surprise_score.toFixed(2)}\n`
            }
            releaseMessage += `\n`
          }
          
          releaseMessage += `💡 *Impacto Esperado*\n`
          releaseMessage += `   ${impactDirection}\n\n`
          
          if (pairs.length > 0) {
            releaseMessage += `📈 *Pares Afectados*\n`
            releaseMessage += `   ${pairs.slice(0, 8).join(', ')}${pairs.length > 8 ? '...' : ''}\n\n`
          }
          
          releaseMessage += `🕐 ${dateStr}`

          await sendTelegramMessage(releaseMessage, { noParseMode: false })
        } catch (error) {
          console.error('[ingest/releases] Error sending release notification:', error)
          // No fallar el job si falla la notificación
        }

        // Registrar impacto (opcional pero recomendable)
        await recordMacroEventImpactForCurrenciesAffected(event, release)
      } catch (error) {
        console.error(`[ingest/releases] Error processing event ${event.id}:`, error)
        // Continuar con el siguiente evento
      }
    }

    // Si ha habido releases, recomputar bias UNA sola vez al final
    if (releasesCreated.length > 0) {
      console.log(`[ingest/releases] 🔄 ${releasesCreated.length} releases created, recomputing bias...`)
      const recomputeStart = Date.now()
      try {
        await recomputeAllBiasAndCorrelations()
        const recomputeDuration = Date.now() - recomputeStart
        console.log(`[ingest/releases] ✅ Bias recomputed successfully in ${recomputeDuration}ms`)
      } catch (error) {
        console.error(`[ingest/releases] ❌ Error recomputing bias:`, error)
        // No lanzar error aquí, solo loguear (el release ya está guardado)
      }
    }

    const duration = Date.now() - startTime
    console.log(`[ingest/releases] ===== Completed in ${duration}ms =====`)
    console.log(`[ingest/releases] Summary: ${releasesCreated.length} releases created`)

    // Registrar estado del job (siempre éxito si no hay errores fatales)
    await recordJobSuccess('ingest/releases')

    return Response.json({
      status: 'ok',
      releases: releasesCreated.length,
      releases_created: releasesCreated,
      window: {
        from: windowStart.toISOString(),
        to: windowEnd.toISOString(),
      },
    })
  } catch (error) {
    console.error('[ingest/releases] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordJobError('ingest/releases', errorMessage)
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

