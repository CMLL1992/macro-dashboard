/**
 * Export notifications log as CSV
 * GET /api/qa/notifications/export?from=YYYY-MM-DD
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from')
  const db = getDB()

  let query = 'SELECT created_at, type, shadow, payload_json FROM notifications_log'
  const params: any[] = []
  if (from) {
    query += ' WHERE created_at >= ?'
    params.push(new Date(from).toISOString())
  }
  query += ' ORDER BY created_at ASC'

  const rows = db.prepare(query).all(...params) as any[]
  const header = 'created_at,type,shadow,payload\n'
  const csv =
    header +
    rows
      .map((r) => {
        const payload = JSON.stringify(JSON.parse(r.payload_json))
          .replaceAll('"', '""')
        return `${r.created_at},${r.type},${r.shadow ? 'true' : 'false'},"${payload}"`
      })
      .join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="notifications.csv"',
    },
  })
}






