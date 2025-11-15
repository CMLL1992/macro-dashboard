/**
 * Verify notifications system
 * GET /api/notifications/verify
 * 
 * CAUSA RAÍZ DEL ERROR 500:
 * El endpoint devolvía status 500 cuando había checks fallidos (variables faltantes, etc.),
 * lo cual es incorrecto. Un 500 debe reservarse para errores del servidor, no para
 * problemas de configuración que son esperables.
 * 
 * SOLUCIÓN:
 * - Siempre devolver 200 con información detallada del estado
 * - Solo devolver 500 si hay un error inesperado del servidor
 * - Verificar variables de entorno antes de hacer llamadas externas
 * - Manejo robusto de errores con try-catch en cada sección
 * - Logs claros con prefijo [verifyTelegram] para debugging
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getInitializationStatus, ensureNotificationsInitialized } from '@/lib/notifications/init'
import { getCurrentNarrative } from '@/lib/notifications/narrative'
import { getRecentNewsItems } from '@/lib/notifications/news'
import { getCalendarEvents } from '@/lib/notifications/weekly'
import { getAggregatedMetrics } from '@/lib/notifications/metrics'
import { getDB } from '@/lib/db/schema'

export async function GET() {
  try {
    const results: Record<string, any> = {
      ok: true, // Siempre true a menos que haya error del servidor
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
      },
    }

    // 1. Verificar variables de entorno requeridas PRIMERO
    // Esto evita hacer llamadas a APIs externas si faltan variables críticas
    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'ENABLE_TELEGRAM_NOTIFICATIONS',
    ]
    
    const optionalVars = [
      'TELEGRAM_TEST_CHAT_ID',
      'ENABLE_TELEGRAM_TESTS',
      'TIMEZONE',
      'INGEST_KEY',
      'GLOBAL_RATE_LIMIT_PER_MIN',
    ]
    
    const envVars: Record<string, any> = {}
    const missingRequired: string[] = []
    
    for (const varName of requiredVars) {
      const value = process.env[varName]
      envVars[varName] = {
        status: value ? 'passed' : 'failed',
        configured: !!value,
      }
      if (value) {
        results.summary.passed++
      } else {
        results.summary.failed++
        missingRequired.push(varName)
        console.log(`[verifyTelegram] Missing required env var: ${varName}`)
      }
    }
    
    for (const varName of optionalVars) {
      const value = process.env[varName]
      envVars[varName] = {
        status: value ? 'passed' : 'warning',
        configured: !!value,
      }
      if (!value) {
        results.summary.warnings++
      }
    }
    
    results.checks.environment = {
      status: missingRequired.length === 0 ? 'passed' : 'failed',
      variables: envVars,
      missing_required: missingRequired.length > 0 ? missingRequired : undefined,
    }

    // Si faltan variables críticas, devolver error controlado
    if (missingRequired.length > 0) {
      console.log(`[verifyTelegram] Missing required environment variables: ${missingRequired.join(', ')}`)
      return NextResponse.json({
        ok: false,
        error: 'MISSING_ENV_VAR',
        details: `Missing required environment variables: ${missingRequired.join(', ')}`,
        timestamp: results.timestamp,
        checks: results.checks,
        summary: results.summary,
      }, { status: 400 })
    }

    // 2. Verificar inicialización (solo si tenemos las variables)
    try {
      await ensureNotificationsInitialized()
      const initStatus = getInitializationStatus()
      results.checks.initialization = {
        status: initStatus.initialized ? 'passed' : 'failed',
        initialized: initStatus.initialized,
      }
      if (initStatus.initialized) {
        results.summary.passed++
        console.log('[verifyTelegram] Initialization check: passed')
      } else {
        results.summary.failed++
        console.log('[verifyTelegram] Initialization check: failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Initialization error:', errorMessage)
      results.checks.initialization = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 3. Verificar validación Telegram (solo si tenemos token)
    try {
      const initStatus = getInitializationStatus()
      const validation = initStatus.validation
      if (validation) {
        results.checks.telegram = {
          status: validation.valid ? 'passed' : 'failed',
          bot_ok: validation.bot_ok,
          chat_ok: validation.chat_ok,
          errors: validation.errors,
          warnings: validation.warnings,
          checked_at: validation.checked_at,
        }
        if (validation.valid) {
          results.summary.passed++
          console.log('[verifyTelegram] Telegram validation: passed')
        } else {
          results.summary.failed++
          console.log(`[verifyTelegram] Telegram validation: failed - ${validation.errors.join(', ')}`)
        }
        if (validation.warnings.length > 0) {
          results.summary.warnings += validation.warnings.length
          console.log(`[verifyTelegram] Telegram warnings: ${validation.warnings.join(', ')}`)
        }
      } else {
        results.checks.telegram = {
          status: 'warning',
          message: 'Validation not available',
        }
        results.summary.warnings++
        console.log('[verifyTelegram] Telegram validation: not available')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Telegram validation error:', errorMessage)
      results.checks.telegram = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 4. Verificar tablas de BD
    try {
      const db = getDB()
      const tables = [
        'news_items',
        'narrative_state',
        'macro_calendar',
        'notification_history',
        'weekly_sent',
        'notification_settings',
      ]
      
      const tableStatus: Record<string, any> = {}
      for (const table of tables) {
        try {
          const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
          tableStatus[table] = {
            status: 'passed',
            count: result.count,
          }
          results.summary.passed++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[verifyTelegram] Database table ${table} check failed:`, errorMessage)
          tableStatus[table] = {
            status: 'failed',
            error: errorMessage,
          }
          results.summary.failed++
        }
      }
      results.checks.database = {
        status: Object.values(tableStatus).every((t: any) => t.status === 'passed') ? 'passed' : 'failed',
        tables: tableStatus,
      }
      console.log('[verifyTelegram] Database check completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Database check error:', errorMessage)
      results.checks.database = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 5. Verificar narrativa
    try {
      const narrative = getCurrentNarrative()
      results.checks.narrative = {
        status: 'passed',
        current: narrative,
      }
      results.summary.passed++
      console.log('[verifyTelegram] Narrative check: passed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Narrative check error:', errorMessage)
      results.checks.narrative = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 6. Verificar noticias
    try {
      const news = getRecentNewsItems(5)
      results.checks.news = {
        status: 'passed',
        recent_count: news.length,
        recent: news.slice(0, 3).map(n => ({
          titulo: n.titulo,
          fuente: n.fuente,
          notificado: !!n.notificado_at,
        })),
      }
      results.summary.passed++
      console.log('[verifyTelegram] News check: passed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] News check error:', errorMessage)
      results.checks.news = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 7. Verificar calendario
    try {
      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const events = getCalendarEvents(today, nextWeek)
      results.checks.calendar = {
        status: 'passed',
        upcoming_count: events.length,
        upcoming: events.slice(0, 3).map(e => ({
          fecha: e.fecha,
          evento: e.evento,
          importancia: e.importancia,
        })),
      }
      results.summary.passed++
      console.log('[verifyTelegram] Calendar check: passed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Calendar check error:', errorMessage)
      results.checks.calendar = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // 8. Verificar métricas
    try {
      const metrics = getAggregatedMetrics()
      results.checks.metrics = {
        status: 'passed',
        sent_total: metrics.sent_total,
        failed_total: metrics.failed_total,
        rate_limited_total: metrics.rate_limited_total,
      }
      results.summary.passed++
      console.log('[verifyTelegram] Metrics check: passed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('[verifyTelegram] Metrics check error:', errorMessage)
      results.checks.metrics = {
        status: 'failed',
        error: errorMessage,
      }
      results.summary.failed++
    }

    // Determinar estado general
    // IMPORTANTE: No usar status 500 para checks fallidos, solo para errores del servidor
    const allPassed = results.summary.failed === 0
    results.overall_status = allPassed ? 'passed' : 'failed'

    console.log(`[verifyTelegram] Verification completed: ${allPassed ? 'passed' : 'failed'} (${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings)`)

    // Siempre devolver 200 con información detallada
    // El cliente puede decidir qué hacer basándose en overall_status
    return NextResponse.json(results, { status: 200 })
  } catch (error) {
    // Solo aquí devolvemos 500: error inesperado del servidor
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('[verifyTelegram] Unexpected server error:', errorMessage)
    console.error('[verifyTelegram] Stack trace:', errorStack)
    
    return NextResponse.json({
      ok: false,
      error: 'INTERNAL_SERVER_ERROR',
      details: errorMessage,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}





