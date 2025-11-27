/**
 * Script para verificar el estado completo de la configuración
 * Verifica: Telegram, Pipeline de Noticias, GitHub Secrets, Vercel
 * 
 * Uso: pnpm tsx scripts/verificar-estado-completo.ts
 */

const APP_URL = process.env.APP_URL || 'https://macro-dashboard-seven.vercel.app'

interface VerificationResult {
  name: string
  status: 'ok' | 'warning' | 'error' | 'unknown'
  message: string
  details?: string
}

const results: VerificationResult[] = []

function addResult(name: string, status: 'ok' | 'warning' | 'error' | 'unknown', message: string, details?: string) {
  results.push({ name, status, message, details })
}

async function verifyTelegram() {
  console.log('\n📱 Verificando Telegram...')
  
  try {
    const response = await fetch(`${APP_URL}/api/notifications/verify`)
    const data = await response.json()
    
    if (data.telegram?.valid) {
      addResult('Telegram Config', 'ok', 'Telegram está configurado correctamente', 
        `Bot: ${data.telegram.bot_ok ? '✅' : '❌'}, Chat: ${data.telegram.chat_ok ? '✅' : '❌'}`)
    } else {
      addResult('Telegram Config', 'error', 'Telegram no está configurado correctamente', 
        data.telegram?.errors?.join(', ') || 'No se pudo verificar')
    }
    
    if (data.telegram?.warnings?.length > 0) {
      addResult('Telegram Warnings', 'warning', 'Hay advertencias en la configuración de Telegram', 
        data.telegram.warnings.join(', '))
    }
  } catch (error) {
    addResult('Telegram Config', 'error', 'No se pudo verificar Telegram', 
      error instanceof Error ? error.message : String(error))
  }
}

