/**
 * Job: Update macro calendar events from Trading Economics
 * POST /api/jobs/calendar/update
 * Protected by CRON_TOKEN
 * 
 * Obtiene eventos del calendario económico de Trading Economics
 * y los guarda en macro_events para la página de Noticias
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { logger } from '@/lib/obs/logger'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import fs from 'node:fs'
import path from 'node:path'
import type { MacroEvent, EventCountry } from '@/domain/calendar'

const TE_BASE = 'https://api.tradingeconomics.com'

/**
 * Carga la configuración de calendar-indicators.json
 */
function loadCalendarConfig(): Record<string, {
  country: EventCountry
  provider: string
  te_category?: string
  te_symbol?: string
  impact: 'high' | 'medium'
  frequency?: 'monthly' | 'quarterly'
  typical_day?: number
}> {
  try {
    const configPath = path.join(process.cwd(), 'config', 'calendar-indicators.json')
    const raw = fs.readFileSync(configPath, 'utf8')
    const json = JSON.parse(raw)
    return json.indicators || {}
  } catch (error) {
    logger.warn('[calendar/update] Failed to load calendar config, using empty', { error })
    return {}
  }
}

/**
 * Obtiene el calendario económico de Trading Economics
 */
async function fetchTradingEconomicsCalendar(
  fromDate: string,
  toDate: string,
  countries: string[] = ['united states', 'euro area']
): Promise<any[]> {
  const apiKey = process.env.TRADING_ECONOMICS_API_KEY || 'guest:guest'
  const auth = apiKey.includes(':') ? apiKey : `${apiKey}:${apiKey}`
  
  try {
    // Trading Economics calendar endpoint
    const url = `${TE_BASE}/calendar?c=${auth}&d1=${fromDate}&d2=${toDate}`
    logger.info('[calendar/update] Fetching calendar from Trading Economics', { url: url.replace(auth, '***') })
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Trading Economics API returned ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    if (!Array.isArray(data)) {
      logger.warn('[calendar/update] Trading Economics returned non-array data', { data })
      return []
    }
    
    // Filtrar por países relevantes
    const filtered = data.filter((event: any) => {
      const country = (event.Country || '').toLowerCase()
      return countries.some(c => country.includes(c.toLowerCase()))
    })
    
    logger.info('[calendar/update] Fetched calendar events', { total: data.length, filtered: filtered.length })
    return filtered
  } catch (error) {
    logger.error('[calendar/update] Failed to fetch Trading Economics calendar', {
      error: error instanceof Error ? error.message : String(error),
    })
    return []
  }
}

/**
 * Mapea un evento de Trading Economics a un indicador interno
 */
function matchEventToIndicator(
  teEvent: any,
  config: ReturnType<typeof loadCalendarConfig>
): { indicatorKey: string; meta: any } | null {
  const eventTitle = (teEvent.Event || '').toLowerCase()
  const eventCategory = (teEvent.Category || '').toLowerCase()
  const eventCountry = (teEvent.Country || '').toLowerCase()
  
  // Mapeo de países de TE a códigos internos
  const countryMap: Record<string, EventCountry> = {
    'united states': 'US',
    'usa': 'US',
    'us': 'US',
    'euro area': 'EA',
    'eurozone': 'EA',
    'euro area (19)': 'EA',
    'euro area (20)': 'EA',
  }
  
  // Determinar país del evento
  let eventCountryCode: EventCountry | null = null
  for (const [teCountry, code] of Object.entries(countryMap)) {
    if (eventCountry.includes(teCountry.toLowerCase())) {
      eventCountryCode = code
      break
    }
  }
  
  if (!eventCountryCode) return null
  
  // Buscar coincidencias en la configuración
  for (const [indicatorKey, meta] of Object.entries(config)) {
    // Coincidencia por país
    if (meta.country !== eventCountryCode) continue
    
    // Coincidencia por categoría
    if (meta.te_category) {
      const categoryLower = meta.te_category.toLowerCase()
      if (eventCategory.includes(categoryLower) || eventTitle.includes(categoryLower)) {
        return { indicatorKey, meta }
      }
    }
    
    // Coincidencia por símbolo TE
    if (meta.te_symbol) {
      const symbolLower = meta.te_symbol.toLowerCase()
      if (eventTitle.includes(symbolLower)) {
        return { indicatorKey, meta }
      }
    }
    
    // Coincidencia por nombre de indicador (más flexible)
    const indicatorName = indicatorKey.toLowerCase()
      .replace('_', ' ')
      .replace('eu_', '')
      .replace('uspmi', 'pmi')
      .replace('payems', 'payroll')
      .replace('cpiaucsl', 'cpi')
      .replace('cpilfesl', 'core cpi')
      .replace('pcepilfe', 'core pce')
      .replace('gdp', 'gdp')
      .replace('unrate', 'unemployment')
    
    // Patrones comunes para cada indicador
    const patterns: Record<string, string[]> = {
      'CPIAUCSL': ['consumer price index', 'cpi', 'inflation rate'],
      'CPILFESL': ['core cpi', 'core consumer price', 'core inflation'],
      'PCEPILFE': ['core pce', 'core personal consumption', 'core pce price'],
      'PAYEMS': ['non farm payrolls', 'nfp', 'payrolls', 'employment'],
      'GDPC1': ['gdp', 'gross domestic product', 'gdp growth'],
      'UNRATE': ['unemployment rate', 'unemployment'],
      'FEDFUNDS': ['fed funds', 'federal funds', 'interest rate decision', 'fomc'],
      'USPMI': ['ism manufacturing', 'manufacturing pmi', 'ism pmi'],
      'USPMI_SERVICES': ['ism services', 'services pmi'],
      'EU_CPI_YOY': ['inflation rate', 'hicp', 'consumer price'],
      'EU_CPI_CORE_YOY': ['core inflation', 'core hicp'],
      'EU_GDP_QOQ': ['gdp', 'gross domestic product'],
      'EU_GDP_YOY': ['gdp', 'gross domestic product'],
      'EU_UNEMPLOYMENT': ['unemployment rate'],
      'EU_ECB_RATE': ['ecb', 'interest rate decision', 'ecb rate'],
      'EU_PMI_COMPOSITE': ['composite pmi'],
      'EU_PMI_MANUFACTURING': ['manufacturing pmi'],
      'EU_PMI_SERVICES': ['services pmi'],
    }
    
    const indicatorPatterns = patterns[indicatorKey] || []
    for (const pattern of indicatorPatterns) {
      if (eventTitle.includes(pattern) || eventCategory.includes(pattern)) {
        return { indicatorKey, meta }
      }
    }
  }
  
  return null
}

