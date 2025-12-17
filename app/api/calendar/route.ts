/**
 * API endpoint para obtener eventos del calendario económico con filtros
 * GET /api/calendar?from=2025-12-10&to=2025-12-17&region=US,EU&impact=high,medium&query=cpi
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getRegionCode, MAIN_REGIONS, type RegionCode } from '@/config/calendar-countries'

export interface CalendarEventResponse {
  id: string
  dateTimeUtc: string
  localTime: string
  region: string
  country: string
  currency: string
  title: string
  category: string | null
  importance: 'low' | 'medium' | 'high' | null
  actual: string | null
  previous: string | null
  forecast: string | null
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parsear parámetros de fecha (por defecto: hoy + 7 días)
    const now = new Date()
    const defaultFrom = new Date(now.getTime())
    defaultFrom.setHours(0, 0, 0, 0)
    const defaultTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    defaultTo.setHours(23, 59, 59, 999)
    
    const fromStr = searchParams.get('from') || defaultFrom.toISOString().split('T')[0]
    const toStr = searchParams.get('to') || defaultTo.toISOString().split('T')[0]
    
    const from = new Date(fromStr + 'T00:00:00Z')
    const to = new Date(toStr + 'T23:59:59Z')
    
    // Parsear filtros
    const regionParam = searchParams.get('region')
    const regions: RegionCode[] = regionParam 
      ? (regionParam.split(',').filter(r => MAIN_REGIONS.includes(r as RegionCode)) as RegionCode[])
      : MAIN_REGIONS // Por defecto: todas las regiones principales
    
    const impactParam = searchParams.get('impact')
    const impacts: ('low' | 'medium' | 'high')[] = impactParam
      ? (impactParam.split(',') as ('low' | 'medium' | 'high')[])
      : ['high', 'medium'] // Por defecto: solo high y medium
    
    const query = searchParams.get('query')?.toLowerCase().trim() || ''
    
    // Construir query SQL
    let sql = `
      SELECT 
        id,
        source_event_id,
        country,
        currency,
        name,
        category,
        importance,
        scheduled_time_utc,
        scheduled_time_local,
        previous_value,
        consensus_value,
        consensus_range_min,
        consensus_range_max
      FROM economic_events
      WHERE scheduled_time_utc >= ? AND scheduled_time_utc <= ?
    `
    
    const params: any[] = [from.toISOString(), to.toISOString()]
    
    // Filtrar por importancia
    if (impacts.length > 0 && impacts.length < 3) {
      const placeholders = impacts.map(() => '?').join(',')
      sql += ` AND importance IN (${placeholders})`
      params.push(...impacts)
    }
    
    // Filtrar por región (mapear región a países)
    if (regions.length > 0 && regions.length < MAIN_REGIONS.length) {
      // Mapeo de regiones a países (según los países permitidos en el job)
      const regionToCountries: Record<RegionCode, string[]> = {
        US: ['United States'],
        EU: ['Euro Area', 'European Union', 'Germany', 'Spain'], // EUR: Euro Area + países europeos
        UK: ['United Kingdom'],
        JP: ['Japan'],
        AU: ['Australia'],
        CA: ['Canada'],
        CH: ['Switzerland'],
        CN: ['China'],
        DE: ['Germany', 'Euro Area', 'European Union'], // Alemania también es EUR
        FR: ['France', 'Euro Area', 'European Union'],
        IT: ['Italy', 'Euro Area', 'European Union'],
        ES: ['Spain', 'Euro Area', 'European Union'], // España también es EUR
        NZ: ['New Zealand'],
      }
      
      const allowedCountries = new Set<string>()
      regions.forEach(region => {
        const countries = regionToCountries[region] || []
        countries.forEach(c => allowedCountries.add(c))
      })
      
      if (allowedCountries.size > 0) {
        const countryPlaceholders = Array.from(allowedCountries).map(() => '?').join(',')
        sql += ` AND country IN (${countryPlaceholders})`
        params.push(...Array.from(allowedCountries))
      }
    }
    
    sql += ' ORDER BY scheduled_time_utc ASC'
    
    // Ejecutar query
    // All methods are async now, so always use await
    const db = getUnifiedDB()
    const rows = await db.prepare(sql).all(...params) as any[]
    
    // Mapear resultados y aplicar filtro de búsqueda por texto
    const events: CalendarEventResponse[] = rows
      .map(row => {
        const regionCode = getRegionCode(row.country) || 'US'
        const localTime = row.scheduled_time_local || new Date(row.scheduled_time_utc).toLocaleString('es-ES', {
          timeZone: 'Europe/Madrid',
        })
        
        return {
          id: String(row.id),
          dateTimeUtc: row.scheduled_time_utc,
          localTime,
          region: regionCode,
          country: row.country,
          currency: row.currency,
          title: row.name,
          category: row.category,
          importance: row.importance,
          actual: row.consensus_value != null ? String(row.consensus_value) : null,
          previous: row.previous_value != null ? String(row.previous_value) : null,
          forecast: row.consensus_value != null ? String(row.consensus_value) : null,
        }
      })
      .filter(event => {
        // Filtro de búsqueda por texto
        if (!query) return true
        
        const searchText = query.toLowerCase()
        return (
          event.title.toLowerCase().includes(searchText) ||
          event.country.toLowerCase().includes(searchText) ||
          event.currency.toLowerCase().includes(searchText) ||
          (event.category && event.category.toLowerCase().includes(searchText))
        )
      })
    
    return NextResponse.json({
      ok: true,
      data: events,
      events, // Mantener para compatibilidad
      count: events.length,
      filters: {
        from: fromStr,
        to: toStr,
        regions,
        impacts,
        query: query || null,
      },
    })
  } catch (error) {
    console.error('[api/calendar] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendar events',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}




