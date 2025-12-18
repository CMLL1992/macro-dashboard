/**
 * Script para verificar que el proyecto está configurado correctamente para producción
 * Ejecutar: pnpm tsx scripts/verificar-produccion.ts
 */

const APP_URL = process.env.APP_URL || process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://macro-dashboard-seven.vercel.app'

interface CheckResult {
  name: string
  status: 'ok' | 'warning' | 'error'
  message: string
}

const results: CheckResult[] = []

function addResult(name: string, status: 'ok' | 'warning' | 'error', message: string) {
  results.push({ name, status, message })
}

console.log('🔍 Verificando configuración de producción...\n')
console.log(`📍 URL de producción: ${APP_URL}\n`)

// 1. Verificar variables de entorno críticas
console.log('1️⃣ Verificando variables de entorno...')

const requiredEnvVars = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'FRED_API_KEY',
  'CRON_TOKEN',
]

const optionalEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'ENABLE_TELEGRAM_NOTIFICATIONS',
  'APP_URL',
]

for (const varName of requiredEnvVars) {
  const value = process.env[varName]
  if (value && value.length > 0) {
    addResult(`Variable ${varName}`, 'ok', `Configurada (${value.length} caracteres)`)
  } else {
    addResult(`Variable ${varName}`, 'error', 'NO CONFIGURADA - Crítica para producción')
  }
}

for (const varName of optionalEnvVars) {
  const value = process.env[varName]
  if (value && value.length > 0) {
    addResult(`Variable ${varName}`, 'ok', `Configurada`)
  } else {
    addResult(`Variable ${varName}`, 'warning', 'No configurada (opcional)')
  }
}

// 2. Verificar endpoints de salud
console.log('\n2️⃣ Verificando endpoints de salud...')

async function checkEndpoint(path: string, name: string) {
  try {
    const url = `${APP_URL}${path}`
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
    })
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      addResult(`Endpoint ${name}`, 'ok', `Responde correctamente (${response.status})`)
      return true
    } else {
      addResult(`Endpoint ${name}`, 'error', `Error ${response.status}: ${response.statusText}`)
      return false
    }
  } catch (error) {
    addResult(`Endpoint ${name}`, 'error', `No accesible: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

await checkEndpoint('/api/health', 'Health Check')
await checkEndpoint('/api/diag', 'Diagnóstico')

// 3. Verificar base de datos
console.log('\n3️⃣ Verificando configuración de base de datos...')

const hasTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
if (hasTurso) {
  addResult('Base de datos', 'ok', 'Turso configurado (usará Turso en producción)')
} else {
  addResult('Base de datos', 'error', 'Turso NO configurado - Usará SQLite local (no persistente)')
}

// 4. Verificar cron jobs en vercel.json
console.log('\n4️⃣ Verificando cron jobs...')

try {
  const fs = await import('fs')
  const path = await import('path')
  const vercelJsonPath = path.join(process.cwd(), 'vercel.json')
  
  if (fs.existsSync(vercelJsonPath)) {
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'))
    const crons = vercelJson.crons || []
    
    if (crons.length > 0) {
      addResult('Cron jobs', 'ok', `${crons.length} cron jobs configurados en vercel.json`)
      crons.forEach((cron: any, idx: number) => {
        addResult(`  Cron ${idx + 1}`, 'ok', `${cron.path} - ${cron.schedule}`)
      })
    } else {
      addResult('Cron jobs', 'warning', 'No hay cron jobs configurados en vercel.json')
    }
  } else {
    addResult('Cron jobs', 'warning', 'vercel.json no encontrado - Configurar cron jobs manualmente en Vercel Dashboard')
  }
} catch (error) {
  addResult('Cron jobs', 'warning', `No se pudo verificar: ${error instanceof Error ? error.message : String(error)}`)
}

// 5. Resumen
console.log('\n' + '='.repeat(60))
console.log('📊 RESUMEN DE VERIFICACIÓN')
console.log('='.repeat(60) + '\n')

const okCount = results.filter(r => r.status === 'ok').length
const warningCount = results.filter(r => r.status === 'warning').length
const errorCount = results.filter(r => r.status === 'error').length

results.forEach(result => {
  const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
  const color = result.status === 'ok' ? '\x1b[32m' : result.status === 'warning' ? '\x1b[33m' : '\x1b[31m'
  const reset = '\x1b[0m'
  console.log(`${color}${icon} ${result.name}${reset}: ${result.message}`)
})

console.log('\n' + '='.repeat(60))
console.log(`✅ Correctos: ${okCount} | ⚠️ Advertencias: ${warningCount} | ❌ Errores: ${errorCount}`)
console.log('='.repeat(60) + '\n')

if (errorCount > 0) {
  console.log('❌ Hay errores críticos que deben resolverse antes de producción.')
  console.log('   Revisa la documentación en docs/CHECKLIST-PRODUCCION.md\n')
  process.exit(1)
} else if (warningCount > 0) {
  console.log('⚠️ Hay advertencias. Revisa la documentación en docs/CHECKLIST-PRODUCCION.md\n')
  process.exit(0)
} else {
  console.log('✅ Todo está configurado correctamente para producción!\n')
  process.exit(0)
}











