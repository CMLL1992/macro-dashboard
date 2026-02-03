/**
 * POST /api/jobs/ingest/events
 * MVP: Job de ingesta de eventos macroeconómicos desde Trading Economics
 * 
 * Filtra solo: CPI, NFP, Decisiones de tipos (FED/ECB/BOE/BOJ), PMI
 * Actualiza cada 10-15 minutos
 */

import { NextRequest, NextResponse } from 'next/server'
import { assertCronAuth } from '@/lib/security/cron'
import { TradingEconomicsProvider } from '@/lib/calendar/tradingEconomicsProvider'
import { upsertEconomicEvent, upsertEconomicRelease } from '@/lib/db/economic-events'
import { env } from '@/lib/env'
import { logger } from '@/lib/obs/logger'
import { sendPostDataNotification } from '@/lib/notifications/post-data-notify'

export const runtime = 'nodejs'

function isCronAuthError(errorMsg: string): boolean {
  return (
    errorMsg.includes('Missing or invalid CRON_SECRET/INGEST_KEY/CRON_TOKEN') ||
    errorMsg.includes('CRON_SECRET, INGEST_KEY, or CRON_TOKEN must be configured')
  )
}

/**
 * MVP: Solo incluir estos indicadores (match por nombre del evento)
 */
const MVP_INDICATORS = new Set([
  // CPI
  'cpi',
  'consumer price index',
  'inflation',

  // NFP
  'nonfarm payrolls',
  'nfp',
  'employment',
  'payrolls',

  // Decisiones de tipos
  'interest rate',
  'fed rate',
  'ecb rate',
  'boe rate',
  'boj rate',
  'monetary policy',
  'rate decision',

  // PMI
  'pmi',
  'manufacturing pmi',
  'services pmi',
  'composite pmi',
])

/**
 * Helpers de filtrado por indicador / tipo
 */
function isMVPIndicator(name: string): boolean {
  const nameLower = name.toLowerCase()
  for (const indicator of MVP_INDICATORS) {
    if (nameLower.includes(indicator)) return true
  }
  return false
}

function isPMIEvent(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes('pmi') ||
    lower.includes('purchasing managers') ||
    lower.includes('manufacturing pmi') ||
    lower.includes('services pmi') ||
    lower.includes('composite pmi')
  )
}

/**
 * Mapear país a código estándar
 */
function normalizeCountry(country: string): string {
  const countryMap: Record<string, string> = {
    'United States': 'US',
    'Euro Area': 'EU',
    'European Union': 'EU',
    'Germany': 'EU',
    'Spain': 'EU',
    'France': 'EU',
    'Italy': 'EU',
    'United Kingdom': 'UK',
    'Japan': 'JP',
    'Australia': 'AU',
    'Canada': 'CA',
    'New Zealand': 'NZ',
    'Switzerland': 'CH',
    'China': 'CN',
  }

  return countryMap[country] || country.toUpperCase().slice(0, 2)
}

