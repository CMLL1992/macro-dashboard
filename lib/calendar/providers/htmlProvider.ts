/**
 * Provider para calendarios económicos en formato HTML
 * 
 * Soporta:
 * - Eurostat (Euro Area) - Release calendar oficial HTML
 * - INE (España) - Página oficial con calendario completo
 * - Fed Calendar (United States) - Calendario FOMC y eventos del Fed
 * - ONS (United Kingdom) - Fallback HTML si ICS falla
 * - Bundesbank (Alemania) - Statistical release calendar oficial
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

// Configuración de feeds HTML oficiales (URLs verificadas y mejoradas)
const HTML_FEEDS: HTMLFeedConfig[] = [
  {
    name: 'ECB Statistical Calendar',
    url: 'https://www.ecb.europa.eu/stats/ecb_statistical_calendar/html/index.en.html',
    country: 'Euro Area',
    currency: 'EUR',
  },
  {
    name: 'INE Calendar HTML',
    url: 'https://www.ine.es/dynt3/Calendario/calenHTML.htm',
    country: 'Spain',
    currency: 'EUR',
  },
  {
    name: 'Fed Upcoming Dates',
    url: 'https://www.federalreserve.gov/monetarypolicy.htm',
    country: 'United States',
    currency: 'USD',
  },
  {
    name: 'ONS Release Calendar',
    url: 'https://www.ons.gov.uk/releasecalendar',
    country: 'United Kingdom',
    currency: 'GBP',
  },
  {
    name: 'Bundesbank Release Calendar',
    url: 'https://www.bundesbank.de/en/statistics/statistical-release-calendar',
    country: 'Germany',
    currency: 'EUR',
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
      // Headers estándar para todos los fetch HTML
      const headers: HeadersInit = {
        'Accept': 'text/html,*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      }
      
      // Headers específicos por feed
      if (feed.name.includes('ONS')) {
        headers['Accept-Language'] = 'en-GB,en;q=0.9'
      } else if (feed.name.includes('INE') || feed.name.includes('Bundesbank')) {
        headers['Accept-Language'] = 'es-ES,es;q=0.9,en;q=0.8'
      } else if (feed.name.includes('ECB')) {
        headers['Accept-Language'] = 'en-GB,en;q=0.9'
      }
      
      const response = await fetch(feed.url, { headers })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const htmlText = await response.text()

      // Parsear HTML con cheerio (pasar headers para subpáginas e ICS)
      const events = await this.parseHTML(htmlText, feed, from, to, headers)

      return events
    } catch (error) {
      console.error(`[HTMLProvider] Error fetching HTML from ${feed.name}:`, error)
      throw error
    }
  }

  /**
   * Parser de HTML usando cheerio (robusto)
   * Ahora es async porque puede hacer fetch de subpáginas (Bundesbank) o ICS (INE)
   */
  private async parseHTML(
    htmlText: string,
    feed: HTMLFeedConfig,
    from: Date,
    to: Date,
    headers?: HeadersInit
  ): Promise<ProviderCalendarEvent[]> {
    const events: ProviderCalendarEvent[] = []
    
    try {
      const $ = cheerio.load(htmlText)
      
      // Estrategia de parsing según el feed
      if (feed.name === 'ECB Statistical Calendar') {
        // ECB: Parsear calendarios estadísticos (HICP, QSA, BoP)
        // Formato: dd/mm/yyyy hh:mm CET + título
        const text = $.text()
        const dateTimeRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+CET/gi
        let match
        
        while ((match = dateTimeRegex.exec(text)) !== null) {
          const dateStr = match[1] // DD/MM/YYYY
          const timeStr = match[2] // HH:MM
          const matchIndex = match.index
          
          // Buscar título: texto antes o después de la fecha/hora
          const contextStart = Math.max(0, matchIndex - 200)
          const contextEnd = Math.min(text.length, matchIndex + 200)
          const context = text.substring(contextStart, contextEnd)
          
          // Buscar título (puede estar antes o después)
          let title = context.split(dateStr)[0].trim()
          if (title.length < 5) {
            title = context.split(dateStr)[1]?.split('CET')[1]?.trim() || ''
          }
          
          // Limpiar título (remover "Reference period" y similares)
          title = title.replace(/Reference period.*$/i, '').trim()
          if (!title || title.length < 5) continue
          
          // Construir fecha completa: DD/MM/YYYY HH:MM
          const [day, month, year] = dateStr.split('/')
          const [hours, minutes] = timeStr.split(':')
          const eventDate = new Date(Date.UTC(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hours) - 1, // CET es UTC+1, ajustar
            parseInt(minutes)
          ))
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `ECB-${feed.name}-${Date.now()}-${events.length}`,
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
      } else if (feed.name === 'INE Calendar HTML') {
        // INE: Descubrir link ICS desde la página HTML dinámicamente
        // Buscar <a> cuyo texto incluya "Formato ICS" o "ICS format"
        const icsLink = $('a').filter((_, el) => {
          const text = $(el).text().toLowerCase()
          return text.includes('formato ics') || text.includes('ics format') || text.includes('.ics')
        }).first()
        
        if (icsLink.length > 0) {
          let icsUrl = icsLink.attr('href') || ''
          
          // Resolver URL absoluta si es relativa
          if (icsUrl && !icsUrl.startsWith('http')) {
            const baseUrl = new URL(feed.url)
            icsUrl = new URL(icsUrl, baseUrl).href
          }
          
          if (icsUrl) {
            // Fetch y parsear ICS
            const icsHeaders: HeadersInit = headers || {
              'Accept': 'text/calendar,*/*',
              'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
            }
            
            try {
              const icsResponse = await fetch(icsUrl, { headers: icsHeaders })
              if (icsResponse.ok) {
                const icsText = await icsResponse.text()
                const icsEvents = await this.parseINEICS(icsText, feed, from, to)
                events.push(...icsEvents)
                console.log(`[HTMLProvider] INE: Found ${icsEvents.length} events from ICS`)
              }
            } catch (icsError) {
              console.warn(`[HTMLProvider] Failed to fetch INE ICS from ${icsUrl}:`, icsError)
            }
          }
        }
        
        // También parsear HTML directamente como fallback
        $('table tr, .calendar-row, [class*="calendario"]').each((_, element) => {
          const $row = $(element)
          const text = $row.text().trim()
          
          const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})|(\d{1,2}\s+\w+\s+\d{4})/i)
          if (!dateMatch || text.length < 20) return
          
          const dateStr = dateMatch[0]
          let title = $row.find('a, td:first-child').first().text().trim()
          if (!title || title.length < 5) {
            title = text.split(dateStr)[0].trim()
          }
          
          if (!title || title.length < 5) return
          
          const eventDate = this.parseDate(dateStr, 'Europe/Madrid')
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `INE-HTML-${Date.now()}-${events.length}`,
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
      } else if (feed.name === 'ONS Release Calendar') {
        // ONS: Estrategia robusta - buscar "Release date:" con regex
        // Extraer título desde <a> del item y fecha desde texto
        $('*').each((_, element) => {
          const $el = $(element)
          const text = $el.text()
          
          // Buscar patrón: "Release date: DD Month YYYY HH:MM(am|pm)"
          const dateMatch = text.match(/Release date:\s*(\d{1,2}\s+\w+\s+\d{4})\s+(\d{1,2}:\d{2}(?:am|pm)?)/i)
          if (!dateMatch) return
          
          const dateStr = dateMatch[1] // "DD Month YYYY"
          const timeStr = dateMatch[2] || '09:30' // "HH:MM" o default
          
          // Extraer título desde <a> del contenedor o elemento padre
          let title = $el.find('a').first().text().trim()
          if (!title || title.length < 5) {
            // Buscar en elemento padre
            title = $el.parent().find('a').first().text().trim()
          }
          if (!title || title.length < 5) {
            // Fallback: texto antes de "Release date:"
            title = text.split(/Release date:/i)[0].trim()
          }
          
          if (!title || title.length < 5) return
          
          // Parsear fecha y hora
          const [hours, minutes] = timeStr.replace(/[ap]m/i, '').split(':').map(Number)
          let hour24 = hours
          if (timeStr.toLowerCase().includes('pm') && hours < 12) hour24 = hours + 12
          if (timeStr.toLowerCase().includes('am') && hours === 12) hour24 = 0
          
          const eventDate = this.parseDateWithTime(dateStr, hour24, minutes || 0, 'Europe/London')
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `ONS-${Date.now()}-${events.length}`,
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
      } else if (feed.name === 'Fed Upcoming Dates') {
        // Fed: Buscar bloque "Upcoming Dates" y extraer eventos FOMC
        const text = $.text()
        const upcomingIndex = text.toLowerCase().indexOf('upcoming dates')
        if (upcomingIndex === -1) return
        
        // Buscar en el contexto después de "Upcoming Dates"
        const context = text.substring(upcomingIndex, upcomingIndex + 2000)
        
        // Buscar fechas en formato "Jan. 27-28" o "January 27-28, 2026"
        const datePattern = /(\w+\.?\s+\d{1,2}(?:-\d{1,2})?(?:,\s+\d{4})?)/gi
        let match
        
        while ((match = datePattern.exec(context)) !== null) {
          const dateStr = match[1]
          
          // Buscar título en el contexto cercano (FOMC Meeting, FOMC Minutes, Press Conference)
          const contextStart = Math.max(0, match.index - 100)
          const contextEnd = Math.min(context.length, match.index + 100)
          const localContext = context.substring(contextStart, contextEnd)
          
          let title = ''
          if (localContext.toLowerCase().includes('fomc meeting')) {
            title = 'FOMC Rate Decision'
          } else if (localContext.toLowerCase().includes('fomc minutes')) {
            title = 'FOMC Minutes'
          } else if (localContext.toLowerCase().includes('press conference')) {
            title = 'FOMC Press Conference'
          } else {
            continue // Solo eventos FOMC relevantes
          }
          
          const eventDate = this.parseDate(dateStr, 'America/New_York')
          
          if (eventDate >= from && eventDate <= to) {
            const whitelistMatch = isHighImpactEvent(title, feed.country)
            
            if (whitelistMatch) {
              events.push({
                externalId: `Fed-${Date.now()}-${events.length}`,
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
      } else if (feed.name === 'Bundesbank Release Calendar') {
        // Bundesbank: Extraer links a subpáginas y parsear cada una
        const subpageLinks: string[] = []
        
        $('a[href*="/en/statistics/statistical-release-calendar/"]').each((_, element) => {
          const href = $(element).attr('href')
          if (href && /-\d+$/.test(href)) {
            // Link termina con -número (ej: banks-900524)
            const fullUrl = href.startsWith('http') ? href : new URL(href, feed.url).href
            if (!subpageLinks.includes(fullUrl)) {
              subpageLinks.push(fullUrl)
            }
          }
        })
        
        // Parsear cada subpágina
        const subpageHeaders: HeadersInit = headers || {
          'Accept': 'text/html,*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; MacroDashboard/1.0)',
        }
        
        for (const subpageUrl of subpageLinks.slice(0, 50)) { // Limitar a 50 para no sobrecargar
          try {
            const subpageResponse = await fetch(subpageUrl, { headers: subpageHeaders })
            if (!subpageResponse.ok) continue
            
            const subpageHtml = await subpageResponse.text()
            const $sub = cheerio.load(subpageHtml)
            
            // Extraer título del h1
            const title = $sub('h1').first().text().trim()
            if (!title || title.length < 5) continue
            
            // Buscar fecha en formato dd.mm.yyyy en el primer bullet
            const text = $sub('body').text()
            const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/)
            if (!dateMatch) continue
            
            const dateStr = dateMatch[1]
            const eventDate = this.parseDate(dateStr, 'Europe/Berlin')
            
            if (eventDate >= from && eventDate <= to) {
              const whitelistMatch = isHighImpactEvent(title, feed.country)
              
              if (whitelistMatch) {
                events.push({
                  externalId: `Bundesbank-${subpageUrl.split('-').pop()}-${events.length}`,
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
          } catch (subpageError) {
            console.warn(`[HTMLProvider] Error fetching Bundesbank subpage ${subpageUrl}:`, subpageError)
            // Continuar con siguiente subpágina
          }
        }
      }
    } catch (error) {
      console.error(`[HTMLProvider] Error parsing HTML with cheerio:`, error)
      // Fallback a parser básico si cheerio falla
      return this.parseHTMLBasic(htmlText, feed, from, to)
    }
    
    return events
    
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
          // Formato "DD Month YYYY" (ej: "18 December 2025")
          const ddmmyyyyText = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i)
          if (ddmmyyyyText) {
            const [, day, monthName, year] = ddmmyyyyText
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
              'july', 'august', 'september', 'october', 'november', 'december']
            const monthIndex = monthNames.findIndex(m => monthName.toLowerCase().startsWith(m.toLowerCase()))
            if (monthIndex >= 0) {
              date = new Date(parseInt(year), monthIndex, parseInt(day))
            } else {
              date = new Date(dateStr)
            }
          } else {
            // Formato "Month DD, YYYY" (ej: "Jan. 27-28, 2026")
            const monthDDYYYY = dateStr.match(/(\w+\.?)\s+(\d{1,2})(?:-(\d{1,2}))?(?:,\s+(\d{4}))?/i)
            if (monthDDYYYY) {
              const [, monthAbbr, day1, day2, year] = monthDDYYYY
              const monthAbbrs: Record<string, number> = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 2, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
              }
              const monthIndex = monthAbbrs[monthAbbr.toLowerCase().replace('.', '')]
              if (monthIndex !== undefined) {
                const eventYear = year ? parseInt(year) : new Date().getFullYear()
                const eventDay = day2 ? parseInt(day2) : parseInt(day1) // Usar último día si hay rango
                date = new Date(eventYear, monthIndex, eventDay)
              } else {
                date = new Date(dateStr)
              }
            } else {
              // Fallback: intentar parsear directamente
              date = new Date(dateStr)
            }
          }
        }
      }
    }
    
    if (isNaN(date.getTime())) {
      console.warn(`[HTMLProvider] Could not parse date: ${dateStr}`)
      return new Date()
    }
    
    // Normalizar a UTC (asumimos que las fechas vienen en hora local del país)
    // En producción, usar librería como date-fns-tz para conversión precisa
    return date
  }

  /**
   * Parsea fecha con hora específica
   */
  private parseDateWithTime(dateStr: string, hours: number, minutes: number, timezone?: string): Date {
    const baseDate = this.parseDate(dateStr, timezone)
    baseDate.setHours(hours, minutes, 0, 0)
    return baseDate
  }

  /**
   * Parsea ICS de INE (helper para descubrimiento dinámico)
   */
  private async parseINEICS(
    icsText: string,
    feed: HTMLFeedConfig,
    from: Date,
    to: Date
  ): Promise<ProviderCalendarEvent[]> {
    const events: ProviderCalendarEvent[] = []
    
    try {
      // Usar node-ical para parsear
      const ical = await import('node-ical')
      const parsed = ical.parseICS(icsText)
      
      for (const key in parsed) {
        const event = parsed[key]
        if (event.type !== 'VEVENT') continue
        
        const summary = event.summary || ''
        const dtstart = event.start
        
        if (!summary || !dtstart) continue
        
        const eventDate = dtstart instanceof Date ? dtstart : new Date(dtstart)
        const utcDate = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
        
        if (utcDate >= from && utcDate <= to) {
          const whitelistMatch = isHighImpactEvent(summary, feed.country)
          
          if (whitelistMatch) {
            events.push({
              externalId: `INE-ICS-${event.uid || key}`,
              country: feed.country,
              currency: feed.currency,
              name: whitelistMatch.canonicalEventName || summary,
              category: whitelistMatch.category,
              importance: 'high',
              scheduledTimeUTC: utcDate.toISOString(),
              previous: null,
              consensus: null,
              maybeSeriesId: whitelistMatch.seriesId,
              maybeIndicatorKey: whitelistMatch.indicatorKey,
              directionality: whitelistMatch.directionality,
            })
          }
        }
      }
    } catch (error) {
      console.warn(`[HTMLProvider] Error parsing INE ICS:`, error)
    }
    
    return events
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
