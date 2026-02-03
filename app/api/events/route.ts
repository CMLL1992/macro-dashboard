/**
 * GET /api/events
 * MVP: Endpoint para obtener eventos macroeconómicos con forecast/actual/surprise
 * 
 * Respuesta esperada:
 * {
 *   "provider": "TradingEconomics",
 *   "status": "ok",
 *   "events": [...]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso, initializeSchemaUnified } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { logger } from '@/lib/obs/logger'

export const runtime = 'nodejs'

type EventType = 'upcoming' | 'release'

/**
 * MVP: Solo incluir estos indicadores
 */
const MVP_INDICATORS = new Set([
  // CPI
  'cpi',
  'consumer price index',
  'inflation',
  
  // NFP
  'nonfarm payrolls',
  'nfp',
  'employment',
  'payrolls',
  
  // Decisiones de tipos
  'interest rate',
  'fed rate',
  'ecb rate',
  'boe rate',
  'boj rate',
  'monetary policy',
  'rate decision',
  
  // PMI
  'pmi',
  'manufacturing pmi',
  'services pmi',
  'composite pmi',
])

/**
 * Verificar si un nombre de evento coincide con los indicadores MVP
 */
function isMVPIndicator(name: string): boolean {
  const nameLower = name.toLowerCase()
  for (const indicator of MVP_INDICATORS) {
    if (nameLower.includes(indicator)) {
      return true
    }
  }
  return false
}

