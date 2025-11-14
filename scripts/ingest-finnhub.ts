/**
 * Script para ingerir datos de Finnhub
 * - Calendario económico
 * - Noticias financieras
 * 
 * API: https://finnhub.io/
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app \
 *   INGEST_KEY=tu_key \
 *   FINNHUB_API_KEY=tu_finnhub_key \
 *   pnpm tsx scripts/ingest-finnhub.ts
 */

interface CalendarEvent {
  fecha: string
  hora_local?: string
  pais?: string
  tema: string
  evento: string
  importancia: 'low' | 'med' | 'high'
  consenso?: string
}

interface NewsItem {
  id_fuente: string
  fuente: string
  pais?: string
  tema?: string
  titulo: string
  impacto: 'low' | 'med' | 'high'
  published_at: string
  resumen?: string
  valor_publicado?: number
  valor_esperado?: number
}

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const INGEST_KEY = process.env.INGEST_KEY
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

if (!INGEST_KEY) {
  console.warn('[ingest-finnhub] INGEST_KEY not set, skipping API calls')
  process.exit(0)
}

if (!FINNHUB_API_KEY) {
  console.warn('[ingest-finnhub] FINNHUB_API_KEY not set, skipping Finnhub ingestion')
  process.exit(0)
}

/**
 * Fetch economic calendar from Finnhub
 */
async function fetchFinnhubCalendar(): Promise<CalendarEvent[]> {
  try {
    const today = new Date()
    const fromDate = today.toISOString().slice(0, 10)
    const toDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    
    const url = `https://finnhub.io/api/v1/calendar/economic?token=${FINNHUB_API_KEY}&from=${fromDate}&to=${toDate}`
    console.log(`[ingest-finnhub] Fetching calendar from Finnhub...`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data || !data.economicCalendar || !Array.isArray(data.economicCalendar)) {
      console.warn('[ingest-finnhub] Unexpected response format from Finnhub calendar')
      return []
    }

    const events: CalendarEvent[] = data.economicCalendar
      .filter((item: any) => item && item.event)
      .map((item: any) => {
        // Parse date
        let fecha: string
        try {
          fecha = new Date(item.time).toISOString().slice(0, 10)
        } catch {
          fecha = item.date || new Date().toISOString().slice(0, 10)
        }

        // Map impact
        let importancia: 'low' | 'med' | 'high' = 'low'
        const impact = (item.impact || '').toLowerCase()
        if (impact.includes('high') || impact === 'high') {
          importancia = 'high'
        } else if (impact.includes('medium') || impact === 'med') {
          importancia = 'med'
        }

        // Determine tema
        let tema = 'General'
        const eventLower = (item.event || '').toLowerCase()
        if (eventLower.includes('cpi') || eventLower.includes('inflation') || eventLower.includes('ppi')) {
          tema = 'Inflación'
        } else if (eventLower.includes('gdp') || eventLower.includes('growth')) {
          tema = 'Crecimiento'
        } else if (eventLower.includes('employment') || eventLower.includes('nfp') || eventLower.includes('payroll') || eventLower.includes('unemployment')) {
          tema = 'Empleo'
        } else if (eventLower.includes('rate') || eventLower.includes('fed') || eventLower.includes('interest')) {
          tema = 'Política Monetaria'
        }

        return {
          fecha,
          hora_local: item.time ? new Date(item.time).toLocaleTimeString('en-US', { hour12: false }) : undefined,
          pais: item.country || 'USA',
          tema,
          evento: item.event || 'Economic Event',
          importancia,
          consenso: item.estimate || item.forecast || undefined,
        }
      })

    console.log(`[ingest-finnhub] Parsed ${events.length} calendar events`)
    return events
  } catch (error) {
    console.error('[ingest-finnhub] Error fetching Finnhub calendar:', error)
    return []
  }
}

/**
 * Fetch financial news from Finnhub
 */
