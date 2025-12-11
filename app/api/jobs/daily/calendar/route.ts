/**
 * Job: Resumen diario de calendario con escenarios
 * POST /api/jobs/daily/calendar
 * 
 * Envía todos los días los eventos programados para ese día
 * con escenarios what-if (mejor/peor/estable)
 * 
 * Protegido con CRON_TOKEN
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { assertCronAuth } from '@/lib/security/cron'
import { sendDailyCalendarWithScenarios } from '@/lib/notifications/daily-calendar'
import { recordJobSuccess, recordJobError } from '@/lib/db/job-status'

export async function POST(req: Request) {
  // Verificar autenticación
  try {
    assertCronAuth(req as any)
  } catch (authError) {
    return Response.json(
      { error: authError instanceof Error ? authError.message : 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    console.log('[jobs/daily/calendar] ===== Starting daily calendar summary =====')
    
    await sendDailyCalendarWithScenarios()
    
    await recordJobSuccess('daily/calendar')
    
    console.log('[jobs/daily/calendar] ===== Daily calendar summary sent =====')
    
    return Response.json({
      status: 'ok',
      message: 'Daily calendar summary sent',
    })
  } catch (error) {
    console.error('[jobs/daily/calendar] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await recordJobError('daily/calendar', errorMessage)
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(req: Request) {
  return POST(req)
}

