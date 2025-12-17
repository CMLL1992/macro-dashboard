/**
 * Provider para calendarios económicos en formato ICS/iCalendar
 * 
 * Soporta:
 * - Eurostat (Euro Area) - Release calendar oficial
 * - BLS (United States) - Calendario de releases oficial
 * - BEA (United States) - ICS subscription oficial
 * - INE (España) - Calendario en formato ICS
 * - Banco de España - Calendario completo en ICS
 * 
 * Usa la librería ical.js para parsear archivos ICS
 * URLs verificadas y oficiales
 */

import { CalendarProvider } from '../provider'
import { ProviderCalendarEvent, ProviderRelease } from '../types'
import { isHighImpactEvent } from '@/config/calendar-whitelist'

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
    name: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat/cache/RELEASE_CALENDAR/calendar_EN.ics',
    country: 'Euro Area',
    currency: 'EUR',
    timezone: 'Europe/Brussels', // Eurostat usa hora de Bruselas
  },
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
    name: 'INE Spain',
    url: 'https://www.ine.es/calendario/calendario.ics', // URL oficial desde página "Formato ICS"
    country: 'Spain',
    currency: 'EUR',
    timezone: 'Europe/Madrid', // INE usa hora de Madrid
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
      const response = await fetch(feed.url, {
        headers: {
          'Accept': 'text/calendar, application/ics',
          'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
        },
      })

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
      // Usar ical.js para parsear
      const ical = await import('ical.js')
      const jcalData = ical.parse(icsText)
      const comp = new ical.Component(jcalData)
      const vevents = comp.getAllSubcomponents('vevent')
      
      for (let i = 0; i < vevents.length; i++) {
        const vevent = vevents[i]
        const event = new ical.Event(vevent)
        
        const summary = event.summary || ''
        const dtstart = event.startDate
        
        if (!summary || !dtstart) {
          continue
        }
        
        // ical.js ya maneja timezone, pero asegurar UTC
        const eventDate = dtstart.toJSDate()
        
        // Normalizar a UTC (ical.js ya debería hacerlo, pero asegurar)
        const utcDate = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
        
        // Filtrar por rango de fechas
        if (utcDate >= from && utcDate <= to) {
          // Verificar si está en whitelist
          const whitelistMatch = isHighImpactEvent(summary, feed.country)
          
          if (whitelistMatch) {
            // Solo incluir eventos de alta importancia
            const uid = event.uid || `${feed.name}-${Date.now()}-${i}`
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
      console.error(`[ICSProvider] Error parsing ICS with ical.js, falling back to basic parser:`, error)
      // Fallback a parser básico si ical.js falla
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
