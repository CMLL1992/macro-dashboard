/**
 * Verify notifications system
 * GET /api/notifications/verify
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getInitializationStatus, ensureNotificationsInitialized } from '@/lib/notifications/init'
import { getCurrentNarrative } from '@/lib/notifications/narrative'
import { getRecentNewsItems } from '@/lib/notifications/news'
import { getCalendarEvents } from '@/lib/notifications/weekly'
import { getAggregatedMetrics } from '@/lib/notifications/metrics'
import { getUnifiedDB } from '@/lib/db/unified-db'

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    checks: {},
    summary: {
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  }

  // 1. Verificar inicialización
  try {
    await ensureNotificationsInitialized()
    const initStatus = getInitializationStatus()
    results.checks.initialization = {
      status: initStatus.initialized ? 'passed' : 'failed',
      initialized: initStatus.initialized,
    }
    if (initStatus.initialized) results.summary.passed++
    else results.summary.failed++
  } catch (error) {
    results.checks.initialization = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 2. Verificar validación Telegram
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
      if (validation.valid) results.summary.passed++
      else results.summary.failed++
      if (validation.warnings.length > 0) results.summary.warnings += validation.warnings.length
    } else {
      results.checks.telegram = {
        status: 'warning',
        message: 'Validation not available',
      }
      results.summary.warnings++
    }
  } catch (error) {
    results.checks.telegram = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 3. Verificar tablas de BD
  try {
    const db = getUnifiedDB()
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
        // All methods are async now, so always use await
        const result = await db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        tableStatus[table] = {
          status: 'passed',
          count: result.count,
        }
        results.summary.passed++
      } catch (error) {
        tableStatus[table] = {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }
        results.summary.failed++
      }
    }
    results.checks.database = {
      status: Object.values(tableStatus).every((t: any) => t.status === 'passed') ? 'passed' : 'failed',
      tables: tableStatus,
    }
  } catch (error) {
    results.checks.database = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 4. Verificar narrativa
  try {
    const narrative = await getCurrentNarrative()
    results.checks.narrative = {
      status: 'passed',
      current: narrative,
    }
    results.summary.passed++
  } catch (error) {
    results.checks.narrative = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 5. Verificar noticias
  try {
    const news = await getRecentNewsItems(5)
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
  } catch (error) {
    results.checks.news = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 6. Verificar calendario
  try {
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const events = await getCalendarEvents(today, nextWeek)
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
  } catch (error) {
    results.checks.calendar = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 7. Verificar métricas
  try {
    const metrics = await getAggregatedMetrics()
    results.checks.metrics = {
      status: 'passed',
      sent_total: metrics.sent_total,
      failed_total: metrics.failed_total,
      rate_limited_total: metrics.rate_limited_total,
    }
    results.summary.passed++
  } catch (error) {
    results.checks.metrics = {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
    results.summary.failed++
  }

  // 8. Verificar variables de entorno
  const envVars: Record<string, any> = {}
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
  
  for (const varName of requiredVars) {
    const value = process.env[varName]
    envVars[varName] = {
      status: value ? 'passed' : 'failed',
      configured: !!value,
    }
    if (value) results.summary.passed++
    else results.summary.failed++
  }
  
  for (const varName of optionalVars) {
    const value = process.env[varName]
    envVars[varName] = {
      status: value ? 'passed' : 'warning',
      configured: !!value,
    }
    if (!value) results.summary.warnings++
  }
  
  results.checks.environment = {
    status: requiredVars.every(v => process.env[v]) ? 'passed' : 'failed',
    variables: envVars,
  }

  // Determinar estado general
  const allPassed = results.summary.failed === 0
  results.overall_status = allPassed ? 'passed' : 'failed'

  return NextResponse.json(results, {
    status: allPassed ? 200 : 500,
  })
}