/**
 * Calcula fecha estimada basada en frecuencia
 */
function estimateNextDate(
  indicatorKey: string,
  config: ReturnType<typeof loadCalendarConfig>,
  lastDate: string | null
): string | null {
  const meta = config[indicatorKey]
  if (!meta || !meta.frequency) return null
  
  if (!lastDate) return null
  
  const last = new Date(lastDate)
  const typicalDay = meta.typical_day || 15
  
  let next = new Date(last)
  
  if (meta.frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1)
    next.setDate(typicalDay)
  } else if (meta.frequency === 'quarterly') {
    next.setMonth(next.getMonth() + 3)
    next.setDate(typicalDay)
  } else {
    return null
  }
  
  return next.toISOString().split('T')[0]
}

export async function POST(request: NextRequest) {
  if (!validateCronToken(request)) {
    return unauthorizedResponse()
  }

  const jobId = 'calendar_update'
  const startedAt = new Date().toISOString()

  try {
    logger.info('Starting calendar update', { job: jobId })

    const config = loadCalendarConfig()
    const today = new Date()
    const fromDate = today.toISOString().split('T')[0]
    const toDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Obtener eventos de Trading Economics
    const teEvents = await fetchTradingEconomicsCalendar(fromDate, toDate, ['united states', 'euro area'])

    const mappedEvents: MacroEvent[] = []

    // Mapear eventos de TE a indicadores internos
    for (const teEvent of teEvents) {
      const match = matchEventToIndicator(teEvent, config)
      if (!match) continue

      const { indicatorKey, meta } = match
      const eventDate = teEvent.Date ? teEvent.Date.split('T')[0] : null
      if (!eventDate) continue

      // Parsear previous y consensus
      const previous = teEvent.Previous ? parseFloat(String(teEvent.Previous)) : null
      const consensus = teEvent.Forecast ? parseFloat(String(teEvent.Forecast)) : null
      
      // Parsear hora (si está disponible)
      const timeStr = teEvent.Date
      let time: string | null = null
      if (timeStr && timeStr.includes('T')) {
        const timePart = timeStr.split('T')[1]
        if (timePart) {
          const [hours, minutes] = timePart.split(':')
          if (hours && minutes) {
            time = `${hours}:${minutes}`
          }
        }
      }

      // Obtener título legible desde sources.ts si está disponible
      let title = teEvent.Event || indicatorKey
      
      // Para eventos del BCE sobre tipos de interés, solo usar "Tasa de Interés BCE" si es decisión real
      if (indicatorKey === 'eu_ecb_rate' || indicatorKey === 'EU_ECB_RATE') {
        const isRateDecision = 
          (previous !== null && previous !== undefined && isFinite(previous)) ||
          (consensus !== null && consensus !== undefined && isFinite(consensus))
        
        if (isRateDecision) {
          title = 'Tasa de Interés BCE (Main Refinancing Rate)'
        } else {
          // Si no es decisión pero es sobre tipos del BCE, usar nombre genérico o mantener original
          const eventTitleLower = (teEvent.Event || '').toLowerCase()
          if (!eventTitleLower.includes('press') && !eventTitleLower.includes('conference') && !eventTitleLower.includes('speech')) {
            title = 'Comparecencia del BCE'
          } else {
            title = teEvent.Event || title // Mantener nombre original si es descriptivo
          }
        }
      } else {
        // Para otros eventos, usar lógica normal
        try {
          const { INDICATOR_SOURCES } = await import('@/lib/sources')
          const source = INDICATOR_SOURCES[indicatorKey]
          if (source?.description) {
            // Usar descripción como título si está disponible
            title = source.description.split(' - ')[0] || source.description
          }
        } catch {
          // Si falla, usar el título del evento de TE
        }
      }
      
      mappedEvents.push({
        id: `${indicatorKey}_${eventDate}`,
        date: eventDate,
        time,
        country: meta.country,
        indicatorKey,
        title,
        previous: isNaN(previous!) ? null : previous,
        consensus: isNaN(consensus!) ? null : consensus,
        impact: meta.impact,
        source: 'trading_economics',
      })
    }

    // Añadir eventos estimados para indicadores sin TE (fallback)
    // Solo para indicadores importantes que no aparecieron en TE
    const indicatorsWithEvents = new Set(mappedEvents.map(e => e.indicatorKey))
    const importantIndicators = Object.keys(config).filter(key => config[key].impact === 'high')
    
    for (const indicatorKey of importantIndicators) {
      if (indicatorsWithEvents.has(indicatorKey)) continue // Ya tiene evento de TE
      
      const meta = config[indicatorKey]
      if (!meta.frequency) continue
      
      // Obtener última fecha del indicador desde la BD
      try {
        const db = getUnifiedDB()
        const isTurso = isUsingTurso()
        let lastDate: string | null = null
        
        if (isTurso) {
          const result = await db.prepare(`
            SELECT MAX(date) as last_date 
            FROM macro_observations 
            WHERE series_id = ? AND value IS NOT NULL
          `).get(indicatorKey)
          lastDate = (result as any)?.last_date || null
        } else {
          // All methods are async now, so always use await
          const dbSync = getUnifiedDB()
          const row = await dbSync.prepare(`
            SELECT MAX(date) as last_date 
            FROM macro_observations 
            WHERE series_id = ? AND value IS NOT NULL
          `).get(indicatorKey) as { last_date: string } | undefined
          lastDate = row?.last_date || null
        }
        
        if (!lastDate) continue
        
        const estimatedDate = estimateNextDate(indicatorKey, config, lastDate)
        if (!estimatedDate) continue
        
        // Solo añadir si la fecha estimada está en el rango (próximos 7 días)
        if (estimatedDate >= fromDate && estimatedDate <= toDate) {
          // Obtener título desde sources
          let title = indicatorKey
          try {
            const { INDICATOR_SOURCES } = await import('@/lib/sources')
            const source = INDICATOR_SOURCES[indicatorKey]
            if (source?.description) {
              title = source.description.split(' - ')[0] || source.description
            }
          } catch {}
          
          mappedEvents.push({
            id: `${indicatorKey}_${estimatedDate}_estimated`,
            date: estimatedDate,
            time: null, // No sabemos la hora exacta
            country: meta.country,
            indicatorKey,
            title,
            previous: null, // Se puede obtener desde la BD si se necesita
            consensus: null, // No disponible sin TE
            impact: meta.impact,
            source: 'estimated',
          })
        }
      } catch (error) {
        logger.warn('[calendar/update] Failed to estimate date for indicator', {
          indicatorKey,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Persistir en base de datos
    const db = getUnifiedDB()
    const isTurso = isUsingTurso()
    let inserted = 0
    let updated = 0

    for (const event of mappedEvents) {
      try {
        if (isTurso) {
          const result = await db.prepare(`
            INSERT OR REPLACE INTO macro_events 
            (id, date, time, country, indicator_key, title, previous, consensus, impact, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            event.id,
            event.date,
            event.time,
            event.country,
            event.indicatorKey,
            event.title,
            event.previous,
            event.consensus,
            event.impact,
            event.source
          )
          if (result.changes > 0) {
            inserted++
          } else {
            updated++
          }
        } else {
          // All methods are async now, so always use await
          const dbSync = getUnifiedDB()
          const result = await dbSync.prepare(`
            INSERT OR REPLACE INTO macro_events 
            (id, date, time, country, indicator_key, title, previous, consensus, impact, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            event.id,
            event.date,
            event.time,
            event.country,
            event.indicatorKey,
            event.title,
            event.previous,
            event.consensus,
            event.impact,
            event.source
          )
          if (result.changes > 0) {
            inserted++
          } else {
            updated++
          }
        }
      } catch (error) {
        logger.error('[calendar/update] Failed to insert event', {
          job: jobId,
          eventId: event.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const finishedAt = new Date().toISOString()

    logger.info('Calendar update completed', {
      job: jobId,
      inserted,
      updated,
      total: mappedEvents.length,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })

    return NextResponse.json({
      success: true,
      inserted,
      updated,
      total: mappedEvents.length,
      duration_ms: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
    })
  } catch (error) {
    const finishedAt = new Date().toISOString()
    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error('Calendar update failed', {
      job: jobId,
      error: errorMessage,
    })

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(request: NextRequest) {
  return POST(request)
}

