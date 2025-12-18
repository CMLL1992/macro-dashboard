/**
 * Provider para calendarios económicos en formato ICS/iCalendar
 * 
 * Soporta:
 * - BLS (United States) - Calendario de releases oficial
 * - BEA (United States) - ICS subscription oficial (Release Schedule)
 * - ONS (United Kingdom) - ICS oficial con headers correctos
 * - Banco de España - Calendario completo en ICS
 * 
 * Nota: Eurostat e INE ahora usan HTML Provider (ver htmlProvider.ts)
 * 
 * Usa node-ical para parsear archivos ICS (mejor compatibilidad ESM)
 * 
 * Nota: server-only removido para permitir tests con tsx
 */

import { CalendarProvider } from '../provider'
import { ProviderCalendarEvent, ProviderRelease } from '../types'
import { isHighImpactEvent } from '@/config/calendar-whitelist'
import * as ical from "node-ical"

interface ICSConfig {
  name: string
  url: string
  country: string
  currency: 'USD' | 'EUR' | 'GBP'
  timezone?: string // Timezone del feed (para normalización)
}

// Configuración de feeds ICS oficiales (URLs verificadas)
const ICS_FEEDS: ICSConfig[] = [
  {
    name: 'BLS',
    url: 'https://www.bls.gov/schedule/news_release/bls.ics',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York', // BLS usa hora del este de EEUU
  },
  {
    name: 'BEA ICS',
    url: 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York', // BEA usa hora del este de EEUU
  },
  {
    name: 'ONS ICS',
    url: 'https://www.ons.gov.uk/calendar/releasecalendar',
    country: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London', // ONS usa hora UK
  },
  {
    name: 'Banco de España',
    url: 'https://www.bde.es/webbe/es/estadisticas/compartido/calendario/ics/calendario-bde.ics',
    country: 'Spain',
    currency: 'EUR',
    timezone: 'Europe/Madrid', // Banco de España usa hora de Madrid
  },
]

export class ICSProvider implements CalendarProvider {
  private feeds: ICSConfig[]

  constructor(feeds?: ICSConfig[]) {
    this.feeds = feeds || ICS_FEEDS
  }

  async fetchCalendar(params: {
    from: Date
    to: Date
    minImportance?: 'low' | 'medium' | 'high'
  }): Promise<ProviderCalendarEvent[]> {
    const { from, to } = params
    const allEvents: ProviderCalendarEvent[] = []

    for (const feed of this.feeds) {
      try {
        const events = await this.fetchICSFeed(feed, from, to)
        allEvents.push(...events)
        console.log(`[ICSProvider] ✅ ${feed.name}: ${events.length} eventos`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`[ICSProvider] ⚠️  ${feed.name}: ${errorMsg}`)
        // Continuar con otros feeds aunque uno falle
      }
    }

    return allEvents
  }

  private async fetchICSFeed(
    feed: ICSConfig,
    from: Date,
    to: Date
  ): Promise<ProviderCalendarEvent[]> {
    try {
      // Headers especiales para ONS (requiere headers específicos)
      const headers: HeadersInit = {
        'Accept': feed.name === 'ONS ICS' 
          ? 'text/calendar,*/*' 
          : 'text/calendar, application/ics',
        'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
      }
      
      if (feed.name === 'ONS ICS') {
        headers['Accept-Language'] = 'en-GB,en;q=0.9'
      }
      
      const response = await fetch(feed.url, { headers })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const icsText = await response.text()

      // Parsear ICS usando ical.js (necesitamos instalarlo)
      // Por ahora, parseo básico manual
      const events = this.parseICS(icsText, feed, from, to)

      return events
    } catch (error) {
      console.error(`[ICSProvider] Error fetching ICS from ${feed.name}:`, error)
      throw error
    }
  }

