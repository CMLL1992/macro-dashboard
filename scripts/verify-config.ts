/**
 * Script para verificar la configuración de variables de entorno
 * Compara valores entre lo esperado y lo configurado
 */

const REQUIRED_VARS = {
  APP_URL: 'https://macro-dashboard-seven.vercel.app',
  CRON_TOKEN: 'cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82',
  INGEST_KEY: 'cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82',
  FRED_API_KEY: 'ccc90330e6a50afa217fb55ac48c4d28',
}

const OPTIONAL_VARS = {
  FMP_API_KEY: 'Opcional - Financial Modeling Prep',
  FINNHUB_API_KEY: 'Opcional - Finnhub',
  NEWSAPI_KEY: 'Opcional - NewsAPI',
  TRADING_ECONOMICS_API_KEY: 'Opcional - Trading Economics',
}

async function verifyAPIEndpoint(url: string, token: string, endpoint: string, tokenHeader: string = 'Authorization'): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (tokenHeader === 'Authorization') {
      headers['Authorization'] = `Bearer ${token}`
    } else {
      headers[tokenHeader] = token
    }

    const response = await fetch(`${url}${endpoint}`, {
      method: 'GET',
      headers,
    })

    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? 'OK' : await response.text().catch(() => 'Unknown error'),
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  console.log('🔍 Verificando configuración...\n')
  console.log('='.repeat(60))
  console.log('📋 VARIABLES REQUERIDAS')
  console.log('='.repeat(60))

  const issues: string[] = []

  for (const [key, expectedValue] of Object.entries(REQUIRED_VARS)) {
    const actualValue = process.env[key]
    const isSet = !!actualValue
    const matches = actualValue === expectedValue

    if (!isSet) {
      console.log(`❌ ${key}: NO CONFIGURADA`)
      issues.push(`${key} no está configurada`)
    } else if (!matches) {
      console.log(`⚠️  ${key}: CONFIGURADA PERO VALOR DIFERENTE`)
      console.log(`   Esperado: ${expectedValue.slice(0, 20)}...`)
      console.log(`   Actual:   ${actualValue.slice(0, 20)}...`)
      issues.push(`${key} tiene un valor diferente al esperado`)
    } else {
      console.log(`✅ ${key}: OK`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📋 VARIABLES OPCIONALES')
  console.log('='.repeat(60))

  for (const [key, description] of Object.entries(OPTIONAL_VARS)) {
    const isSet = !!process.env[key]
    if (isSet) {
      console.log(`✅ ${key}: Configurada`)
    } else {
      console.log(`⏭️  ${key}: No configurada (${description})`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('🌐 VERIFICANDO ENDPOINTS DE API')
  console.log('='.repeat(60))

  const APP_URL = process.env.APP_URL || REQUIRED_VARS.APP_URL
  const CRON_TOKEN = process.env.CRON_TOKEN || REQUIRED_VARS.CRON_TOKEN
  const INGEST_KEY = process.env.INGEST_KEY || REQUIRED_VARS.INGEST_KEY

  // Verificar /api/health
  console.log('\n📊 Verificando /api/health...')
  const healthResult = await verifyAPIEndpoint(APP_URL, '', '/api/health', '')
  if (healthResult.ok) {
    try {
      const healthData = await fetch(`${APP_URL}/api/health`).then(r => r.json())
      console.log(`✅ /api/health: OK`)
      console.log(`   Observaciones macro: ${healthData.observationCount || 0}`)
      console.log(`   Bias registros: ${healthData.biasCount || 0}`)
      console.log(`   Correlaciones: ${healthData.correlationCount || 0}`)
      console.log(`   Última fecha: ${healthData.latestDate || 'N/A'}`)
    } catch (e) {
      console.log(`✅ /api/health: OK (pero no se pudo parsear JSON)`)
    }
  } else {
    console.log(`❌ /api/health: ${healthResult.status} - ${healthResult.message}`)
    issues.push(`/api/health no responde correctamente`)
  }

  // Verificar /api/jobs/ingest/fred (requiere CRON_TOKEN)
  console.log('\n📊 Verificando /api/jobs/ingest/fred (solo verificación de autenticación)...')
  const fredResult = await verifyAPIEndpoint(APP_URL, CRON_TOKEN, '/api/jobs/ingest/fred')
  if (fredResult.ok || fredResult.status === 405) { // 405 = Method Not Allowed (esperado para GET)
    console.log(`✅ /api/jobs/ingest/fred: Autenticación OK`)
  } else if (fredResult.status === 401) {
    console.log(`❌ /api/jobs/ingest/fred: 401 Unauthorized - CRON_TOKEN incorrecto`)
    issues.push(`CRON_TOKEN no es válido para /api/jobs/ingest/fred`)
  } else {
    console.log(`⚠️  /api/jobs/ingest/fred: ${fredResult.status} - ${healthResult.message}`)
  }

  // Verificar /api/news/insert (requiere INGEST_KEY)
  console.log('\n📊 Verificando /api/news/insert (solo verificación de autenticación)...')
  const newsResult = await verifyAPIEndpoint(APP_URL, INGEST_KEY, '/api/news/insert', 'X-INGEST-KEY')
  if (newsResult.ok || newsResult.status === 400 || newsResult.status === 405) { // 400/405 = esperado para GET sin body
    console.log(`✅ /api/news/insert: Autenticación OK`)
  } else if (newsResult.status === 401 || newsResult.status === 403) {
    console.log(`❌ /api/news/insert: ${newsResult.status} - INGEST_KEY incorrecto`)
    issues.push(`INGEST_KEY no es válido para /api/news/insert`)
  } else {
    console.log(`⚠️  /api/news/insert: ${newsResult.status} - ${newsResult.message}`)
  }

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN')
  console.log('='.repeat(60))

  if (issues.length === 0) {
    console.log('✅ Configuración correcta - No se encontraron problemas')
  } else {
    console.log(`❌ Se encontraron ${issues.length} problema(s):`)
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`)
    })
    console.log('\n⚠️  Revisa las variables de entorno en:')
    console.log('   - Vercel: Settings → Environment Variables')
    console.log('   - GitHub: Settings → Secrets and variables → Actions')
  }

  console.log('\n' + '='.repeat(60))
}

main().catch(error => {
  console.error('\n❌ Error fatal:', error)
  process.exit(1)
})

