/**
 * Endpoint para insertar datos de PMI manualmente
 * POST /api/admin/pmi/insert
 * 
 * Permite insertar valores del PMI cuando se publican mensualmente
 * Protegido por CRON_TOKEN o INGEST_KEY
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateCronToken, unauthorizedResponse } from '@/lib/security/token'
import { validateIngestKeyWithError } from '@/lib/security/ingest'
import { upsertMacroSeries } from '@/lib/db/upsert'
import { logger } from '@/lib/obs/logger'
import type { MacroSeries } from '@/lib/types/macro'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  // Validar autenticación (CRON_TOKEN o INGEST_KEY)
  const cronValid = validateCronToken(request)
  const ingestValid = validateIngestKeyWithError(request)
  
  if (!cronValid && !ingestValid.valid) {
    return unauthorizedResponse()
  }

  try {
    const body = await request.json()
    const { date, value } = body

    // Validar datos
    if (!date || !value) {
      return NextResponse.json(
        { success: false, error: 'date and value are required' },
        { status: 400 }
      )
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      return NextResponse.json(
        { success: false, error: 'value must be a number' },
        { status: 400 }
      )
    }

    // Validar formato de fecha (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { success: false, error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Crear o actualizar la serie PMI
    const pmiSeries: MacroSeries = {
      id: 'USPMI',
      source: 'MANUAL',
      indicator: 'USPMI',
      nativeId: 'manual-entry',
      name: 'ISM Manufacturing: PMI',
      frequency: 'm',
      data: [{ date, value: numValue }],
      lastUpdated: date,
    }

    await upsertMacroSeries(pmiSeries)

    logger.info('PMI value inserted manually', {
      date,
      value: numValue,
    })

    return NextResponse.json({
      success: true,
      message: 'PMI value inserted successfully',
      date,
      value: numValue,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Failed to insert PMI value', { error: errorMsg })

    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    )
  }
}