export async function POST(request: NextRequest) {
  try {
    assertCronAuth(request)
    
    const apiKey = env.TRADING_ECONOMICS_API_KEY || env.TE_API_KEY
    if (!apiKey) {
      logger.warn('jobs.ingest.events.missing_api_key')
      return NextResponse.json(
        {
          status: 'provider_unavailable' as const,
          reason: 'AUTH_NOT_CONFIGURED' as const,
          fetched: 0,
          mvp: 0,
          events_upserted: 0,
          releases_upserted: 0,
          skipped: {
            total: 0,
            not_mvp: 0,
            missing_datetime: 0,
            parse_errors: 0,
          },
        },
        { status: 500 },
      )
    }

    const provider = new TradingEconomicsProvider(apiKey)

    // Rango: últimos 3 días + próximos 30 días
    const now = new Date()
    const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // -3 días
    const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 días

    // Países MVP: US, EU, UK, JP
    const MVP_COUNTRIES = ['United States', 'Euro Area', 'United Kingdom', 'Japan'] as const

    logger.info('jobs.ingest.events.starting', {
      from: from.toISOString(),
      to: to.toISOString(),
      countries: MVP_COUNTRIES,
    })

    // Fetch eventos con values=true para obtener ActualValue, PreviousValue, ForecastValue
    // Usamos minImportance='medium' y filtramos luego:
    // - CPI/NFP/decisiones tipos: solo high
    // - PMI: medium o high
    const providerEvents = await provider.fetchCalendar({
      from,
      to,
      minImportance: 'medium',
      countries: MVP_COUNTRIES,
      includeValues: true, // Activar para obtener actual/previous/forecast
    })

    const totalFetched = providerEvents.length

    // Filtrar solo indicadores MVP
    const mvpEvents = providerEvents.filter((ev) => isMVPIndicator(ev.name))
    const totalMvp = mvpEvents.length

    // Contadores de skip para observabilidad
    let skippedNotMvp = totalFetched - totalMvp
    let skippedMissingDatetime = 0
    let skippedParseErrors = 0

    logger.info('jobs.ingest.events.fetched', {
      total: totalFetched,
      mvp: totalMvp,
    })

    let inserted = 0
    let updated = 0
    let releasesCreated = 0
    let skipped = 0

    // Buffer de 2 minutos para considerar que el evento ya se publicó
    const nowMinus2Minutes = new Date(now.getTime() - 2 * 60 * 1000)

    for (const providerEvent of mvpEvents) {
      try {
        const country = normalizeCountry(providerEvent.country)
        const scheduledTimeUTC = providerEvent.scheduledTimeUTC

        if (!scheduledTimeUTC) {
          skipped++
          skippedMissingDatetime++
          continue
        }

        // Filtro adicional por importancia:
        // - PMI: medium o high
        // - Resto (CPI, NFP, tipos): solo high
        const isPmi = isPMIEvent(providerEvent.name)
        const importance = providerEvent.importance
        const isHigh = importance === 'high'
        const isMedium = importance === 'medium'

        if (isPmi) {
          if (!isHigh && !isMedium) {
            skipped++
            skippedNotMvp++ // se filtra por importancia dentro del universo MVP
            continue
          }
        } else {
          if (!isHigh) {
            skipped++
            skippedNotMvp++
            continue
          }
        }

        // Upsert evento
        const event = await upsertEconomicEvent({
          source_event_id: providerEvent.externalId,
          country,
          currency: providerEvent.currency,
          name: providerEvent.name,
          category: providerEvent.category || null,
          importance: providerEvent.importance,
          scheduled_time_utc: scheduledTimeUTC,
          previous_value: providerEvent.previous ?? null,
          consensus_value: providerEvent.consensus ?? null,
          consensus_range_min: providerEvent.consensusRangeMin ?? null,
          consensus_range_max: providerEvent.consensusRangeMax ?? null,
        })

        // Verificar si es nuevo o actualizado
        const isNew =
          event.created_at === event.updated_at ||
          new Date(event.created_at).getTime() === new Date(event.updated_at).getTime()

        if (isNew) {
          inserted++
        } else {
          updated++
        }

        // Si hay actual value y el evento ya pasó (con buffer), crear release y notificar post-dato
        if (providerEvent.actual != null && new Date(scheduledTimeUTC).getTime() <= nowMinus2Minutes.getTime()) {
          try {
            await upsertEconomicRelease({
              event_id: event.id,
              release_time_utc: scheduledTimeUTC,
              actual_value: providerEvent.actual,
              previous_value: providerEvent.previous ?? null,
              consensus_value: providerEvent.consensus ?? null,
            })
            releasesCreated++
            if (event.importance === 'high' || event.importance === 'medium') {
              try {
                await sendPostDataNotification({
                  indicator: event.name,
                  country: event.country,
                  actual: providerEvent.actual,
                  forecast: providerEvent.consensus ?? null,
                  previous: providerEvent.previous ?? null,
                })
              } catch (notifyErr) {
                logger.warn('jobs.ingest.events.post_data_notify_failed', {
                  eventId: event.id,
                  error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
                })
              }
            }
          } catch (releaseError) {
            logger.warn('jobs.ingest.events.release_failed', {
              eventId: event.id,
              error: releaseError instanceof Error ? releaseError.message : String(releaseError),
            })
          }
        }
      } catch (error) {
        logger.warn('jobs.ingest.events.event_failed', {
          externalId: providerEvent.externalId,
          error: error instanceof Error ? error.message : String(error),
        })
        skipped++
        skippedParseErrors++
      }
    }

    logger.info('jobs.ingest.events.completed', {
      inserted,
      updated,
      releasesCreated,
      skipped,
    })

    return NextResponse.json({
      status: 'ok' as const,
      fetched: totalFetched,
      mvp: totalMvp,
      events_upserted: inserted + updated,
      releases_upserted: releasesCreated,
      skipped: {
        total: skipped + skippedNotMvp,
        not_mvp: skippedNotMvp,
        missing_datetime: skippedMissingDatetime,
        parse_errors: skippedParseErrors,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('jobs.ingest.events.failed', {
      error: errorMsg,
    })

    // Auth del cron: devolver 401 (no confundir con fallo del proveedor)
    if (isCronAuthError(errorMsg)) {
      return NextResponse.json(
        {
          status: 'error' as const,
          reason: 'UNAUTHORIZED' as const,
          error: errorMsg,
          fetched: 0,
          mvp: 0,
          events_upserted: 0,
          releases_upserted: 0,
          skipped: {
            total: 0,
            not_mvp: 0,
            missing_datetime: 0,
            parse_errors: 0,
          },
        },
        { status: 401 },
      )
    }

    // Clasificación básica de error del proveedor (para depurar 401/429/red)
    let reason: 'AUTH_FAILED' | 'RATE_LIMIT' | 'NETWORK' | 'UNKNOWN' = 'UNKNOWN'
    const lower = errorMsg.toLowerCase()
    if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
      reason = 'AUTH_FAILED'
    } else if (lower.includes('429') || lower.includes('rate limit')) {
      reason = 'RATE_LIMIT'
    } else if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('enotfound')) {
      reason = 'NETWORK'
    }

    return NextResponse.json(
      {
        status: 'provider_unavailable' as const,
        reason,
        error: errorMsg,
        fetched: 0,
        mvp: 0,
        events_upserted: 0,
        releases_upserted: 0,
        skipped: {
          total: 0,
          not_mvp: 0,
          missing_datetime: 0,
          parse_errors: 0,
        },
      },
      { status: 503 },
    )
  }
}
