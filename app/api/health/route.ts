/**
 * Health check endpoint
 * Returns the current state of data in the database
 * 
 * Mejorado para manejar mejor el caso de base de datos vacía/no existente
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'
import { getDB } from '@/lib/db/schema'
import { checkMacroDataHealth, getLatestObservationDate } from '@/lib/db/read-macro'

export async function GET() {
  try {
    // Usar getUnifiedDB() directamente con await para Turso
    let health
    try {
      health = await checkMacroDataHealth()
    } catch (healthError) {
      console.error('[api/health] Error en checkMacroDataHealth:', healthError)
      return Response.json(
        {
          ready: false,
          error: 'Health check failed',
          message: healthError instanceof Error ? healthError.message : String(healthError),
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
      observationCount: health.observationCount,
      biasCount: health.biasCount,
      correlationCount: health.correlationCount,
      latestDate: health.latestDate,
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
