/**
 * Script para probar el job de actualización del calendario
 * Usa el CRON_TOKEN proporcionado para autenticar la llamada
 * 
 * Uso:
 *   CRON_TOKEN=tu_token APP_URL=https://tu-app.com pnpm tsx scripts/test-calendar-job.ts
 */

const CRON_TOKEN = process.env.CRON_TOKEN || 'cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82'
const APP_URL_VAR = process.env.APP_URL || 'http://localhost:3000'

async function testCalendarJob() {
  console.log('🚀 Probando job de actualización del calendario...\n')
  console.log(`📌 APP_URL: ${APP_URL_VAR}`)
  console.log(`📌 CRON_TOKEN: ${CRON_TOKEN.substring(0, 8)}...\n`)

  try {
    const url = `${APP_URL_VAR}/api/jobs/calendar/update`
    console.log(`📡 Llamando a: ${url}\n`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Job ejecutado correctamente:\n')
      console.log(JSON.stringify(data, null, 2))
      
      if (data.success) {
        console.log(`\n📊 Resumen:`)
        console.log(`   - Insertados: ${data.inserted || 0}`)
        console.log(`   - Actualizados: ${data.updated || 0}`)
        console.log(`   - Total eventos: ${data.total || 0}`)
        console.log(`   - Duración: ${data.duration_ms || 0}ms`)
      }
    } else {
      console.error('❌ Error en la respuesta:')
      console.error(JSON.stringify(data, null, 2))
      
      if (response.status === 401) {
        console.error('\n⚠️  Error 401: CRON_TOKEN incorrecto o no autorizado')
        console.error('   Verifica que el CRON_TOKEN sea correcto')
      }
    }
  } catch (error) {
    console.error('❌ Error al ejecutar el job:')
    console.error(error instanceof Error ? error.message : String(error))
    
    if (error instanceof Error && error.message.includes('fetch')) {
      console.error('\n⚠️  No se pudo conectar al servidor')
      console.error('   Verifica que APP_URL sea correcto y que el servidor esté corriendo')
    }
  }
}

testCalendarJob()
