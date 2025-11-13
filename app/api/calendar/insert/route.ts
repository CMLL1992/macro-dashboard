/**
 * Insert calendar event
 * POST /api/calendar/insert
 */

import { NextRequest, NextResponse } from 'next/server'
import { insertCalendarEvent, type CalendarEvent } from '@/lib/notifications/weekly'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'

export async function POST(request: NextRequest) {
  // Validate ingest key (production) or cron token (admin/manual in dev)
  const ingestValid = validateIngestKeyWithError(request)
  
  // In production, INGEST_KEY is required
  if (process.env.NODE_ENV === 'production' && !ingestValid.valid) {
    return NextResponse.json(
      { error: ingestValid.error || 'INGEST_KEY is required in production' },
      { status: 400 }
    )
  }
  
  // In development, allow CRON_TOKEN as fallback
  const cronValid = process.env.NODE_ENV !== 'production' && process.env.ENABLE_TELEGRAM_TESTS === 'true'
    ? validateCronToken(request)
    : false
  
  if (!ingestValid.valid && !cronValid) {
    return NextResponse.json(
      { error: ingestValid.error || 'Unauthorized. Provide X-INGEST-KEY header' + (process.env.NODE_ENV !== 'production' ? ' or CRON_TOKEN (dev only)' : '') },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.fecha || !body.tema || !body.evento || !body.importancia) {
      return NextResponse.json(
        { error: 'Missing required fields: fecha, tema, evento, importancia' },
        { status: 400 }
      )
    }

    // Validate importancia
    if (!['low', 'med', 'high'].includes(body.importancia)) {
      return NextResponse.json(
        { error: 'importancia must be one of: low, med, high' },
        { status: 400 }
      )
    }

    const event: CalendarEvent = {
      fecha: body.fecha, // YYYY-MM-DD
      hora_local: body.hora_local, // HH:mm
      pais: body.pais,
      tema: body.tema,
      evento: body.evento,
      importancia: body.importancia,
      consenso: body.consenso,
    }

    const result = insertCalendarEvent(event)

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      message: result.inserted ? 'Calendar event inserted' : 'Calendar event already exists (updated)',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[calendar/insert] Error:', errorMessage)
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

