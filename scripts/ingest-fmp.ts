/**
 * Script para ingerir datos de Financial Modeling Prep (FMP)
 * - Calendario económico
 * - Noticias financieras
 * 
 * API: https://financialmodelingprep.com/
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app \
 *   INGEST_KEY=tu_key \
 *   FMP_API_KEY=tu_fmp_key \
 *   pnpm tsx scripts/ingest-fmp.ts
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
const FMP_API_KEY = process.env.FMP_API_KEY

if (!INGEST_KEY) {
  console.warn('[ingest-fmp] INGEST_KEY not set, skipping API calls')
  process.exit(0)
}

if (!FMP_API_KEY) {
  console.warn('[ingest-fmp] FMP_API_KEY not set, skipping FMP ingestion')
  process.exit(0)
}

/**
 * Fetch economic calendar from FMP
 */
async function fetchFMPCalendar(): Promise<CalendarEvent[]> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?apikey=${FMP_API_KEY}`
    console.log(`[ingest-fmp] Fetching calendar from FMP...`)
    
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
      console.warn('[ingest-fmp] Unexpected response format from FMP calendar')
      return []
    }

    const events: CalendarEvent[] = data
      .filter((item: any) => item && item.event)
      .map((item: any) => {
        // Parse date
        let fecha: string
        try {
          fecha = new Date(item.date).toISOString().slice(0, 10)
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
          hora_local: item.time || undefined,
          pais: item.country || 'USA',
          tema,
          evento: item.event || 'Economic Event',
          importancia,
          consenso: item.estimate || item.consensus || undefined,
        }
      })

    console.log(`[ingest-fmp] Parsed ${events.length} calendar events`)
    return events
  } catch (error) {
    console.error('[ingest-fmp] Error fetching FMP calendar:', error)
    return []
  }
}

/**
 * Fetch financial news from FMP
 */
async function fetchFMPNews(): Promise<NewsItem[]> {
  try {
    const url = `https://financialmodelingprep.com/api/v3/stock_news?limit=50&apikey=${FMP_API_KEY}`
    console.log(`[ingest-fmp] Fetching news from FMP...`)
    
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
      console.warn('[ingest-fmp] Unexpected response format from FMP news')
      return []
    }

    // Filter for macro-economic relevant news
    const macroKeywords = ['fed', 'federal reserve', 'cpi', 'inflation', 'gdp', 'employment', 'nfp', 'payroll', 'interest rate', 'monetary policy', 'central bank', 'economy', 'economic']
    
    const news: NewsItem[] = data
      .filter((item: any) => {
        if (!item || !item.title) return false
        const text = `${item.title} ${item.text || ''}`.toLowerCase()
        return macroKeywords.some(keyword => text.includes(keyword))
      })
      .map((item: any) => {
        // Parse date
        let published_at: string
        try {
          published_at = new Date(item.publishedDate || item.date).toISOString()
        } catch {
          published_at = new Date().toISOString()
        }

        // Determine impact
        let impacto: 'low' | 'med' | 'high' = 'low'
        const text = `${item.title} ${item.text || ''}`.toLowerCase()
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
          id_fuente: item.url || item.symbol || `fmp-${Date.now()}-${Math.random()}`,
          fuente: 'Financial Modeling Prep',
          pais: item.country || 'USA',
          tema,
          titulo: item.title || 'Financial News',
          impacto,
          published_at,
          resumen: item.text || item.description || undefined,
        }
      })

    console.log(`[ingest-fmp] Parsed ${news.length} news items`)
    return news
  } catch (error) {
    console.error('[ingest-fmp] Error fetching FMP news:', error)
    return []
  }
}

/**
 * Main ingestion function
 */
async function ingestFromFMP() {
  console.log('[ingest-fmp] Starting FMP ingestion...')
  
  try {
    // Ingest calendar
    const calendarEvents = await fetchFMPCalendar()
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
        console.error(`[ingest-fmp] Error inserting calendar event:`, error)
        calendarSkipped++
      }
    }

    // Ingest news
    const newsItems = await fetchFMPNews()
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
        console.error(`[ingest-fmp] Error inserting news:`, error)
        newsSkipped++
      }
    }
    
    console.log(`[ingest-fmp] Completed:`)
    console.log(`  Calendar: ${calendarInserted} inserted, ${calendarSkipped} skipped`)
    console.log(`  News: ${newsInserted} inserted, ${newsSkipped} skipped`)
    
    return {
      calendar: { inserted: calendarInserted, skipped: calendarSkipped },
      news: { inserted: newsInserted, skipped: newsSkipped },
    }
  } catch (error) {
    console.error('[ingest-fmp] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestFromFMP()
    .then(result => {
      console.log('✅ FMP ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ FMP ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestFromFMP }




export {}
