/**
 * Implementación de CalendarProvider para eventos FOMC (Federal Open Market Committee)
 * 
 * El FOMC se reúne 8 veces al año aproximadamente.
 * Este proveedor genera eventos basados en el calendario oficial del FOMC.
 * 
 * Fuente: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 */

import { CalendarProvider } from './provider'
import { ProviderCalendarEvent, ProviderRelease } from './types'

// Calendario FOMC 2025 (fechas oficiales)
const FOMC_MEETINGS_2025: Array<{
  date: string // YYYY-MM-DD
  hasSEP: boolean // Summary of Economic Projections
}> = [
  { date: '2025-01-28', hasSEP: false },
  { date: '2025-01-29', hasSEP: false }, // Segundo día
  { date: '2025-03-18', hasSEP: true },
  { date: '2025-03-19', hasSEP: true }, // Segundo día
  { date: '2025-05-06', hasSEP: false },
  { date: '2025-05-07', hasSEP: false }, // Segundo día
  { date: '2025-06-17', hasSEP: true },
  { date: '2025-06-18', hasSEP: true }, // Segundo día
  { date: '2025-07-29', hasSEP: false },
  { date: '2025-07-30', hasSEP: false }, // Segundo día
  { date: '2025-09-16', hasSEP: true },
  { date: '2025-09-17', hasSEP: true }, // Segundo día
  { date: '2025-10-28', hasSEP: false },
  { date: '2025-10-29', hasSEP: false }, // Segundo día
  { date: '2025-12-09', hasSEP: true },
  { date: '2025-12-10', hasSEP: true }, // Segundo día
]

// Calendario FOMC 2026 (estimado, basado en patrón histórico)
const FOMC_MEETINGS_2026: Array<{
  date: string
  hasSEP: boolean
}> = [
  { date: '2026-01-27', hasSEP: false },
  { date: '2026-01-28', hasSEP: false },
  { date: '2026-03-17', hasSEP: true },
  { date: '2026-03-18', hasSEP: true },
  { date: '2026-05-05', hasSEP: false },
  { date: '2026-05-06', hasSEP: false },
  { date: '2026-06-16', hasSEP: true },
  { date: '2026-06-17', hasSEP: true },
  { date: '2026-07-28', hasSEP: false },
  { date: '2026-07-29', hasSEP: false },
  { date: '2026-09-15', hasSEP: true },
  { date: '2026-09-16', hasSEP: true },
  { date: '2026-10-27', hasSEP: false },
  { date: '2026-10-28', hasSEP: false },
  { date: '2026-12-08', hasSEP: true },
  { date: '2026-12-09', hasSEP: true },
]

export class FOMCProvider implements CalendarProvider {
  constructor() {
    // FOMC no requiere API key
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to, minImportance = 'low' } = params

    try {
      const events: ProviderCalendarEvent[] = []

      // Combinar calendarios de 2025 y 2026
      const allMeetings = [...FOMC_MEETINGS_2025, ...FOMC_MEETINGS_2026]

      // Agrupar reuniones por mes (cada reunión tiene 2 días consecutivos)
      const meetingsByMonth = new Map<string, Array<{ date: string; hasSEP: boolean }>>()
      for (const meeting of allMeetings) {
        const monthKey = meeting.date.substring(0, 7) // YYYY-MM
        if (!meetingsByMonth.has(monthKey)) {
          meetingsByMonth.set(monthKey, [])
        }
        meetingsByMonth.get(monthKey)!.push(meeting)
      }

      // Procesar solo el último día de cada reunión (cuando se anuncian las decisiones)
      for (const [monthKey, monthMeetings] of meetingsByMonth.entries()) {
        // Ordenar por fecha
        monthMeetings.sort((a, b) => a.date.localeCompare(b.date))
        
        // Agrupar días consecutivos (reuniones de 2 días)
        for (let i = 0; i < monthMeetings.length; i++) {
          const current = monthMeetings[i]
          const next = monthMeetings[i + 1]
          
          // Si hay un día siguiente y es consecutivo, este es el primer día (saltar)
          if (next && 
              parseInt(next.date.substring(8, 10)) === parseInt(current.date.substring(8, 10)) + 1) {
            continue // Este es el primer día, saltar
          }
          
          // Este es el último día de la reunión (o reunión de un solo día)
          const meetingDate = new Date(current.date + 'T00:00:00Z')
          
          // Verificar si la fecha está en el rango solicitado
          if (meetingDate < from || meetingDate > to) continue

          // Fed Interest Rate Decision - siempre se anuncia
          const rateDecisionTime = '14:00' // 14:00 UTC = 9:00 EST (2:00 PM EST)
          events.push({
            externalId: `FOMC-RATE-${current.date}`,
            country: 'United States',
            currency: 'USD',
            name: 'Fed Interest Rate Decision',
            category: 'Interest Rates',
            importance: 'high',
            scheduledTimeUTC: `${current.date}T${rateDecisionTime}:00Z`,
            previous: null,
            consensus: null,
            maybeIndicatorKey: 'us_fedfunds',
            directionality: 'higher_is_positive',
          })

          // FOMC Statement - siempre se publica
          events.push({
            externalId: `FOMC-STATEMENT-${current.date}`,
            country: 'United States',
            currency: 'USD',
            name: 'FOMC Statement',
            category: 'Monetary Policy',
            importance: 'high',
            scheduledTimeUTC: `${current.date}T${rateDecisionTime}:00Z`,
            previous: null,
            consensus: null,
            maybeIndicatorKey: undefined,
            directionality: undefined,
          })

          // FOMC Economic Projections - solo en reuniones marcadas con SEP
          if (current.hasSEP) {
            events.push({
              externalId: `FOMC-SEP-${current.date}`,
              country: 'United States',
              currency: 'USD',
              name: 'FOMC Economic Projections',
              category: 'Monetary Policy',
              importance: 'high',
              scheduledTimeUTC: `${current.date}T${rateDecisionTime}:00Z`,
              previous: null,
              consensus: null,
              maybeIndicatorKey: undefined,
              directionality: undefined,
            })
          }

          // FOMC Press Conference - siempre después de la decisión
          const pressConferenceTime = '14:30' // 14:30 UTC = 9:30 EST (2:30 PM EST)
          events.push({
            externalId: `FOMC-PRESS-${current.date}`,
            country: 'United States',
            currency: 'USD',
            name: 'FOMC Press Conference',
            category: 'Monetary Policy',
            importance: 'high',
            scheduledTimeUTC: `${current.date}T${pressConferenceTime}:00Z`,
            previous: null,
            consensus: null,
            maybeIndicatorKey: undefined,
            directionality: undefined,
          })
        }
      }

      // Filtrar por importancia mínima
      const minLevel = minImportance === 'high' ? 3 : minImportance === 'medium' ? 2 : 1
      const filteredEvents = events.filter(ev => {
        const eventLevel = ev.importance === 'high' ? 3 : ev.importance === 'medium' ? 2 : 1
        return eventLevel >= minLevel
      })

      console.log(`[FOMCProvider] Generated ${filteredEvents.length} FOMC events`)
      return filteredEvents
    } catch (error) {
      console.error('[FOMCProvider] Error fetching calendar:', error)
      throw error
    }
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // FOMC no proporciona releases directamente a través de API pública
    // Los valores se obtienen de FRED después de que se publican
    console.warn(`[FOMCProvider] fetchRelease not yet implemented for ${event.externalId}`)
    return null
  }
}