  /**
   * Parser de ICS usando ical.js
   */
  private parseICS(
    icsText: string,
    feed: ICSConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    
    try {
      // Usar node-ical para parsear (mejor compatibilidad ESM)
      // parseICS acepta string directamente y devuelve objeto parseado
      const parsed = ical.parseICS(icsText)
      
      for (const key in parsed) {
        const event = parsed[key]
        
        // node-ical devuelve objetos con propiedades específicas
        if (event.type !== 'VEVENT') {
          continue
        }
        
        const summary = event.summary || ''
        const dtstart = event.start
        
        if (!summary || !dtstart) {
          continue
        }
        
        // dtstart puede ser Date o string, normalizar
        const eventDate = dtstart instanceof Date ? dtstart : new Date(dtstart)
        
        // Asegurar UTC
        const utcDate = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
        
        // Filtrar por rango de fechas
        if (utcDate >= from && utcDate <= to) {
          // Verificar si está en whitelist
          const whitelistMatch = isHighImpactEvent(summary, feed.country)
          
          if (whitelistMatch) {
            // Solo incluir eventos de alta importancia
            const uid = event.uid || `${feed.name}-${Date.now()}-${key}`
            const eventData: ProviderCalendarEvent = {
              externalId: `${feed.name}-${uid}`,
              country: feed.country,
              currency: feed.currency,
              name: whitelistMatch.canonicalEventName || summary,
              category: whitelistMatch.category,
              importance: 'high', // Todos los eventos en whitelist son high
              scheduledTimeUTC: utcDate.toISOString(), // Asegurar UTC
              previous: null, // ICS no incluye valores
              consensus: null, // ICS no incluye valores
              maybeSeriesId: whitelistMatch.seriesId,
              maybeIndicatorKey: whitelistMatch.indicatorKey,
              directionality: whitelistMatch.directionality,
            }
            
            events.push(eventData)
          }
        }
      }
    } catch (error) {
      console.error(`[ICSProvider] Error parsing ICS with node-ical, falling back to basic parser:`, error)
      // Fallback a parser básico si node-ical falla
      return this.parseICSBasic(icsText, feed, from, to)
    }
    
    return events
  }

  /**
   * Parser básico de ICS (fallback si ical.js falla)
   */
  private parseICSBasic(
    icsText: string,
    feed: ICSConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    const lines = icsText.split('\n')
    let currentEvent: any = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line === 'BEGIN:VEVENT') {
        currentEvent = {}
      } else if (line === 'END:VEVENT' && currentEvent) {
        if (currentEvent.DTSTART && currentEvent.SUMMARY) {
          const eventDate = this.parseICSDate(currentEvent.DTSTART)
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(currentEvent.SUMMARY, feed.country)
            
            if (whitelistMatch) {
              const event: ProviderCalendarEvent = {
                externalId: `${feed.name}-${currentEvent.UID || Date.now()}-${i}`,
                country: feed.country,
                currency: feed.currency,
                name: whitelistMatch.canonicalEventName || currentEvent.SUMMARY,
                category: whitelistMatch.category,
                importance: 'high',
                scheduledTimeUTC: eventDate.toISOString(),
                previous: null,
                consensus: null,
                maybeSeriesId: whitelistMatch.seriesId,
                maybeIndicatorKey: whitelistMatch.indicatorKey,
                directionality: whitelistMatch.directionality,
              }
              
              events.push(event)
            }
          }
        }
        
        currentEvent = null
      } else if (currentEvent && line.startsWith('DTSTART')) {
        currentEvent.DTSTART = line.split(':')[1] || line.split(';')[0]
      } else if (currentEvent && line.startsWith('SUMMARY')) {
        currentEvent.SUMMARY = line.split(':').slice(1).join(':').trim()
      } else if (currentEvent && line.startsWith('UID')) {
        currentEvent.UID = line.split(':')[1]
      } else if (currentEvent && line.startsWith('DESCRIPTION')) {
        currentEvent.DESCRIPTION = line.split(':').slice(1).join(':').trim()
      }
    }
    
    return events
  }

  /**
   * Parsea fecha en formato ICS (DTSTART)
   * Soporta formatos: YYYYMMDD, YYYYMMDDTHHMMSS, YYYYMMDDTHHMMSSZ
   */
  private parseICSDate(dateStr: string): Date {
    // Remover prefijos como TZID=Europe/Madrid:
    const cleanDate = dateStr.split(':').pop() || dateStr
    
    // Formato: YYYYMMDD o YYYYMMDDTHHMMSS o YYYYMMDDTHHMMSSZ
    if (cleanDate.length >= 8) {
      const year = parseInt(cleanDate.substring(0, 4))
      const month = parseInt(cleanDate.substring(4, 6)) - 1 // Mes 0-indexed
      const day = parseInt(cleanDate.substring(6, 8))
      
      let hours = 0
      let minutes = 0
      let seconds = 0
      
      if (cleanDate.length >= 15 && cleanDate[8] === 'T') {
        hours = parseInt(cleanDate.substring(9, 11))
        minutes = parseInt(cleanDate.substring(11, 13))
        if (cleanDate.length >= 17) {
          seconds = parseInt(cleanDate.substring(13, 15))
        }
      }
      
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds))
    }
    
    // Fallback: intentar parsear como ISO
    return new Date(cleanDate)
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // ICS no proporciona releases con valores
    // Los valores se obtendrán de APIs oficiales (BLS, BEA, etc.)
    return null
  }
}
