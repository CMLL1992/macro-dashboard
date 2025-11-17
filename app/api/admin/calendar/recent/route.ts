/**
 * Get recent calendar events
 * GET /api/admin/calendar/recent?limit=5
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getCalendarEvents } from '@/lib/notifications/weekly'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // Get events from today onwards
    const today = new Date().toISOString().split('T')[0]
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Query directly to get ID
    const { getDB } = await import('@/lib/db/schema')
    const db = getDB()
    
    const rows = db.prepare(`
      SELECT id, fecha, hora_local, pais, tema, evento, importancia, consenso
      FROM macro_calendar
      WHERE fecha >= ? AND fecha <= ?
      ORDER BY fecha, hora_local
      LIMIT ?
    `).all(today, nextMonth, limit) as Array<{
      id: number
      fecha: string
      hora_local: string | null
      pais: string | null
      tema: string
      evento: string
      importancia: string
      consenso: string | null
    }>

    const events = rows.map(row => ({
      id: row.id,
      fecha: row.fecha,
      hora_local: row.hora_local || undefined,
      pais: row.pais || undefined,
      tema: row.tema,
      evento: row.evento,
      importancia: row.importancia as 'low' | 'med' | 'high',
      consenso: row.consenso || undefined,
    }))

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[admin/calendar/recent] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

