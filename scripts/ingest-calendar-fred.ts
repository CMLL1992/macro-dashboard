/**
 * Script para ingerir eventos del calendario económico desde FRED
 * FRED tiene información sobre releases de indicadores económicos
 * 
 * Uso:
 *   APP_URL=https://tu-app.vercel.app INGEST_KEY=tu_key FRED_API_KEY=tu_fred_key pnpm tsx scripts/ingest-calendar-fred.ts
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

// Mapeo de series FRED a eventos del calendario
const FRED_SERIES_CALENDAR: Array<{
  seriesId: string
  evento: string
  tema: string
  importancia: 'high' | 'med' | 'low'
}> = [
  { seriesId: 'CPIAUCSL', evento: 'CPI m/m', tema: 'Inflación', importancia: 'high' },
  { seriesId: 'CPILFESL', evento: 'Core CPI m/m', tema: 'Inflación', importancia: 'high' },
  { seriesId: 'PPIACO', evento: 'PPI m/m', tema: 'Inflación', importancia: 'high' },
  { seriesId: 'PAYEMS', evento: 'Nonfarm Payrolls (NFP)', tema: 'Empleo', importancia: 'high' },
  { seriesId: 'UNRATE', evento: 'Unemployment Rate', tema: 'Empleo', importancia: 'high' },
  { seriesId: 'GDPC1', evento: 'GDP QoQ', tema: 'Crecimiento', importancia: 'high' },
  { seriesId: 'INDPRO', evento: 'Industrial Production', tema: 'Crecimiento', importancia: 'med' },
  { seriesId: 'RSXFS', evento: 'Retail Sales', tema: 'Crecimiento', importancia: 'med' },
  { seriesId: 'FEDFUNDS', evento: 'Fed Funds Rate Decision', tema: 'Política Monetaria', importancia: 'high' },
]

/**
 * Get next release date from FRED API
 * FRED API provides release dates for series
 */
async function getFREDReleaseDate(seriesId: string): Promise<{ date: string; time?: string } | null> {
  try {
    const apiKey = process.env.FRED_API_KEY
    if (!apiKey) {
      console.warn('[ingest-calendar-fred] FRED_API_KEY not set, skipping FRED calendar')
      return null
    }

    // FRED API endpoint for series info (includes next release date)
    const url = `https://api.stlouisfed.org/fred/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`
    
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`[ingest-calendar-fred] Failed to fetch FRED series ${seriesId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    const series = data.seriess?.[0]
    
    if (!series) {
      return null
    }

    // FRED doesn't always provide next release date in the series endpoint
    // We'll use a fallback: estimate based on frequency
    // For monthly: usually around day 10-15 of next month
    // For quarterly: usually around day 25-30 of month after quarter end
    
    const frequency = series.frequency_short || 'M'
    const today = new Date()
    let estimatedDate = new Date()
    
    if (frequency === 'M') {
      // Monthly: usually published around day 10-15 of next month
      estimatedDate = new Date(today.getFullYear(), today.getMonth() + 1, 12)
    } else if (frequency === 'Q') {
      // Quarterly: usually published around day 25-30 of month after quarter
      estimatedDate = new Date(today.getFullYear(), today.getMonth() + 2, 28)
    }
    
    return {
      date: estimatedDate.toISOString().split('T')[0],
      time: '13:30', // Default time for US economic releases
    }
  } catch (error) {
    console.error(`[ingest-calendar-fred] Error fetching release date for ${seriesId}:`, error)
    return null
  }
}

/**
 * Get calendar events from known economic calendar sources
 * This is a simplified version - in production you'd use a dedicated economic calendar API
 */
async function getEconomicCalendarEvents(): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = []
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  // Get events for next 30 days
  for (const series of FRED_SERIES_CALENDAR) {
    try {
      const releaseInfo = await getFREDReleaseDate(series.seriesId)
      
      if (releaseInfo) {
        const releaseDate = new Date(releaseInfo.date)
        
        // Only include events in the next 30 days
        if (releaseDate >= today && releaseDate <= nextMonth) {
          events.push({
            fecha: releaseInfo.date,
            hora_local: releaseInfo.time,
            pais: 'US',
            tema: series.tema,
            evento: series.evento,
            importancia: series.importancia,
            consenso: undefined, // FRED doesn't provide consensus
          })
        }
      }
    } catch (error) {
      console.error(`[ingest-calendar-fred] Error processing ${series.seriesId}:`, error)
    }
  }
  
  return events
}

/**
 * Main ingestion function
 */
async function ingestCalendarFromFRED() {
  console.log('[ingest-calendar-fred] Starting FRED calendar ingestion...')
  
  try {
    const events = await getEconomicCalendarEvents()
    console.log(`[ingest-calendar-fred] Found ${events.length} events`)
    
    let inserted = 0
    let skipped = 0
    
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const ingestKey = process.env.INGEST_KEY
    
    if (!ingestKey) {
      console.warn('[ingest-calendar-fred] INGEST_KEY not set, skipping API calls')
      return { inserted: 0, skipped: 0 }
    }

    for (const event of events) {
      try {
        // Send to API endpoint (API handles deduplication)
        const response = await fetch(`${appUrl}/api/calendar/insert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-INGEST-KEY': ingestKey,
          },
          body: JSON.stringify(event),
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.inserted) {
            inserted++
            console.log(`[ingest-calendar-fred] ✅ Inserted: ${event.evento} on ${event.fecha}`)
          } else {
            skipped++
            if (result.inserted === false) {
              console.log(`[ingest-calendar-fred] ⏭️  Skipped (duplicate): ${event.evento} on ${event.fecha}`)
            } else {
              console.log(`[ingest-calendar-fred] ⚠️  Skipped: ${event.evento} on ${event.fecha} (${result.message || 'unknown'})`)
            }
          }
        } else {
          const errorText = await response.text()
          console.warn(`[ingest-calendar-fred] API returned ${response.status}: ${errorText}`)
          skipped++
        }
      } catch (error) {
        console.error(`[ingest-calendar-fred] ❌ Error inserting event:`, error)
        skipped++
      }
    }
    
    console.log(`[ingest-calendar-fred] Completed: ${inserted} inserted, ${skipped} skipped`)
    return { inserted, skipped }
  } catch (error) {
    console.error('[ingest-calendar-fred] Fatal error:', error)
    throw error
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  ingestCalendarFromFRED()
    .then(result => {
      console.log('✅ Calendar ingestion completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Calendar ingestion failed:', error)
      process.exit(1)
    })
}

export { ingestCalendarFromFRED }


export {}
