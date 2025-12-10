/**
 * Calendario macroeconómico
 * Gestiona eventos macro (CPI, NFP, GDP, etc.) con fechas, consensos y datos anteriores
 */

export type EventImpact = 'high' | 'medium'

export type EventCountry = 'US' | 'EA' | 'GB' | 'JP' | 'AU'

export interface MacroEvent {
  id: string                // 'US_CPI_YOY_2025-12-11'
  date: string              // '2025-12-11' (UTC)
  time: string | null       // '13:30' o null si no lo sabes
  country: EventCountry
  indicatorKey: string      // tu key interna: 'CPIAUCSL', 'EU_CPI_YOY', etc.
  title: string             // 'Inflación CPI (YoY)'
  previous: number | null   // dato anterior
  consensus: number | null  // forecast
  impact: EventImpact       // 'high' | 'medium'
  source: 'trading_economics' | 'estimated'
}

/**
 * Obtiene eventos macro de la semana actual (o próxima si es domingo)
 */
export async function getUpcomingEventsForWeek(startDate?: string): Promise<MacroEvent[]> {
  const { getUnifiedDB, isUsingTurso } = await import('@/lib/db/unified-db')
  
  // Si no se proporciona fecha, usar hoy o próximo lunes si es domingo
  let weekStart = startDate
  if (!weekStart) {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = domingo, 1 = lunes, ...
    
    if (dayOfWeek === 0) {
      // Si es domingo, mostrar la semana que viene
      const nextMonday = new Date(today)
      nextMonday.setDate(today.getDate() + 1) // Lunes siguiente
      weekStart = nextMonday.toISOString().split('T')[0]
    } else {
      // Si no es domingo, mostrar esta semana (lunes de esta semana)
      const monday = new Date(today)
      monday.setDate(today.getDate() - (dayOfWeek - 1))
      weekStart = monday.toISOString().split('T')[0]
    }
  }
  
  const endDate = addDays(weekStart, 7)
  
  const db = getUnifiedDB()
  const isTurso = isUsingTurso()
  
  try {
    if (isTurso) {
      const result = await db.prepare(`
        SELECT * FROM macro_events 
        WHERE date >= ? AND date < ? 
        ORDER BY date, time, country, indicator_key
      `).all(weekStart, endDate)
      
      return (result as any[]).map(row => ({
        id: row.id,
        date: row.date,
        time: row.time,
        country: row.country as EventCountry,
        indicatorKey: row.indicator_key,
        title: row.title,
        previous: row.previous,
        consensus: row.consensus,
        impact: row.impact as EventImpact,
        source: row.source as 'trading_economics' | 'estimated',
      }))
    } else {
      const { getDB } = await import('@/lib/db/schema')
      const dbSync = getDB()
      const rows = dbSync.prepare(`
        SELECT * FROM macro_events 
        WHERE date >= ? AND date < ? 
        ORDER BY date, time, country, indicator_key
      `).all(weekStart, endDate) as any[]
      
      return rows.map(row => ({
        id: row.id,
        date: row.date,
        time: row.time,
        country: row.country as EventCountry,
        indicatorKey: row.indicator_key,
        title: row.title,
        previous: row.previous,
        consensus: row.consensus,
        impact: row.impact as EventImpact,
        source: row.source as 'trading_economics' | 'estimated',
      }))
    }
  } catch (error) {
    console.error('[getUpcomingEventsForWeek] Error fetching events:', error)
    return []
  }
}

/**
 * Helper: añadir días a una fecha ISO
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

