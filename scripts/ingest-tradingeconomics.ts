/**
 * Script para ingerir calendario económico desde Trading Economics
 * 
 * API: https://api.tradingeconomics.com/
 * Acceso guest: c=guest:guest
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app \
 *   INGEST_KEY=tu_key \
 *   TRADING_ECONOMICS_API_KEY=tu_key (opcional, si tienes cuenta premium) \
 *   pnpm tsx scripts/ingest-tradingeconomics.ts
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

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'
const INGEST_KEY = process.env.INGEST_KEY
const TRADING_ECONOMICS_API_KEY = process.env.TRADING_ECONOMICS_API_KEY

if (!INGEST_KEY) {
  console.warn('[ingest-tradingeconomics] INGEST_KEY not set, skipping API calls')
  process.exit(0)
}

/**
 * Fetch economic calendar from Trading Economics
 */
async function fetchTradingEconomicsCalendar(): Promise<CalendarEvent[]> {
  try {
    // Use guest access if no API key provided
    const auth = TRADING_ECONOMICS_API_KEY || 'guest:guest'
    const url = `https://api.tradingeconomics.com/calendar?c=${auth}`
    console.log(`[ingest-tradingeconomics] Fetching calendar from Trading Economics...`)
    
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
      console.warn('[ingest-tradingeconomics] Unexpected response format from Trading Economics calendar')
      return []
    }

    // Filter for upcoming events (next 7 days)
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    
    const events: CalendarEvent[] = data
      .filter((item: any) => {
        if (!item || !item.Event) return false
        try {
          const eventDate = new Date(item.Date)
          return eventDate >= today && eventDate <= nextWeek
        } catch {
          return false
        }
      })
      .map((item: any) => {
        // Parse date
        let fecha: string
        try {
          fecha = new Date(item.Date).toISOString().slice(0, 10)
        } catch {
          fecha = item.Date || new Date().toISOString().slice(0, 10)
        }

        // Map importance
        let importancia: 'low' | 'med' | 'high' = 'low'
        const importance = (item.Importance || '').toLowerCase()
        if (importance.includes('high') || importance === '3' || importance === 'high') {
          importancia = 'high'
        } else if (importance.includes('medium') || importance === '2' || importance === 'med') {
          importancia = 'med'
        }

        // Determine tema
        let tema = 'General'
        const eventLower = (item.Event || '').toLowerCase()
        if (eventLower.includes('cpi') || eventLower.includes('inflation') || eventLower.includes('ppi')) {
          tema = 'Inflación'
        } else if (eventLower.includes('gdp') || eventLower.includes('growth')) {
          tema = 'Crecimiento'
        } else if (eventLower.includes('employment') || eventLower.includes('nfp') || eventLower.includes('payroll') || eventLower.includes('unemployment')) {
          tema = 'Empleo'
        } else if (eventLower.includes('rate') || eventLower.includes('fed') || eventLower.includes('interest')) {
          tema = 'Política Monetaria'
        } else if (eventLower.includes('retail') || eventLower.includes('sales')) {
          tema = 'Consumo'
        } else if (eventLower.includes('pmi') || eventLower.includes('ism') || eventLower.includes('manufacturing')) {
          tema = 'Manufactura'
        }

        return {
          fecha,
          hora_local: item.Time ? item.Time : undefined,
          pais: item.Country || 'USA',
          tema,
          evento: item.Event || 'Economic Event',
          importancia,
          consenso: item.Forecast || item.Consensus || undefined,
        }
      })

    console.log(`[ingest-tradingeconomics] Parsed ${events.length} calendar events`)
    return events
  } catch (error) {
    console.error('[ingest-tradingeconomics] Error fetching Trading Economics calendar:', error)
    return []
  }
}

/**
 * Main ingestion function
 */
async function ingestFromTradingEconomics() {
  console.log('[ingest-tradingeconomics] Starting Trading Economics ingestion...')
  
  try {
    const events = await fetchTradingEconomicsCalendar()
    console.log(`[ingest-tradingeconomics] Found ${events.length} events`)
    
    let inserted = 0
    let skipped = 0
    
    for (const event of events) {
      try {
        // Send to API endpoint (API handles deduplication)
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
            inserted++
            console.log(`[ingest-tradingeconomics] ✅ Inserted: ${event.evento} on ${event.fecha}`)
          } else {
            skipped++
            if (result.inserted === false) {
              console.log(`[ingest-tradingeconomics] ⏭️  Skipped (duplicate): ${event.evento} on ${event.fecha}`)
            } else {
              console.log(`[ingest-tradingeconomics] ⚠️  Skipped: ${event.evento} on ${event.fecha} (${result.message || 'unknown'})`)
            }
          }
        } else {
          const errorText = await response.text()
          console.warn(`[ingest-tradingeconomics] API returned ${response.status}: ${errorText}`)
          skipped++
        }
      } catch (error) {
        console.error(`[ingest-tradingeconomics] ❌ Error inserting event:`, error)
        skipped++
      }
    }
    
    console.log(`[ingest-tradingeconomics] Completed: ${inserted} inserted, ${skipped} skipped`)
    return { inserted, skipped }
  } catch (error) {
    console.error('[ingest-tradingeconomics] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestFromTradingEconomics()
    .then(result => {
      console.log('✅ Trading Economics ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Trading Economics ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestFromTradingEconomics }




export {}
