/**
 * GET /api/notifications/history
 * Get notification history with filters and pagination
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/schema'
import { toZonedTime } from 'date-fns-tz'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const types = searchParams.get('type')?.split(',').filter(Boolean) || []
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const db = getDB()

    // Build WHERE clause
    const conditions: string[] = []
    const params: any[] = []

    // Filter by type
    if (types.length > 0) {
      const placeholders = types.map(() => '?').join(',')
      conditions.push(`tipo IN (${placeholders})`)
      params.push(...types)
    }

    // Filter by date range
    let fromDate: Date | null = null
    let toDate: Date | null = null

    if (fromParam) {
      fromDate = new Date(fromParam)
      conditions.push(`DATE(created_at) >= ?`)
      params.push(format(startOfDay(fromDate), 'yyyy-MM-dd'))
    }

    if (toParam) {
      toDate = new Date(toParam)
      conditions.push(`DATE(created_at) <= ?`)
      params.push(format(endOfDay(toDate), 'yyyy-MM-dd'))
    }

    // Build query
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const query = `
      SELECT 
        id,
        tipo,
        mensaje,
        status,
        error,
        sent_at,
        created_at
      FROM notification_history
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(limit, offset)

    const rows = db.prepare(query).all(...params) as Array<{
      id: number
      tipo: string
      mensaje: string
      status: string
      error: string | null
      sent_at: string | null
      created_at: string
    }>

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notification_history
      ${whereClause}
    `
    const countParams = params.slice(0, -2) // Remove limit and offset
    const countRow = db.prepare(countQuery).all(...countParams) as Array<{ total: number }>
    const total = countRow[0]?.total || 0

    // Format response with Madrid timezone
    const notifications = rows.map(row => {
      const createdAtUTC = new Date(row.created_at)
      const createdAtMadrid = toZonedTime(createdAtUTC, TIMEZONE)
      const sentAtMadrid = row.sent_at ? toZonedTime(new Date(row.sent_at), TIMEZONE) : null

      // Extract title from message (first line or truncated)
      const title = row.mensaje.split('\n')[0].substring(0, 100)

      return {
        id: row.id,
        tipo: row.tipo,
        titulo: title,
        status: row.status,
        error: row.error,
        sent_at: sentAtMadrid ? sentAtMadrid.toISOString() : null,
        created_at: createdAtMadrid.toISOString(),
        hora_madrid: format(createdAtMadrid, 'HH:mm'),
        fecha_madrid: format(createdAtMadrid, 'yyyy-MM-dd'),
      }
    })

    return NextResponse.json({
      notifications,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}


