/**
 * Weekly summary job
 * POST /api/jobs/weekly
 * 
 * Envía los domingos:
 * 1. Resumen de calendario de la próxima semana
 * 2. Resumen macroeconómico completo
 * 
 * Protegido con CRON_TOKEN
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { assertCronAuth } from '@/lib/security/cron'
import { sendWeeklyCalendarSummary } from '@/lib/notifications/calendar'
import { sendWeeklyMacroSummary } from '@/lib/notifications/macro-summary'
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
    console.log('[jobs/weekly] ===== Starting weekly summary =====')
    
    // Verificar que es domingo (opcional, pero recomendado)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0 = domingo, 6 = sábado
    
    if (dayOfWeek !== 0) {
      console.log(`[jobs/weekly] Not Sunday (day ${dayOfWeek}), skipping weekly summary`)
      return Response.json({
        success: true,
        skipped: true,
        reason: 'Not Sunday',
        message: 'Weekly summary only runs on Sundays',
      })
    }

    // Enviar resumen de calendario de la próxima semana
    await sendWeeklyCalendarSummary()
    console.log('[jobs/weekly] ✅ Calendar summary sent')
    
    // Enviar resumen macroeconómico completo
    await sendWeeklyMacroSummary()
    console.log('[jobs/weekly] ✅ Macro summary sent')
    
    await recordJobSuccess('weekly/summary')
    
    console.log('[jobs/weekly] ===== Weekly summary completed =====')
    
    return Response.json({
      success: true,
      message: 'Weekly summaries sent (calendar + macro)',
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[jobs/weekly] Error:', errorMessage)
    await recordJobError('weekly/summary', errorMessage)
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// Permitir GET además de POST para compatibilidad con cron jobs de Vercel
export async function GET(req: Request) {
  return POST(req)
}
