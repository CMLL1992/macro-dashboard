/**
 * Script para verificar que el sistema de notificaciones funciona correctamente
 * Ejecutar: tsx scripts/verify-notifications.ts
 */

import { getDB } from '../lib/db/schema'
import { getInitializationStatus, ensureNotificationsInitialized } from '../lib/notifications/init'
import { getCurrentNarrative } from '../lib/notifications/narrative'
import { getRecentNewsItems } from '../lib/notifications/news'
import { getCalendarEvents } from '../lib/notifications/weekly'
import { getAggregatedMetrics } from '../lib/notifications/metrics'

async function main() {
  console.log('🔍 Verificando sistema de notificaciones...\n')

  // 1. Verificar inicialización
  console.log('1️⃣ Verificando inicialización...')
  await ensureNotificationsInitialized()
  const initStatus = getInitializationStatus()
  
  if (initStatus.initialized) {
    console.log('   ✅ Sistema inicializado')
  } else {
    console.log('   ❌ Sistema NO inicializado')
    return
  }

  // 2. Verificar validación
  console.log('\n2️⃣ Verificando configuración Telegram...')
  const validation = initStatus.validation
  if (validation) {
    console.log(`   Bot OK: ${validation.bot_ok ? '✅' : '❌'}`)
    console.log(`   Chat OK: ${validation.chat_ok ? '✅' : '❌'}`)
    console.log(`   Validación: ${validation.valid ? '✅' : '❌'}`)
    
    if (validation.errors.length > 0) {
      console.log('   Errores:')
      validation.errors.forEach(err => console.log(`     - ${err}`))
    }
    
    if (validation.warnings.length > 0) {
      console.log('   Advertencias:')
      validation.warnings.forEach(warn => console.log(`     - ${warn}`))
    }
  } else {
    console.log('   ⚠️ Validación no disponible')
  }

  // 3. Verificar base de datos
  console.log('\n3️⃣ Verificando tablas de base de datos...')
  const db = getDB()
  
  const tables = [
    'news_items',
    'narrative_state',
    'macro_calendar',
    'notification_history',
    'weekly_sent',
    'notification_settings'
  ]
  
  for (const table of tables) {
    try {
      const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
      console.log(`   ✅ ${table}: ${result.count} registros`)
    } catch (error) {
      console.log(`   ❌ ${table}: Error - ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 4. Verificar narrativa actual
  console.log('\n4️⃣ Verificando narrativa...')
  try {
    const narrative = getCurrentNarrative()
    console.log(`   ✅ Narrativa actual: ${narrative}`)
  } catch (error) {
    console.log(`   ❌ Error obteniendo narrativa: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 5. Verificar noticias recientes
  console.log('\n5️⃣ Verificando noticias...')
  try {
    const news = getRecentNewsItems(5)
    console.log(`   ✅ Noticias recientes: ${news.length}`)
    if (news.length > 0) {
      console.log('   Últimas noticias:')
      news.slice(0, 3).forEach(n => {
        console.log(`     - ${n.titulo} (${n.fuente}) - ${n.notificado_at ? '✅ Notificado' : '⏳ Pendiente'}`)
      })
    }
  } catch (error) {
    console.log(`   ❌ Error obteniendo noticias: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 6. Verificar eventos calendario
  console.log('\n6️⃣ Verificando calendario...')
  try {
    const today = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const events = getCalendarEvents(today, nextWeek)
    console.log(`   ✅ Eventos próximos 7 días: ${events.length}`)
    if (events.length > 0) {
      console.log('   Próximos eventos:')
      events.slice(0, 3).forEach(e => {
        console.log(`     - ${e.fecha} ${e.hora_local || ''}: ${e.evento} (${e.importancia})`)
      })
    }
  } catch (error) {
    console.log(`   ❌ Error obteniendo calendario: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 7. Verificar métricas
  console.log('\n7️⃣ Verificando métricas...')
  try {
    const metrics = getAggregatedMetrics()
    console.log(`   ✅ Métricas disponibles:`)
    console.log(`     - Enviados: ${metrics.sent_total}`)
    console.log(`     - Fallidos: ${metrics.failed_total}`)
    console.log(`     - Rate limited: ${metrics.rate_limited_total}`)
  } catch (error) {
    console.log(`   ❌ Error obteniendo métricas: ${error instanceof Error ? error.message : String(error)}`)
  }

  // 8. Verificar variables de entorno
  console.log('\n8️⃣ Verificando variables de entorno...')
  const requiredVars = [
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'ENABLE_TELEGRAM_NOTIFICATIONS'
  ]
  
  const optionalVars = [
    'TELEGRAM_TEST_CHAT_ID',
    'ENABLE_TELEGRAM_TESTS',
    'TIMEZONE',
    'INGEST_KEY'
  ]
  
  console.log('   Variables requeridas:')
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      const masked = varName.includes('TOKEN') || varName.includes('KEY') || varName.includes('CHAT_ID')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value
      console.log(`     ✅ ${varName}: ${masked}`)
    } else {
      console.log(`     ❌ ${varName}: NO CONFIGURADA`)
    }
  }
  
  console.log('   Variables opcionales:')
  for (const varName of optionalVars) {
    const value = process.env[varName]
    if (value) {
      const masked = varName.includes('TOKEN') || varName.includes('KEY') || varName.includes('CHAT_ID')
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value
      console.log(`     ✅ ${varName}: ${masked}`)
    } else {
      console.log(`     ⚠️ ${varName}: no configurada (opcional)`)
    }
  }

  console.log('\n✅ Verificación completada')
}

main().catch(error => {
  console.error('❌ Error en verificación:', error)
  process.exit(1)
})



