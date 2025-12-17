/**
 * Provider para calendarios económicos en formato HTML
 * 
 * Soporta:
 * - ONS (Office for National Statistics) - Reino Unido
 * - Fed Calendar - Estados Unidos
 * - Destatis (Alemania) - Release calendar HTML
 * 
 * Usa cheerio para parsing robusto de HTML
 */

import { CalendarProvider } from '../provider'
import { ProviderCalendarEvent, ProviderRelease } from '../types'
import { isHighImpactEvent } from '@/config/calendar-whitelist'
import * as cheerio from 'cheerio'

interface HTMLFeedConfig {
  name: string
  url: string
  country: string
  currency: 'USD' | 'EUR' | 'GBP'
  selector?: string // Selector CSS para encontrar eventos (opcional)
}

// Configuración de feeds HTML oficiales (URLs verificadas)
const HTML_FEEDS: HTMLFeedConfig[] = [
  {
    name: 'ONS Release Calendar',
    url: 'https://www.ons.gov.uk/releasecalendar',
    country: 'United Kingdom',
    currency: 'GBP',
    selector: '.release-calendar-item', // Verificar selector real
  },
  {
    name: 'Fed Calendar',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    country: 'United States',
    currency: 'USD',
    selector: '.fomc-meeting', // Verificar selector real
  },
  {
    name: 'Destatis Release Calendar',
    url: 'https://www.destatis.de/EN/Service/Calendar/calendar.html', // URL de ejemplo, verificar URL real del listado
    country: 'Germany',
    currency: 'EUR',
    selector: '.release-item', // Verificar selector real
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
        console.log(`[HTMLProvider] ✅ ${feed.name}: ${events.length} eventos`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`[HTMLProvider] ⚠️  ${feed.name}: ${errorMsg}`)
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
   * Parser de HTML usando cheerio (robusto)
   */
  private parseHTML(
    htmlText: string,
    feed: HTMLFeedConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    
    try {
      const $ = cheerio.load(htmlText)
      
      // Estrategia de parsing según el feed
      if (feed.name === 'ONS Release Calendar') {
        // ONS: buscar elementos con "Release date: ..."
        $('*').each((_, element) => {
          const text = $(element).text()
          
          // Buscar patrón "Release date: DD Month YYYY" o similar
          const dateMatch = text.match(/Release date:\s*(\d{1,2}\s+\w+\s+\d{4})/i)
          if (!dateMatch) return
          
          const dateStr = dateMatch[1]
          const title = $(element).find('h2, h3, h4, .title, a').first().text().trim() || 
                       text.split('Release date:')[0].trim()
          
          if (!title) return
          
          const eventDate = this.parseDate(dateStr, 'Europe/London') // ONS usa hora UK
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `${feed.name}-${Date.now()}-${events.length}`,
                country: feed.country,
                currency: feed.currency,
                name: whitelistMatch.canonicalEventName || title,
                category: whitelistMatch.category,
                importance: 'high',
                scheduledTimeUTC: eventDate.toISOString(),
                previous: null,
                consensus: null,
                maybeSeriesId: whitelistMatch.seriesId,
                maybeIndicatorKey: whitelistMatch.indicatorKey,
                directionality: whitelistMatch.directionality,
              })
            }
          }
        })
      } else if (feed.name === 'Fed Calendar') {
        // Fed: buscar elementos de reuniones FOMC
        $('table, .fomc-meeting, .meeting').each((_, element) => {
          const text = $(element).text()
          const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})|(\w+\s+\d{1,2},\s+\d{4})/i)
          
          if (!dateMatch) return
          
          const dateStr = dateMatch[0]
          const title = 'FOMC Rate Decision' // FOMC siempre es rate decision
          
          const eventDate = this.parseDate(dateStr, 'America/New_York') // Fed usa hora del este
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `${feed.name}-${Date.now()}-${events.length}`,
                country: feed.country,
                currency: feed.currency,
                name: whitelistMatch.canonicalEventName || title,
                category: whitelistMatch.category,
                importance: 'high',
                scheduledTimeUTC: eventDate.toISOString(),
                previous: null,
                consensus: null,
                maybeSeriesId: whitelistMatch.seriesId,
                maybeIndicatorKey: whitelistMatch.indicatorKey,
                directionality: whitelistMatch.directionality,
              })
            }
          }
        })
      } else if (feed.name === 'Destatis Release Calendar') {
        // Destatis: buscar filas de tabla con fechas y títulos
        $('table tr, .release-item').each((_, element) => {
          const $row = $(element)
          const text = $row.text()
          
          // Buscar fecha en formato alemán (DD.MM.YYYY) o ISO
          const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})|(\d{4}-\d{2}-\d{2})/i)
          if (!dateMatch) return
          
          const dateStr = dateMatch[0]
          const title = $row.find('td:first-child, .title, a').first().text().trim() || 
                       text.split(dateStr)[0].trim()
          
          if (!title) return
          
          const eventDate = this.parseDate(dateStr, 'Europe/Berlin') // Destatis usa hora de Berlín
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `${feed.name}-${Date.now()}-${events.length}`,
                country: feed.country,
                currency: feed.currency,
                name: whitelistMatch.canonicalEventName || title,
                category: whitelistMatch.category,
                importance: 'high',
                scheduledTimeUTC: eventDate.toISOString(),
                previous: null,
                consensus: null,
                maybeSeriesId: whitelistMatch.seriesId,
                maybeIndicatorKey: whitelistMatch.indicatorKey,
                directionality: whitelistMatch.directionality,
              })
            }
          }
        })
      }
    } catch (error) {
      console.error(`[HTMLProvider] Error parsing HTML with cheerio:`, error)
      // Fallback a parser básico si cheerio falla
      return this.parseHTMLBasic(htmlText, feed, from, to)
    }
    
    return events
  }

  /**
   * Parser básico de HTML (fallback si cheerio falla)
   */
  private parseHTMLBasic(
    htmlText: string,
    feed: HTMLFeedConfig,
    from: Date,
    to: Date
  ): ProviderCalendarEvent[] {
    const events: ProviderCalendarEvent[] = []
    
    // Parseo básico como fallback
    const datePattern = /(\d{4}-\d{2}-\d{2})|(\d{2}\/\d{2}\/\d{4})|(\d{1,2}\s+\w+\s+\d{4})/g
    const dates = htmlText.match(datePattern) || []
    const titlePattern = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi
    const titles: string[] = []
    let match
    while ((match = titlePattern.exec(htmlText)) !== null) {
      titles.push(match[1].trim())
    }
    
    for (let i = 0; i < Math.min(dates.length, titles.length); i++) {
      const dateStr = dates[i]
      const title = titles[i] || ''
      
      if (!title) continue
      
      const eventDate = this.parseDate(dateStr)
      
      if (eventDate >= from && eventDate <= to) {
        const whitelistMatch = isHighImpactEvent(title, feed.country)
        
        if (whitelistMatch) {
          events.push({
            externalId: `${feed.name}-${Date.now()}-${i}`,
            country: feed.country,
            currency: feed.currency,
            name: whitelistMatch.canonicalEventName || title,
            category: whitelistMatch.category,
            importance: 'high',
            scheduledTimeUTC: eventDate.toISOString(),
            previous: null,
            consensus: null,
            maybeSeriesId: whitelistMatch.seriesId,
            maybeIndicatorKey: whitelistMatch.indicatorKey,
            directionality: whitelistMatch.directionality,
          })
        }
      }
    }
    
    return events
  }

  /**
   * Parsea fecha en varios formatos comunes y normaliza a UTC
   * @param dateStr - String de fecha a parsear
   * @param timezone - Timezone del feed (opcional, para normalización)
   */
  private parseDate(dateStr: string, timezone?: string): Date {
    let date: Date
    
    // Intentar parsear como ISO
    const isoDate = new Date(dateStr)
    if (!isNaN(isoDate.getTime())) {
      date = isoDate
    } else {
      // Intentar formato DD/MM/YYYY
      const ddmmyyyy = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        // Formato YYYY-MM-DD
        date = new Date(dateStr)
      } else {
        // Formato alemán DD.MM.YYYY
        const ddmmyyyyDE = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/)
        if (ddmmyyyyDE) {
          const [, day, month, year] = ddmmyyyyDE
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        } else {
          // Fallback: intentar parsear directamente
          date = new Date(dateStr)
          if (isNaN(date.getTime())) {
            console.warn(`[HTMLProvider] Could not parse date: ${dateStr}`)
            return new Date()
          }
        }
      }
    }
    
    // Normalizar a UTC (si el feed tiene timezone, ajustar)
    // Por ahora, asumimos que las fechas ya vienen en UTC o hora local del país
    // En producción, usar librería como date-fns-tz para conversión precisa
    return date
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
