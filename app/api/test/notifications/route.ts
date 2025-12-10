/**
 * Endpoint de prueba para todas las notificaciones
 * POST /api/test/notifications
 * 
 * Ejecuta todas las pruebas de notificaciones directamente
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { assertCronAuth } from '@/lib/security/cron'
import { sendTelegramMessage } from '@/lib/notifications/telegram'
import { sendDailyCalendarWithScenarios } from '@/lib/notifications/daily-calendar'
import { sendWeeklyCalendarSummary } from '@/lib/notifications/calendar'
import { sendWeeklyMacroSummary } from '@/lib/notifications/macro-summary'
import { notifyNewCalendarEvents } from '@/lib/notifications/calendar'
import { notifyConfidenceChanges } from '@/lib/notifications/confidence'
import { notifyDataChanges } from '@/lib/notifications/data-changes'
import { notifyScenarioChanges } from '@/lib/notifications/scenarios'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

  const results: Array<{ name: string; success: boolean; error?: string }> = []

  try {
    console.log('[test/notifications] ===== Starting notification tests =====')

    // Test 1: Mensaje básico
    console.log('[test/notifications] Test 1: Mensaje básico')
    try {
      const result = await sendTelegramMessage(
        '🧪 *Test 1: Mensaje Básico*\n\n' +
        'Este es un mensaje de prueba para verificar que Telegram está configurado correctamente.',
        { noParseMode: false }
      )
      results.push({ name: 'Mensaje básico', success: result.success, error: result.error })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Mensaje básico', success: false, error: String(error) })
    }

    // Test 2: Nuevos eventos
    console.log('[test/notifications] Test 2: Nuevos eventos calendario')
    try {
      await notifyNewCalendarEvents([
        {
          name: 'Inflación EEUU (CPI YoY)',
          currency: 'USD',
          country: 'Estados Unidos',
          importance: 'high',
          scheduled_time_utc: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          consensus_value: 3.2,
          previous_value: 3.1,
        },
        {
          name: 'PMI Manufacturero Eurozona',
          currency: 'EUR',
          country: 'Eurozona',
          importance: 'medium',
          scheduled_time_utc: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          consensus_value: 48.5,
          previous_value: 47.8,
        },
      ])
      results.push({ name: 'Nuevos eventos calendario', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Nuevos eventos calendario', success: false, error: String(error) })
    }

    // Test 3: Calendario diario
    console.log('[test/notifications] Test 3: Calendario diario')
    try {
      await sendDailyCalendarWithScenarios()
      results.push({ name: 'Calendario diario con escenarios', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Calendario diario con escenarios', success: false, error: String(error) })
    }

    // Test 4: Resumen semanal calendario
    console.log('[test/notifications] Test 4: Resumen semanal calendario')
    try {
      await sendWeeklyCalendarSummary()
      results.push({ name: 'Resumen semanal calendario', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Resumen semanal calendario', success: false, error: String(error) })
    }

    // Test 5: Resumen macro
    console.log('[test/notifications] Test 5: Resumen macroeconómico')
    try {
      await sendWeeklyMacroSummary()
      results.push({ name: 'Resumen macroeconómico semanal', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Resumen macroeconómico semanal', success: false, error: String(error) })
    }

    // Test 6: Cambios de confianza
    console.log('[test/notifications] Test 6: Cambios de confianza')
    try {
      await notifyConfidenceChanges([
        {
          pair: 'EURUSD',
          oldConfidence: 'Media',
          newConfidence: 'Alta',
          action: 'Buscar compras',
          trend: 'Alcista',
        },
        {
          pair: 'GBPUSD',
          oldConfidence: 'Alta',
          newConfidence: 'Media',
          action: 'Rango/táctico',
          trend: 'Lateral',
        },
      ])
      results.push({ name: 'Cambios de confianza en pares', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Cambios de confianza en pares', success: false, error: String(error) })
    }

    // Test 7: Cambios de datos
    console.log('[test/notifications] Test 7: Cambios de datos macro')
    try {
      await notifyDataChanges([
        {
          key: 'cpi_yoy',
          label: 'Inflación EEUU (CPI YoY)',
          currency: 'USD',
          oldValue: 3.1,
          newValue: 3.4,
          date: new Date().toISOString().split('T')[0],
          change: 0.3,
          changePercent: 9.68,
        },
        {
          key: 'unrate',
          label: 'Tasa de Desempleo EEUU',
          currency: 'USD',
          oldValue: 3.8,
          newValue: 3.6,
          date: new Date().toISOString().split('T')[0],
          change: -0.2,
          changePercent: -5.26,
        },
      ])
      results.push({ name: 'Cambios de datos macro', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Cambios de datos macro', success: false, error: String(error) })
    }

    // Test 8: Cambios de escenarios
    console.log('[test/notifications] Test 8: Cambios de escenarios')
    try {
      await notifyScenarioChanges([
        {
          type: 'new',
          scenario: {
            id: 'test-1',
            title: 'EURUSD - Sesgo Alcista por Fortaleza USD',
            pair: 'EURUSD',
            direction: 'BUY',
            confidence: 'Alta',
            macroReasons: ['USD fuerte', 'Correlación positiva'],
            setupRecommendation: 'Buscar entradas en correcciones',
          },
        },
        {
          type: 'changed',
          scenario: {
            id: 'test-2',
            title: 'GBPUSD - Cambio de Confianza',
            pair: 'GBPUSD',
            direction: 'SELL',
            confidence: 'Media',
          },
          oldConfidence: 'Alta',
        },
      ])
      results.push({ name: 'Cambios de escenarios', success: true })
      await sleep(2000)
    } catch (error) {
      results.push({ name: 'Cambios de escenarios', success: false, error: String(error) })
    }

    // Test 9: Release publicado
    console.log('[test/notifications] Test 9: Release publicado')
    try {
      const releaseMessage = `🔴 *Test: Inflación EEUU (CPI YoY)* (USD)\n\n` +
        `📊 *Dato Publicado*\n` +
        `   Valor: *3.4*\n` +
        `   Consenso: 3.2\n` +
        `   Anterior: 3.1\n\n` +
        `📈 *Sorpresa Positiva*\n` +
        `   Diferencia: +0.20%\n` +
        `   Score: 0.75\n\n` +
        `💡 *Impacto Esperado*\n` +
        `   Favorable para USD → Presión alcista\n\n` +
        `📈 *Pares Afectados*\n` +
        `   EURUSD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCAD, USDCHF, XAUUSD\n\n` +
        `🕐 ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`

      const result = await sendTelegramMessage(releaseMessage, { noParseMode: false })
      results.push({ name: 'Release publicado', success: result.success, error: result.error })
    } catch (error) {
      results.push({ name: 'Release publicado', success: false, error: String(error) })
    }

    const passed = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    // Enviar resumen final
    let summaryMessage = '📊 *Resumen de Pruebas de Notificaciones*\n\n'
    results.forEach(result => {
      const icon = result.success ? '✅' : '❌'
      summaryMessage += `${icon} ${result.name}\n`
      if (result.error && !result.success) {
        summaryMessage += `   Error: ${result.error}\n`
      }
      summaryMessage += '\n'
    })
    summaryMessage += `\n✅ Exitosos: ${passed}/${results.length}\n`
    summaryMessage += `❌ Fallidos: ${failed}/${results.length}\n\n`

    if (failed === 0) {
      summaryMessage += '🎉 ¡Todas las pruebas pasaron!'
    } else {
      summaryMessage += '⚠️  Algunas pruebas fallaron. Revisa la configuración.'
    }

    await sendTelegramMessage(summaryMessage, { noParseMode: false })

    console.log('[test/notifications] ===== Tests completed =====')
    console.log(`Passed: ${passed}/${results.length}, Failed: ${failed}/${results.length}`)

    return Response.json({
      success: failed === 0,
      results,
      summary: {
        passed,
        failed,
        total: results.length,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[test/notifications] Fatal error:', errorMessage)
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

