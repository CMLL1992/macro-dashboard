/**
 * Health check específico para la base de datos
 * Verifica que la conexión a Turso/SQLite funciona correctamente
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getUnifiedDB, isUsingTurso, initializeSchemaUnified } from '@/lib/db/unified-db'

export async function GET() {
  try {
    const usingTurso = isUsingTurso()
    const tursoUrl = process.env.TURSO_DATABASE_URL
    const hasToken = !!process.env.TURSO_AUTH_TOKEN

    // Inicializar esquema si es necesario
    try {
      await initializeSchemaUnified()
    } catch (schemaError: any) {
      console.warn('[api/health/db] Schema initialization warning:', schemaError.message)
      // Continuar aunque haya warnings de schema
    }

    const db = getUnifiedDB()

    // Prueba básica: SELECT 1
    const testResult = await db.prepare('SELECT 1 as test').get() as { test: number } | undefined

    // Contar tablas
    const tablesResult = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    // Contar registros en tablas clave
    const counts: Record<string, number> = {}
    const tablesToCheck = [
      'macro_series',
      'macro_observations',
      'macro_bias',
      'correlations',
      'indicator_history',
    ]

    for (const tableName of tablesToCheck) {
      try {
        const countResult = await db.prepare(`SELECT COUNT(1) as c FROM ${tableName}`).get() as { c: number } | undefined
        counts[tableName] = countResult?.c || 0
      } catch (error: any) {
        counts[tableName] = -1 // -1 indica error
      }
    }

    // Última observación
    let latestDate: string | null = null
    try {
      const latestObs = await db.prepare(
        'SELECT MAX(date) as latest_date FROM macro_observations'
      ).get() as { latest_date: string | null } | undefined
      latestDate = latestObs?.latest_date || null
    } catch (error) {
      // Ignorar si la tabla no existe o está vacía
    }

    return NextResponse.json({
      ok: true,
      database: {
        type: usingTurso ? 'Turso' : 'SQLite',
        url: usingTurso ? (tursoUrl ? 'configured' : 'not configured') : 'local',
        hasToken: usingTurso ? hasToken : null,
      },
      connection: {
        test: testResult?.test === 1 ? 'ok' : 'failed',
      },
      schema: {
        tablesCount: tablesResult.length,
        tables: tablesResult.map(t => t.name),
      },
      data: {
        counts,
        latestObservationDate: latestDate,
      },
      health: {
        connected: true,
        hasData: counts.macro_observations > 0,
        hasBias: counts.macro_bias > 0,
        hasCorrelations: counts.correlations > 0,
      },
    })
  } catch (error: any) {
    console.error('[api/health/db] Error:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        database: {
          type: isUsingTurso() ? 'Turso' : 'SQLite',
          url: process.env.TURSO_DATABASE_URL ? 'configured' : 'not configured',
          hasToken: !!process.env.TURSO_AUTH_TOKEN,
        },
        health: {
          connected: false,
          hasData: false,
          hasBias: false,
          hasCorrelations: false,
        },
      },
      { status: 500 }
    )
  }
}
