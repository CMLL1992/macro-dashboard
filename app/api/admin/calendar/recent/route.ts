/**
 * Get recent calendar events
 * GET /api/admin/calendar/recent?limit=5
 */

export const dynamic = 'force-dynamic'
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
    const events = await getCalendarEvents(today, nextMonth)

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

