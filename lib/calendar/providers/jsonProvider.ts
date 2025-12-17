/**
 * Provider para calendarios económicos en formato JSON
 * 
 * Soporta:
 * - BEA (Bureau of Economic Analysis) - Estados Unidos
 * 
 * BEA proporciona un calendario en formato JSON "machine-readable"
 */

import { CalendarProvider } from '../provider'
import { ProviderCalendarEvent, ProviderRelease } from '../types'
import { isHighImpactEvent } from '@/config/calendar-whitelist'

interface JSONFeedConfig {
  name: string
  url: string
  country: string
  currency: 'USD' | 'EUR' | 'GBP'
  dateField: string // Campo que contiene la fecha
  titleField: string // Campo que contiene el título
}

// Configuración de feeds JSON oficiales
const JSON_FEEDS: JSONFeedConfig[] = [
  {
    name: 'BEA Schedule',
    url: 'https://apps.bea.gov/api/data/?&UserID=YOUR_API_KEY&method=GetParameterList&datasetname=NIPA&ResultFormat=JSON', // URL de ejemplo, verificar
    country: 'United States',
    currency: 'USD',
    dateField: 'date',
    titleField: 'title',
  },
]

export class JSONProvider implements CalendarProvider {
  private feeds: JSONFeedConfig[]

  constructor(feeds?: JSONFeedConfig[]) {
    this.feeds = feeds || JSON_FEEDS
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
        const events = await this.fetchJSONFeed(feed, from, to)
        allEvents.push(...events)
      } catch (error) {
        console.error(`[JSONProvider] Error fetching ${feed.name}:`, error)
        // Continuar con otros feeds aunque uno falle
      }
    }

    return allEvents
  }

  private async fetchJSONFeed(
    feed: JSONFeedConfig,
    from: Date,
    to: Date
  ): Promise<ProviderCalendarEvent[]> {
    try {
      const response = await fetch(feed.url, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Parsear JSON según estructura del feed
      const events = this.parseJSON(data, feed, from, to)

      return events
    } catch (error) {
      console.error(`[JSONProvider] Error fetching JSON from ${feed.name}:`, error)
      throw error
    }
  }

  /**
   * Parsea respuesta JSON según la estructura del feed
   */
  private parseJSON(
    data: any,
    feed: JSONFeedConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    
    // Estructura genérica: array de eventos
    const items = Array.isArray(data) ? data : (data.results || data.data || [])
    
    for (const item of items) {
      const title = item[feed.titleField] || item.title || item.name || ''
      const dateStr = item[feed.dateField] || item.date || item.releaseDate || ''
      
      if (!title || !dateStr) {
        continue
      }
      
      const eventDate = this.parseDate(dateStr)
      
      // Filtrar por rango de fechas
      if (eventDate >= from && eventDate <= to) {
        // Verificar si está en whitelist
        const whitelistMatch = isHighImpactEvent(title, feed.country)
        
        if (whitelistMatch) {
          // Solo incluir eventos de alta importancia
          const event: ProviderCalendarEvent = {
            externalId: `${feed.name}-${item.id || Date.now()}-${Math.random()}`,
            country: feed.country,
            currency: feed.currency,
            name: whitelistMatch.canonicalEventName || title,
            category: whitelistMatch.category,
            importance: 'high', // Todos los eventos en whitelist son high
            scheduledTimeUTC: eventDate.toISOString(),
            previous: null, // JSON puede no incluir valores
            consensus: null, // JSON puede no incluir valores
            maybeSeriesId: whitelistMatch.seriesId,
            maybeIndicatorKey: whitelistMatch.indicatorKey,
            directionality: whitelistMatch.directionality,
          }
          
          events.push(event)
        }
      }
    }
    
    return events
  }

  /**
   * Parsea fecha en varios formatos comunes
   */
  private parseDate(dateStr: string): Date {
    // Intentar parsear como ISO
    const isoDate = new Date(dateStr)
    if (!isNaN(isoDate.getTime())) {
      return isoDate
    }
    
    // Intentar formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr)
    }
    
    // Fallback: fecha actual
    console.warn(`[JSONProvider] Could not parse date: ${dateStr}`)
    return new Date()
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // JSON puede no proporcionar releases con valores
    // Los valores se obtendrán de APIs oficiales (BLS, BEA, etc.)
    return null
  }
}