async function fetchFinnhubNews(): Promise<NewsItem[]> {
  try {
    const url = `https://finnhub.io/api/v1/news?category=forex&token=${FINNHUB_API_KEY}`
    console.log(`[ingest-finnhub] Fetching news from Finnhub...`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!Array.isArray(data)) {
      console.warn('[ingest-finnhub] Unexpected response format from Finnhub news')
      return []
    }

    // Filter for macro-economic relevant news (last 24 hours)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    const macroKeywords = ['fed', 'federal reserve', 'cpi', 'inflation', 'gdp', 'employment', 'nfp', 'payroll', 'interest rate', 'monetary policy', 'central bank', 'economy', 'economic']
    
    const news: NewsItem[] = data
      .filter((item: any) => {
        if (!item || !item.headline) return false
        const publishedDate = new Date(item.datetime * 1000)
        if (publishedDate < yesterday) return false
        
        const text = `${item.headline} ${item.summary || ''}`.toLowerCase()
        return macroKeywords.some(keyword => text.includes(keyword))
      })
      .map((item: any) => {
        // Parse date
        const published_at = new Date(item.datetime * 1000).toISOString()

        // Determine impact
        let impacto: 'low' | 'med' | 'high' = 'low'
        const text = `${item.headline} ${item.summary || ''}`.toLowerCase()
        if (text.includes('cpi') || text.includes('nfp') || text.includes('gdp') || text.includes('fed rate')) {
          impacto = 'high'
        } else if (text.includes('retail sales') || text.includes('pmi') || text.includes('ism')) {
          impacto = 'med'
        }

        // Determine tema
        let tema: string | undefined
        if (text.includes('cpi') || text.includes('inflation') || text.includes('ppi')) {
          tema = 'Inflación'
        } else if (text.includes('gdp') || text.includes('growth')) {
          tema = 'Crecimiento'
        } else if (text.includes('employment') || text.includes('nfp') || text.includes('payroll')) {
          tema = 'Empleo'
        } else if (text.includes('rate') || text.includes('fed') || text.includes('interest')) {
          tema = 'Política Monetaria'
        }

        return {
          id_fuente: item.id?.toString() || item.url || `finnhub-${item.datetime}-${Math.random()}`,
          fuente: 'Finnhub',
          pais: item.source || 'USA',
          tema,
          titulo: item.headline || 'Financial News',
          impacto,
          published_at,
          resumen: item.summary || undefined,
        }
      })

    console.log(`[ingest-finnhub] Parsed ${news.length} news items`)
    return news
  } catch (error) {
    console.error('[ingest-finnhub] Error fetching Finnhub news:', error)
    return []
  }
}

/**
 * Main ingestion function
 */
async function ingestFromFinnhub() {
  console.log('[ingest-finnhub] Starting Finnhub ingestion...')
  
  try {
    // Ingest calendar
    const calendarEvents = await fetchFinnhubCalendar()
    let calendarInserted = 0
    let calendarSkipped = 0
    
    for (const event of calendarEvents) {
      try {
        const response = await fetch(`${BASE_URL}/api/calendar/insert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-INGEST-KEY': INGEST_KEY || '',
          },
          body: JSON.stringify(event),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.inserted) {
            calendarInserted++
          } else {
            calendarSkipped++
          }
        } else {
          calendarSkipped++
        }
      } catch (error) {
        console.error(`[ingest-finnhub] Error inserting calendar event:`, error)
        calendarSkipped++
      }
    }

    // Ingest news
    const newsItems = await fetchFinnhubNews()
    let newsInserted = 0
    let newsSkipped = 0
    
    for (const news of newsItems) {
      try {
        const response = await fetch(`${BASE_URL}/api/news/insert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-INGEST-KEY': INGEST_KEY || '',
          },
          body: JSON.stringify(news),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.inserted) {
            newsInserted++
          } else {
            newsSkipped++
          }
        } else {
          newsSkipped++
        }
      } catch (error) {
        console.error(`[ingest-finnhub] Error inserting news:`, error)
        newsSkipped++
      }
    }
    
    console.log(`[ingest-finnhub] Completed:`)
    console.log(`  Calendar: ${calendarInserted} inserted, ${calendarSkipped} skipped`)
    console.log(`  News: ${newsInserted} inserted, ${newsSkipped} skipped`)
    
    return {
      calendar: { inserted: calendarInserted, skipped: calendarSkipped },
      news: { inserted: newsInserted, skipped: newsSkipped },
    }
  } catch (error) {
    console.error('[ingest-finnhub] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestFromFinnhub()
    .then(result => {
      console.log('✅ Finnhub ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Finnhub ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestFromFinnhub }




export {}
