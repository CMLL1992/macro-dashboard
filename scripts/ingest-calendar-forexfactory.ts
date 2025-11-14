/**
 * Script para ingerir eventos del calendario económico desde Forex Factory (RSS/XML)
 * 
 * Fuente: https://www.forexfactory.com/ff_calendar_thisweek.xml
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app INGEST_KEY=tu_key pnpm tsx scripts/ingest-calendar-forexfactory.ts
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

if (!INGEST_KEY) {
  console.warn('[ingest-calendar-forexfactory] INGEST_KEY not set, skipping API calls')
  process.exit(0)
}

/**
 * Parse Forex Factory XML calendar
 */
async function parseForexFactoryXML(): Promise<CalendarEvent[]> {
  try {
    const url = 'https://www.forexfactory.com/ff_calendar_thisweek.xml'
    console.log(`[ingest-calendar-forexfactory] Fetching from ${url}...`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      next: { revalidate: 0 },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlText = await response.text()
    
    // Parse XML (simple regex-based parser for this use case)
    const events: CalendarEvent[] = []
    const eventMatches = xmlText.matchAll(/<event[^>]*>([\s\S]*?)<\/event>/gi)
    
    for (const match of eventMatches) {
      const eventXml = match[1]
      
      // Extract fields
      const dateMatch = eventXml.match(/<date>([^<]+)<\/date>/i)
      const timeMatch = eventXml.match(/<time>([^<]+)<\/time>/i)
      const currencyMatch = eventXml.match(/<currency>([^<]+)<\/currency>/i)
      const titleMatch = eventXml.match(/<title>([^<]+)<\/title>/i)
      const impactMatch = eventXml.match(/<impact>([^<]+)<\/impact>/i)
      const forecastMatch = eventXml.match(/<forecast>([^<]+)<\/forecast>/i)
      
      if (!dateMatch || !titleMatch) continue
      
      const dateStr = dateMatch[1].trim()
      const timeStr = timeMatch?.[1]?.trim()
      const currency = currencyMatch?.[1]?.trim() || 'USD'
      const title = titleMatch[1].trim()
      const impact = impactMatch?.[1]?.trim()?.toLowerCase() || 'low'
      const forecast = forecastMatch?.[1]?.trim()
      
      // Parse date (format: "Nov 13, 2025" or similar)
      let fecha: string
      try {
        const dateObj = new Date(dateStr)
        if (isNaN(dateObj.getTime())) {
          // Try alternative format
          fecha = dateStr
        } else {
          fecha = dateObj.toISOString().slice(0, 10)
        }
      } catch {
        fecha = dateStr
      }
      
      // Map impact
      let importancia: 'low' | 'med' | 'high' = 'low'
      if (impact.includes('high') || impact === 'red') {
        importancia = 'high'
      } else if (impact.includes('medium') || impact === 'orange' || impact === 'yellow') {
        importancia = 'med'
      }
      
      // Determine tema from title
      let tema = 'General'
      const titleLower = title.toLowerCase()
      if (titleLower.includes('cpi') || titleLower.includes('inflation') || titleLower.includes('ppi')) {
        tema = 'Inflación'
      } else if (titleLower.includes('gdp') || titleLower.includes('growth')) {
        tema = 'Crecimiento'
      } else if (titleLower.includes('employment') || titleLower.includes('nfp') || titleLower.includes('payroll') || titleLower.includes('unemployment')) {
        tema = 'Empleo'
      } else if (titleLower.includes('rate') || titleLower.includes('fed') || titleLower.includes('interest')) {
        tema = 'Política Monetaria'
      } else if (titleLower.includes('retail') || titleLower.includes('sales')) {
        tema = 'Consumo'
      } else if (titleLower.includes('pmi') || titleLower.includes('ism') || titleLower.includes('manufacturing')) {
        tema = 'Manufactura'
      }
      
      // Map currency to country
      const countryMap: Record<string, string> = {
        'USD': 'USA',
        'EUR': 'EUR',
        'GBP': 'UK',
        'JPY': 'JPN',
        'AUD': 'AUS',
        'CAD': 'CAN',
        'CHF': 'CHE',
        'NZD': 'NZL',
        'CNY': 'CHN',
      }
      const pais = countryMap[currency] || currency
      
      events.push({
        fecha,
        hora_local: timeStr || undefined,
        pais,
        tema,
        evento: title,
        importancia,
        consenso: forecast || undefined,
      })
    }
    
    console.log(`[ingest-calendar-forexfactory] Parsed ${events.length} events`)
    return events
  } catch (error) {
    console.error('[ingest-calendar-forexfactory] Error parsing XML:', error)
    throw error
  }
}

/**
 * Main ingestion function
 */
async function ingestCalendarFromForexFactory() {
  console.log('[ingest-calendar-forexfactory] Starting Forex Factory calendar ingestion...')
  
  try {
    const events = await parseForexFactoryXML()
    console.log(`[ingest-calendar-forexfactory] Found ${events.length} events`)
    
    let inserted = 0
    let skipped = 0
    
    for (const event of events) {
      try {
        // Send to API endpoint (API handles deduplication)
        const response = await fetch(`${BASE_URL}/api/calendar/insert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-INGEST-KEY': INGEST_KEY || '' || '',
          },
          body: JSON.stringify(event),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.inserted) {
            inserted++
            console.log(`[ingest-calendar-forexfactory] ✅ Inserted: ${event.evento} on ${event.fecha}`)
          } else {
            skipped++
            if (result.inserted === false) {
              console.log(`[ingest-calendar-forexfactory] ⏭️  Skipped (duplicate): ${event.evento} on ${event.fecha}`)
            } else {
              console.log(`[ingest-calendar-forexfactory] ⚠️  Skipped: ${event.evento} on ${event.fecha} (${result.message || 'unknown'})`)
            }
          }
        } else {
          const errorText = await response.text()
          console.warn(`[ingest-calendar-forexfactory] API returned ${response.status}: ${errorText}`)
          skipped++
        }
      } catch (error) {
        console.error(`[ingest-calendar-forexfactory] ❌ Error inserting event:`, error)
        skipped++
      }
    }
    
    console.log(`[ingest-calendar-forexfactory] Completed: ${inserted} inserted, ${skipped} skipped`)
    return { inserted, skipped }
  } catch (error) {
    console.error('[ingest-calendar-forexfactory] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestCalendarFromForexFactory()
    .then(result => {
      console.log('✅ Forex Factory calendar ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Forex Factory calendar ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestCalendarFromForexFactory }




export {}