async function verifyIngestKey() {
  console.log('\n🔐 Verificando INGEST_KEY...')
  
  // No podemos verificar directamente sin la clave, pero podemos verificar el endpoint
  try {
    const response = await fetch(`${APP_URL}/api/news/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-INGEST-KEY': 'test-invalid-key',
      },
      body: JSON.stringify({
        id_fuente: 'test',
        fuente: 'test',
        titulo: 'test',
        impacto: 'low',
        published_at: new Date().toISOString(),
      }),
    })
    
    if (response.status === 401 || response.status === 400) {
      const data = await response.json()
      if (data.error?.includes('INGEST_KEY')) {
        addResult('INGEST_KEY', 'ok', 'INGEST_KEY está configurado (endpoint protegido)', 
          'El endpoint rechaza peticiones sin clave válida')
      } else {
        addResult('INGEST_KEY', 'warning', 'No se pudo verificar INGEST_KEY', 
          data.error || 'Respuesta inesperada')
      }
    } else {
      addResult('INGEST_KEY', 'error', 'INGEST_KEY puede no estar configurado', 
        'El endpoint no está rechazando peticiones sin clave')
    }
  } catch (error) {
    addResult('INGEST_KEY', 'unknown', 'No se pudo verificar INGEST_KEY', 
      error instanceof Error ? error.message : String(error))
  }
}

async function verifyNewsEndpoint() {
  console.log('\n📰 Verificando endpoint de noticias...')
  
  try {
    const response = await fetch(`${APP_URL}/api/admin/news/recent`)
    
    if (response.ok) {
      const data = await response.json()
      addResult('News Endpoint', 'ok', 'Endpoint de noticias funciona', 
        `Hay ${Array.isArray(data) ? data.length : 0} noticias recientes`)
    } else {
      addResult('News Endpoint', 'warning', 'Endpoint de noticias tiene problemas', 
        `Status: ${response.status}`)
    }
  } catch (error) {
    addResult('News Endpoint', 'error', 'No se pudo acceder al endpoint de noticias', 
      error instanceof Error ? error.message : String(error))
  }
}

async function verifyCalendarEndpoint() {
  console.log('\n📅 Verificando endpoint de calendario...')
  
  try {
    const response = await fetch(`${APP_URL}/api/admin/calendar/recent`)
    
    if (response.ok) {
      const data = await response.json()
      addResult('Calendar Endpoint', 'ok', 'Endpoint de calendario funciona', 
        `Hay ${Array.isArray(data) ? data.length : 0} eventos recientes`)
    } else {
      addResult('Calendar Endpoint', 'warning', 'Endpoint de calendario tiene problemas', 
        `Status: ${response.status}`)
    }
  } catch (error) {
    addResult('Calendar Endpoint', 'error', 'No se pudo acceder al endpoint de calendario', 
      error instanceof Error ? error.message : String(error))
  }
}

async function verifyGitHubWorkflow() {
  console.log('\n🔄 Verificando GitHub Workflow...')
  
  // No podemos verificar directamente sin acceso a la API de GitHub
  // Pero podemos dar instrucciones
  addResult('GitHub Workflow', 'unknown', 
    'Verifica manualmente en GitHub Actions', 
    'Ve a: https://github.com/CMLL1992/macro-dashboard/actions\n' +
    'Busca: "News & Calendar Ingest"\n' +
    'Verifica que el último run haya sido exitoso')
}

function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE VERIFICACIÓN')
  console.log('='.repeat(60))
  
  const ok = results.filter(r => r.status === 'ok').length
  const warnings = results.filter(r => r.status === 'warning').length
  const errors = results.filter(r => r.status === 'error').length
  const unknown = results.filter(r => r.status === 'unknown').length
  
  console.log(`\n✅ OK: ${ok}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Errores: ${errors}`)
  console.log(`❓ Desconocido: ${unknown}`)
  
  console.log('\n' + '-'.repeat(60))
  console.log('DETALLES:')
  console.log('-'.repeat(60))
  
  for (const result of results) {
    const icon = result.status === 'ok' ? '✅' : 
                 result.status === 'warning' ? '⚠️' : 
                 result.status === 'error' ? '❌' : '❓'
    
    console.log(`\n${icon} ${result.name}`)
    console.log(`   ${result.message}`)
    if (result.details) {
      console.log(`   → ${result.details}`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  
  // Recomendaciones
  if (errors > 0 || warnings > 0) {
    console.log('\n📋 RECOMENDACIONES:')
    console.log('-'.repeat(60))
    
    if (results.some(r => r.name === 'Telegram Config' && r.status === 'error')) {
      console.log('\n1. Para Telegram:')
      console.log('   - Verifica que TELEGRAM_BOT_TOKEN esté en Vercel')
      console.log('   - Verifica que TELEGRAM_CHAT_ID esté en Vercel')
      console.log('   - Verifica que ENABLE_TELEGRAM_NOTIFICATIONS=true')
      console.log('   - Redeploya la aplicación después de añadir variables')
    }
    
    if (results.some(r => r.name === 'INGEST_KEY' && r.status !== 'ok')) {
      console.log('\n2. Para INGEST_KEY:')
      console.log('   - Verifica que INGEST_KEY esté en Vercel')
      console.log('   - Verifica que INGEST_KEY esté en GitHub Secrets')
      console.log('   - Deben ser la MISMA clave en ambos lugares')
    }
    
    if (results.some(r => r.name === 'GitHub Workflow' && r.status === 'unknown')) {
      console.log('\n3. Para GitHub Workflow:')
      console.log('   - Ve a: https://github.com/CMLL1992/macro-dashboard/settings/secrets/actions')
      console.log('   - Verifica que existan: APP_URL, INGEST_KEY, FRED_API_KEY')
      console.log('   - Ve a Actions y verifica que el workflow esté activo')
    }
  }
  
  console.log('\n')
}

async function main() {
  console.log('🔍 Verificando estado completo de CM11 Trading...')
  console.log(`📍 URL: ${APP_URL}`)
  
  await verifyTelegram()
  await verifyIngestKey()
  await verifyNewsEndpoint()
  await verifyCalendarEndpoint()
  await verifyGitHubWorkflow()
  
  printSummary()
}

main().catch(error => {
  console.error('❌ Error durante la verificación:', error)
  process.exit(1)
})





