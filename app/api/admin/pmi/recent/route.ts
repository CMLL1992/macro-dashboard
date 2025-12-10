/**
 * Endpoint para obtener valores recientes de PMI
 * GET /api/admin/pmi/recent
 * 
 * Protegido por CRON_TOKEN o INGEST_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Validar autenticación (CRON_TOKEN o INGEST_KEY)
  const cronValid = validateCronToken(request)
  const ingestValid = validateIngestKeyWithError(request)
  
  if (!cronValid && !ingestValid.valid) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    let entries: Array<{ date: string; value: number }> = []

    if (isUsingTurso()) {
      const db = getUnifiedDB()
      const result = await db.prepare(
        'SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 10'
      ).all('USPMI')
      
      entries = (result as Array<{ date: string; value: number }>).map(row => ({
        date: row.date,
        value: row.value,
      }))
    } else {
      const db = getDB()
      const rows = db
        .prepare('SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 10')
        .all('USPMI') as Array<{ date: string; value: number }>
      
      entries = rows.map(row => ({
        date: row.date,
        value: row.value,
      }))
    }

    return NextResponse.json({
      success: true,
      entries,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}