function toMillis(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

function completenessScore(e: {
  actual: number | null
  forecast: number | null
  previous: number | null
  surprise: number | null
  impact: 'low' | 'medium' | 'high' | null
  hasNewPublication: boolean
}): number {
  // Preferimos el registro "más completo" cuando hay duplicados.
  let score = 0
  if (e.hasNewPublication) score += 100
  if (e.actual != null) score += 50
  if (e.surprise != null) score += 10
  if (e.forecast != null) score += 5
  if (e.previous != null) score += 2
  if (e.impact === 'high') score += 3
  else if (e.impact === 'medium') score += 2
  else if (e.impact === 'low') score += 1
  return score
}

/**
 * Obtener eventos con releases desde la BD
 */
async function getEventsWithReleases(params?: {
  from?: Date
  to?: Date
  country?: string
  currency?: string
}): Promise<Array<{
  id: number
  country: string
  currency: string
  indicator: string
  datetime: string
  previous: number | null
  forecast: number | null
  actual: number | null
  surprise: number | null
  impact: 'low' | 'medium' | 'high' | null
  hasNewPublication: boolean
  type: EventType
}>> {
  await initializeSchemaUnified()
  
  const { from, to, country, currency } = params || {}
  const now = new Date()
  const defaultFrom = from || new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) // Últimos 3 días
  const defaultTo = to || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // Próximos 30 días
  
  if (isUsingTurso()) {
    const db = getUnifiedDB()
    
    // Query para obtener eventos con sus releases (si existen)
    let query = `
      SELECT 
        e.id,
        e.country,
        e.currency,
        e.name as indicator,
        e.scheduled_time_utc as datetime,
        e.previous_value as previous,
        e.consensus_value as forecast,
        e.importance as impact,
        r.actual_value as actual,
        r.surprise_raw as surprise,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_release
      FROM economic_events e
      LEFT JOIN economic_releases r ON e.id = r.event_id
      WHERE e.scheduled_time_utc >= ? AND e.scheduled_time_utc <= ?
    `
    
    const params: any[] = [defaultFrom.toISOString(), defaultTo.toISOString()]
    
    if (country) {
      query += ' AND e.country = ?'
      params.push(country)
    }
    
    if (currency) {
      query += ' AND e.currency = ?'
      params.push(currency)
    }
    
    query += ' ORDER BY e.scheduled_time_utc ASC'
    
    const stmt = db.prepare(query)
    const rows = await stmt.all(...params) as Array<{
      id: number
      country: string
      currency: string
      indicator: string
      datetime: string
      previous: number | null
      forecast: number | null
      impact: string | null
      actual: number | null
      surprise: number | null
      has_release: number
    }>
    
    // Filtrar solo indicadores MVP y formatear
    const base = rows
      .filter(row => isMVPIndicator(row.indicator))
      .map(row => {
        // Calcular surprise: actual - forecast (solo si ambos existen)
        let surprise: number | null = null
        if (row.actual != null && row.forecast != null) {
          surprise = row.actual - row.forecast
        }
        
        return {
          id: row.id,
          country: row.country,
          currency: row.currency,
          indicator: row.indicator,
          datetime: row.datetime, // Ya está en formato ISO UTC desde scheduled_time_utc
          previous: row.previous,
          forecast: row.forecast,
          actual: row.actual,
          surprise,
          impact: (row.impact?.toLowerCase() || 'low') as 'low' | 'medium' | 'high',
          hasNewPublication: row.has_release === 1,
          type: (row.has_release === 1 || row.actual != null) ? ('release' as const) : ('upcoming' as const),
        }
      })

    return base
  } else {
    const db = getDB()
    
    let query = `
      SELECT 
        e.id,
        e.country,
        e.currency,
        e.name as indicator,
        e.scheduled_time_utc as datetime,
        e.previous_value as previous,
        e.consensus_value as forecast,
        e.importance as impact,
        r.actual_value as actual,
        r.surprise_raw as surprise,
        CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as has_release
      FROM economic_events e
      LEFT JOIN economic_releases r ON e.id = r.event_id
      WHERE e.scheduled_time_utc >= ? AND e.scheduled_time_utc <= ?
    `
    
    const params: any[] = [defaultFrom.toISOString(), defaultTo.toISOString()]
    
    if (country) {
      query += ' AND e.country = ?'
      params.push(country)
    }
    
    if (currency) {
      query += ' AND e.currency = ?'
      params.push(currency)
    }
    
    query += ' ORDER BY e.scheduled_time_utc ASC'
    
    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as Array<{
      id: number
      country: string
      currency: string
      indicator: string
      datetime: string
      previous: number | null
      forecast: number | null
      impact: string | null
      actual: number | null
      surprise: number | null
      has_release: number
    }>
    
    // Filtrar solo indicadores MVP y formatear
    const base = rows
      .filter(row => isMVPIndicator(row.indicator))
      .map(row => {
        // Calcular surprise: actual - forecast (solo si ambos existen)
        let surprise: number | null = null
        if (row.actual != null && row.forecast != null) {
          surprise = row.actual - row.forecast
        }
        
        return {
          id: row.id,
          country: row.country,
          currency: row.currency,
          indicator: row.indicator,
          datetime: row.datetime, // Ya está en formato ISO UTC desde scheduled_time_utc
          previous: row.previous,
          forecast: row.forecast,
          actual: row.actual,
          surprise,
          impact: (row.impact?.toLowerCase() || 'low') as 'low' | 'medium' | 'high',
          hasNewPublication: row.has_release === 1,
          type: (row.has_release === 1 || row.actual != null) ? ('release' as const) : ('upcoming' as const),
        }
      })

    return base
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const country = searchParams.get('country') || undefined
    const currency = searchParams.get('currency') || undefined
    
    const from = fromParam ? new Date(fromParam) : undefined
    const to = toParam ? new Date(toParam) : undefined
    
    const rawEvents = await getEventsWithReleases({ from, to, country, currency })

    // Deduplicar por (currency + indicator + datetime)
    const dedupedMap = new Map<string, (typeof rawEvents)[number]>()
    for (const e of rawEvents) {
      const key = `${String(e.currency)}|${String(e.indicator)}|${String(e.datetime)}`
      const prev = dedupedMap.get(key)
      if (!prev) {
        dedupedMap.set(key, e)
        continue
      }
      // Preferir el más completo (y con release si existe)
      const prevScore = completenessScore(prev)
      const currScore = completenessScore(e)
      if (currScore > prevScore) {
        dedupedMap.set(key, e)
      }
    }
    const deduped = Array.from(dedupedMap.values())

    // Ordenar correctamente + limitar resultados
    const nowMs = Date.now()
    const upcoming = deduped
      .filter((e) => e.type === 'upcoming' && (toMillis(e.datetime) ?? -1) >= nowMs)
      .sort((a, b) => (toMillis(a.datetime) ?? 0) - (toMillis(b.datetime) ?? 0))
      .slice(0, 10)
      .map((e) => ({ ...e, type: 'upcoming' as const }))

    const releases = deduped
      .filter((e) => e.type === 'release')
      .sort((a, b) => (toMillis(b.datetime) ?? 0) - (toMillis(a.datetime) ?? 0))
      .slice(0, 10)
      .map((e) => ({ ...e, type: 'release' as const }))

    const events = [...upcoming, ...releases]
    
    logger.info('api.events.fetched', {
      count_raw: rawEvents.length,
      count_deduped: deduped.length,
      count_final: events.length,
      country,
      currency,
    })
    
    return NextResponse.json({
      provider: 'TradingEconomics',
      status: 'ok',
      events,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('api.events.failed', {
      error: errorMsg,
    })
    
    // Si el proveedor falla, devolver status específico
    if (errorMsg.includes('TradingEconomics') || errorMsg.includes('API')) {
      return NextResponse.json(
        {
          provider: 'TradingEconomics',
          status: 'provider_unavailable',
          events: [],
        },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      {
        provider: 'TradingEconomics',
        status: 'error',
        error: errorMsg,
        events: [],
      },
      { status: 500 }
    )
  }
}
