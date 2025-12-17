/**
 * Provider para calendarios económicos en formato HTML
 * 
 * Soporta:
 * - ONS (Office for National Statistics) - Reino Unido
 * - Fed Calendar - Estados Unidos
 * 
 * Parsea HTML y extrae eventos de tablas/calendarios
 */

import { CalendarProvider } from '../provider'
import { ProviderCalendarEvent, ProviderRelease } from '../types'
import { isHighImpactEvent } from '@/config/calendar-whitelist'

interface HTMLFeedConfig {
  name: string
  url: string
  country: string
  currency: 'USD' | 'EUR' | 'GBP'
  selector?: string // Selector CSS para encontrar eventos (opcional)
}

// Configuración de feeds HTML oficiales
const HTML_FEEDS: HTMLFeedConfig[] = [
  {
    name: 'ONS Release Calendar',
    url: 'https://www.ons.gov.uk/releasecalendar',
    country: 'United Kingdom',
    currency: 'GBP',
    selector: '.release-calendar-item', // Selector de ejemplo, verificar estructura real
  },
  {
    name: 'Fed Calendar',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    country: 'United States',
    currency: 'USD',
    selector: '.fomc-meeting', // Selector de ejemplo, verificar estructura real
  },
]

export class HTMLProvider implements CalendarProvider {
  private feeds: HTMLFeedConfig[]

  constructor(feeds?: HTMLFeedConfig[]) {
    this.feeds = feeds || HTML_FEEDS
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
        const events = await this.fetchHTMLFeed(feed, from, to)
        allEvents.push(...events)
      } catch (error) {
        console.error(`[HTMLProvider] Error fetching ${feed.name}:`, error)
        // Continuar con otros feeds aunque uno falle
      }
    }

    return allEvents
  }

  private async fetchHTMLFeed(
    feed: HTMLFeedConfig,
    from: Date,
    to: Date
  ): Promise<ProviderCalendarEvent[]> {
    try {
      const response = await fetch(feed.url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const htmlText = await response.text()

      // Parsear HTML (básico, sin DOM parser)
      const events = this.parseHTML(htmlText, feed, from, to)

      return events
    } catch (error) {
      console.error(`[HTMLProvider] Error fetching HTML from ${feed.name}:`, error)
      throw error
    }
  }

  /**
   * Parser básico de HTML (extracción de texto)
   * Para producción, usar librería como cheerio o jsdom
   */
  private parseHTML(
    htmlText: string,
    feed: HTMLFeedConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    
    // Parseo básico: buscar patrones comunes en HTML
    // Esto es un parser simplificado; para producción usar cheerio o similar
    
    // Buscar fechas en formato común (YYYY-MM-DD, DD/MM/YYYY, etc.)
    const datePattern = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})|(\d{1,2}\s+\w+\s+\d{4})/g
    const dates = htmlText.match(datePattern) || []
    
    // Buscar títulos de eventos (patrones comunes)
    // Esto es muy simplificado; en producción necesitarías un parser HTML real
    const titlePattern = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
    const titles: string[] = []
    let match
    while ((match = titlePattern.exec(htmlText)) !== null) {
      titles.push(match[1].trim())
    }
    
    // Combinar fechas y títulos (muy simplificado)
    for (let i = 0; i < Math.min(dates.length, titles.length); i++) {
      const dateStr = dates[i]
      const title = titles[i] || ''
      
      if (!title) continue
      
      const eventDate = this.parseDate(dateStr)
      
      // Filtrar por rango de fechas
      if (eventDate >= from && eventDate <= to) {
        // Verificar si está en whitelist
        const whitelistMatch = isHighImpactEvent(title, feed.country)
        
        if (whitelistMatch) {
          // Solo incluir eventos de alta importancia
          const event: ProviderCalendarEvent = {
            externalId: `${feed.name}-${Date.now()}-${i}`,
            country: feed.country,
            currency: feed.currency,
            name: whitelistMatch.canonicalEventName || title,
            category: whitelistMatch.category,
            importance: 'high', // Todos los eventos en whitelist son high
            scheduledTimeUTC: eventDate.toISOString(),
            previous: null, // HTML no incluye valores
            consensus: null, // HTML no incluye valores
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
    
    // Intentar formato DD/MM/YYYY
    const ddmmyyyy = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    }
    
    // Intentar formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return new Date(dateStr)
    }
    
    // Fallback: fecha actual
    console.warn(`[HTMLProvider] Could not parse date: ${dateStr}`)
    return new Date()
  }

  async fetchRelease(event: {
    externalId: string
    scheduledTimeUTC: string
  }): Promise<ProviderRelease | null> {
    // HTML no proporciona releases con valores
    // Los valores se obtendrán de APIs oficiales (BLS, BEA, etc.)
    return null
  }
}
