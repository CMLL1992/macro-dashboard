/**
 * Script de pruebas completo para todas las notificaciones de Telegram
 * Ejecuta todos los escenarios posibles para verificar que todo funciona
 */

import { sendTelegramMessage } from '../lib/notifications/telegram'
import { sendDailyCalendarWithScenarios } from '../lib/notifications/daily-calendar'
import { sendWeeklyCalendarSummary } from '../lib/notifications/calendar'
import { sendWeeklyMacroSummary } from '../lib/notifications/macro-summary'
import { notifyNewCalendarEvents } from '../lib/notifications/calendar'
import { notifyConfidenceChanges } from '../lib/notifications/confidence'
import { notifyDataChanges } from '../lib/notifications/data-changes'
import { notifyScenarioChanges } from '../lib/notifications/scenarios'

const CRON_TOKEN = process.env.CRON_TOKEN || 'test-token'

async function testBasicTelegram() {
  console.log('\n🧪 Test 1: Mensaje básico de Telegram')
  try {
    const result = await sendTelegramMessage(
      '🧪 *Test de Notificaciones*\n\n' +
      'Este es un mensaje de prueba para verificar que Telegram está configurado correctamente.',
      { noParseMode: false }
    )
    if (result.success) {
      console.log('✅ Mensaje básico enviado correctamente')
      return true
    } else {
      console.error('❌ Error:', result.error, result.details)
      return false
    }
  } catch (error) {
    console.error('❌ Excepción:', error)
    return false
  }
}

async function testNewCalendarEvents() {
  console.log('\n🧪 Test 2: Nuevos eventos de calendario')
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
    console.log('✅ Notificación de nuevos eventos enviada')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testDailyCalendar() {
  console.log('\n🧪 Test 3: Calendario diario con escenarios')
  try {
    await sendDailyCalendarWithScenarios()
    console.log('✅ Calendario diario enviado')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testWeeklyCalendar() {
  console.log('\n🧪 Test 4: Resumen semanal de calendario')
  try {
    await sendWeeklyCalendarSummary()
    console.log('✅ Resumen semanal de calendario enviado')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testWeeklyMacro() {
  console.log('\n🧪 Test 5: Resumen macroeconómico semanal')
  try {
    await sendWeeklyMacroSummary()
    console.log('✅ Resumen macroeconómico enviado')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testConfidenceChanges() {
  console.log('\n🧪 Test 6: Cambios de confianza en pares')
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
    console.log('✅ Notificación de cambios de confianza enviada')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testDataChanges() {
  console.log('\n🧪 Test 7: Cambios de datos macro')
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
    console.log('✅ Notificación de cambios de datos enviada')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testScenarioChanges() {
  console.log('\n🧪 Test 8: Cambios de escenarios')
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
    console.log('✅ Notificación de cambios de escenarios enviada')
    return true
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function testReleaseNotification() {
  console.log('\n🧪 Test 9: Notificación de release publicado')
  try {
    const releaseMessage = `🔴 *Inflación EEUU (CPI YoY)* (USD)\n\n` +
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
    if (result.success) {
      console.log('✅ Notificación de release enviada')
      return true
    } else {
      console.error('❌ Error:', result.error)
      return false
    }
  } catch (error) {
    console.error('❌ Error:', error)
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Iniciando pruebas completas de notificaciones Telegram\n')
  console.log('='.repeat(60))

  const results: Array<{ name: string; success: boolean }> = []

  // Test 1: Mensaje básico
  results.push({ name: 'Mensaje básico', success: await testBasicTelegram() })
  await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos entre mensajes

  // Test 2: Nuevos eventos
  results.push({ name: 'Nuevos eventos calendario', success: await testNewCalendarEvents() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 3: Calendario diario
  results.push({ name: 'Calendario diario', success: await testDailyCalendar() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 4: Resumen semanal calendario
  results.push({ name: 'Resumen semanal calendario', success: await testWeeklyCalendar() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 5: Resumen macro
  results.push({ name: 'Resumen macroeconómico', success: await testWeeklyMacro() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 6: Cambios de confianza
  results.push({ name: 'Cambios de confianza', success: await testConfidenceChanges() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 7: Cambios de datos
  results.push({ name: 'Cambios de datos macro', success: await testDataChanges() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 8: Cambios de escenarios
  results.push({ name: 'Cambios de escenarios', success: await testScenarioChanges() })
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Test 9: Release publicado
  results.push({ name: 'Release publicado', success: await testReleaseNotification() })

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 RESUMEN DE PRUEBAS\n')
  
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  results.forEach(result => {
    const icon = result.success ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
  })

  console.log(`\n✅ Exitosos: ${passed}/${results.length}`)
  console.log(`❌ Fallidos: ${failed}/${results.length}`)

  if (failed === 0) {
    console.log('\n🎉 ¡Todas las pruebas pasaron!')
  } else {
    console.log('\n⚠️  Algunas pruebas fallaron. Revisa la configuración de Telegram.')
  }

  return failed === 0
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Error fatal:', error)
      process.exit(1)
    })
}

export { runAllTests }

