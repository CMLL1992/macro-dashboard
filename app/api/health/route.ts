/**
 * Health check endpoint
 * Returns the current state of data in the database
 * 
 * Mejorado para manejar mejor el caso de base de datos vacía/no existente
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getDB } from '@/lib/db/schema'
import { checkMacroDataHealth, getLatestObservationDate } from '@/lib/db/read-macro'

export async function GET() {
  try {
    // Intentar obtener la base de datos con manejo de errores mejorado
    let db
    try {
      db = getDB()
    } catch (dbError) {
      console.error('[api/health] Error al obtener base de datos:', dbError)
      return Response.json(
        {
          ready: false,
          error: 'Database initialization error',
          message: dbError instanceof Error ? dbError.message : String(dbError),
          hasData: false,
          observationCount: 0,
          biasCount: 0,
          correlationCount: 0,
          latestDate: null,
          health: {
            hasObservations: false,
            hasBias: false,
            hasCorrelations: false,
            observationCount: 0,
            biasCount: 0,
            correlationCount: 0,
            latestDate: null,
          },
        },
        { status: 500 }
      )
    }

    // Intentar obtener conteos con manejo de errores por tabla
    let obsCount = { c: 0 }
    let biasCount = { c: 0 }
    let corrCount = { c: 0 }
    let latestDate: string | null = null
    let health: ReturnType<typeof checkMacroDataHealth> | null = null

    try {
      // Verificar que las tablas existen antes de consultarlas
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{ name: string }>
      const tableNames = new Set(tables.map(t => t.name))

      if (tableNames.has('macro_observations')) {
        obsCount = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
      } else {
        console.warn('[api/health] Tabla macro_observations no existe')
      }

      if (tableNames.has('macro_bias')) {
        biasCount = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
      } else {
        console.warn('[api/health] Tabla macro_bias no existe')
      }

      if (tableNames.has('correlations')) {
        corrCount = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
      } else {
        console.warn('[api/health] Tabla correlations no existe')
      }

      // Intentar obtener última fecha
      try {
        latestDate = getLatestObservationDate()
      } catch (dateError) {
        console.warn('[api/health] Error al obtener última fecha:', dateError)
        latestDate = null
      }

      // Intentar obtener health check
      try {
        health = checkMacroDataHealth()
      } catch (healthError) {
        console.warn('[api/health] Error en checkMacroDataHealth:', healthError)
        health = {
          hasObservations: obsCount.c > 0,
          hasBias: biasCount.c > 0,
          hasCorrelations: corrCount.c > 0,
          observationCount: obsCount.c,
          biasCount: biasCount.c,
          correlationCount: corrCount.c,
          latestDate,
        }
      }
    } catch (queryError) {
      console.error('[api/health] Error al consultar base de datos:', queryError)
      // Retornar respuesta con valores por defecto
      return Response.json(
        {
          ready: false,
          error: 'Database query error',
          message: queryError instanceof Error ? queryError.message : String(queryError),
          hasData: false,
          observationCount: 0,
          biasCount: 0,
          correlationCount: 0,
          latestDate: null,
          health: {
            hasObservations: false,
            hasBias: false,
            hasCorrelations: false,
            observationCount: 0,
            biasCount: 0,
            correlationCount: 0,
            latestDate: null,
          },
        },
        { status: 500 }
      )
    }

    // Si llegamos aquí, todo funcionó correctamente
    // ready = true si hay datos mínimos para mostrar el dashboard
    const ready = health.hasObservations && health.hasBias && health.hasCorrelations
    
    return Response.json({
      ready,
      hasData: health.hasObservations && health.hasBias,
      observationCount: obsCount.c,
      biasCount: biasCount.c,
      correlationCount: corrCount.c,
      latestDate: latestDate,
      health: {
        hasObservations: health.hasObservations,
        hasBias: health.hasBias,
        hasCorrelations: health.hasCorrelations,
        observationCount: health.observationCount,
        biasCount: health.biasCount,
        correlationCount: health.correlationCount,
        latestDate: health.latestDate,
      },
    })
  } catch (error) {
    console.error('[api/health] Error inesperado:', error)
    console.error('[api/health] Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    return Response.json(
      {
        ready: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        hasData: false,
        observationCount: 0,
        biasCount: 0,
        correlationCount: 0,
        latestDate: null,
      },
      { status: 500 }
    )
  }
}
