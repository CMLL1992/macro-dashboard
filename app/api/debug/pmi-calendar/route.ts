/**
 * Debug endpoint: Check PMI events in calendar
 * GET /api/debug/pmi-calendar
 */

import { NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = getUnifiedDB()
    
    // Check PMI events in calendar (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10)
    
    const pmiEvents = isUsingTurso()
      ? await db.prepare(`
          SELECT fecha, evento, consenso, tema
          FROM macro_calendar 
          WHERE fecha >= ? 
            AND (evento LIKE '%PMI%' OR evento LIKE '%ISM%')
            AND (tema = 'Manufactura' OR tema = 'Servicios' OR evento LIKE '%Services%' OR evento LIKE '%Manufacturing%')
          ORDER BY fecha DESC
          LIMIT 10
        `).all(startDate) as Array<{ fecha: string; evento: string; consenso?: string; tema?: string }>
      : await db.prepare(`
          SELECT fecha, evento, consenso, tema
          FROM macro_calendar 
          WHERE fecha >= ? 
            AND (evento LIKE '%PMI%' OR evento LIKE '%ISM%')
            AND (tema = 'Manufactura' OR tema = 'Servicios' OR evento LIKE '%Services%' OR evento LIKE '%Manufacturing%')
          ORDER BY fecha DESC
          LIMIT 10
        `).all(startDate) as Array<{ fecha: string; evento: string; consenso?: string; tema?: string }>
    
    return NextResponse.json({
      pmiEvents,
      count: pmiEvents.length,
      startDate,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
