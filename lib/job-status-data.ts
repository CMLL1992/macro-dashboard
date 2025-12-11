/**
 * Helper function to get job status data (for Server Components)
 * This is the same logic as /api/status/jobs but directly accessible from server components
 */

import { getAllJobStatuses } from '@/lib/db/job-status'
import { getRecentEventsWithImpact } from '@/lib/db/recent-events'

export type JobStatus = {
  calendar?: {
    last_success_at: string | null
    last_error_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
  releases?: {
    last_success_at: string | null
    last_error_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
  bias?: {
    last_updated_at: string | null
    status: 'ok' | 'warning' | 'error'
  }
}

export async function getJobStatusData(): Promise<JobStatus> {
  try {
    // Obtener estados de jobs con manejo de errores individual
    let jobStatuses: Awaited<ReturnType<typeof getAllJobStatuses>> = []
    try {
      jobStatuses = await getAllJobStatuses()
    } catch (error) {
      console.warn('[getJobStatusData] Error fetching job statuses:', error)
      // Continuar con array vacío si falla
    }

    // Obtener eventos recientes con manejo de errores
    let recentEvents: Awaited<ReturnType<typeof getRecentEventsWithImpact>> = []
    try {
      recentEvents = await getRecentEventsWithImpact({ hours: 48, min_importance: 'medium' })
    } catch (error) {
      console.warn('[getJobStatusData] Error fetching recent events:', error)
      // Continuar con array vacío si falla
    }

    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const threeMinutesAgo = now - 3 * 60 * 1000

    // Estado de calendario
    const calendarStatus = jobStatuses.find(j => j.job_name === 'ingest/calendar')
    const calendarLastSuccess = calendarStatus?.last_success_at
      ? new Date(calendarStatus.last_success_at).getTime()
      : null
    const calendarStatusValue =
      calendarStatus?.last_error_at && (!calendarLastSuccess || new Date(calendarStatus.last_error_at).getTime() > calendarLastSuccess)
        ? 'error'
        : calendarLastSuccess && calendarLastSuccess < oneDayAgo
        ? 'warning'
        : 'ok'

    // Estado de releases
    const releasesStatus = jobStatuses.find(j => j.job_name === 'ingest/releases')
    const releasesLastSuccess = releasesStatus?.last_success_at
      ? new Date(releasesStatus.last_success_at).getTime()
      : null
    // Antes se exigía ejecución < 3 minutos → warning constante.
    // Ahora consideramos warning si pasó más de 24h sin releases.
    const releasesStatusValue =
      releasesStatus?.last_error_at && (!releasesLastSuccess || new Date(releasesStatus.last_error_at).getTime() > releasesLastSuccess)
        ? 'error'
        : releasesLastSuccess && releasesLastSuccess < oneDayAgo
        ? 'warning'
        : 'ok'

    // Estado de bias (comparar con último release)
    const lastEvent = recentEvents[0]
    const biasUpdatedAt = jobStatuses.find(j => j.job_name === 'compute/bias')?.last_success_at
    let biasStatusValue: 'ok' | 'warning' | 'error' = 'ok'
    
    if (lastEvent && biasUpdatedAt) {
      try {
        const lastEventTime = new Date(lastEvent.release_time_utc).getTime()
        const biasTime = new Date(biasUpdatedAt).getTime()
        
        // Si el bias es más antiguo que el último release, warning
        if (biasTime < lastEventTime) {
          const diffMinutes = (lastEventTime - biasTime) / (60 * 1000)
          if (diffMinutes > 5) {
            biasStatusValue = 'warning'
          }
        }
      } catch (error) {
        console.warn('[getJobStatusData] Error comparing bias with last event:', error)
        // Mantener 'ok' si hay error en la comparación
      }
    }

    return {
      calendar: {
        last_success_at: calendarStatus?.last_success_at || null,
        last_error_at: calendarStatus?.last_error_at || null,
        status: calendarStatusValue,
      },
      releases: {
        last_success_at: releasesStatus?.last_success_at || null,
        last_error_at: releasesStatus?.last_error_at || null,
        status: releasesStatusValue,
      },
      bias: {
        last_updated_at: biasUpdatedAt || null,
        status: biasStatusValue,
      },
    }
  } catch (error) {
    console.error('[getJobStatusData] Unexpected error:', error)
    // Retornar estado de error en lugar de lanzar excepción
    return {
      calendar: {
        last_success_at: null,
        last_error_at: null,
        status: 'error' as const,
      },
      releases: {
        last_success_at: null,
        last_error_at: null,
        status: 'error' as const,
      },
      bias: {
        last_updated_at: null,
        status: 'error' as const,
      },
    }
  }
}

