/**
 * Health check endpoint
 * Returns the current state of data in the database
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { getDB } from '@/lib/db/schema'
import { checkMacroDataHealth, getLatestObservationDate } from '@/lib/db/read-macro'

export async function GET() {
  try {
    const db = getDB()
    
    // Get counts
    const obsCount = db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number }
    const biasCount = db.prepare('SELECT COUNT(1) as c FROM macro_bias').get() as { c: number }
    const corrCount = db.prepare('SELECT COUNT(1) as c FROM correlations WHERE value IS NOT NULL').get() as { c: number }
    
    // Get latest observation date
    const latestDate = getLatestObservationDate()
    
    // Check health
    const health = checkMacroDataHealth()
    
    return Response.json({
      hasData: health.hasObservations && health.hasBias,
      observationCount: obsCount.c,
      biasCount: biasCount.c,
      correlationCount: corrCount.c,
      latestDate: latestDate,
      health: {
        hasObservations: health.hasObservations,
        hasBias: health.hasBias,
        observationCount: health.observationCount,
        biasCount: health.biasCount,
        correlationCount: health.correlationCount,
      },
    })
  } catch (error) {
    console.error('[api/health] Error:', error)
    return Response.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
