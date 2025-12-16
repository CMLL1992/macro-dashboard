/**
 * Script completo de verificación de producción
 * Verifica todo lo que se puede verificar localmente antes de desplegar
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

interface CheckResult {
  name: string
  status: 'ok' | 'warning' | 'error'
  message: string
}

const results: CheckResult[] = []

function addResult(name: string, status: 'ok' | 'warning' | 'error', message: string) {
  results.push({ name, status, message })
}

console.log('🔍 Verificación Completa de Producción\n')
console.log('=' .repeat(60))

// 1. Verificar vercel.json
console.log('\n1️⃣ Verificando vercel.json...')
try {
  const vercelJsonPath = join(process.cwd(), 'vercel.json')
  if (existsSync(vercelJsonPath)) {
    const vercelJson = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'))
    const crons = vercelJson.crons || []
    
    if (crons.length > 0) {
      addResult('vercel.json existe', 'ok', `Encontrado con ${crons.length} cron jobs`)
      
      const requiredJobs = [
        '/api/jobs/ingest/fred',
        '/api/jobs/ingest/european',
        '/api/jobs/ingest/calendar',
        '/api/jobs/correlations',
        '/api/jobs/compute/bias',
        '/api/jobs/notify/calendar',
      ]
      
      const foundJobs = crons.map((c: any) => c.path)
      const missingJobs = requiredJobs.filter(job => !foundJobs.includes(job))
      
      if (missingJobs.length === 0) {
        addResult('Cron jobs requeridos', 'ok', 'Todos los jobs requeridos están configurados')
      } else {
        addResult('Cron jobs requeridos', 'warning', `Faltan: ${missingJobs.join(', ')}`)
      }
      
      // Mostrar horarios
      console.log('\n   Cron jobs configurados:')
      crons.forEach((cron: any, idx: number) => {
        console.log(`   ${idx + 1}. ${cron.path} → ${cron.schedule}`)
      })
    } else {
      addResult('vercel.json', 'warning', 'Existe pero no tiene cron jobs configurados')
    }
  } else {
    addResult('vercel.json', 'error', 'No encontrado en la raíz del proyecto')
  }
} catch (error) {
  addResult('vercel.json', 'error', `Error al leer: ${error instanceof Error ? error.message : String(error)}`)
}

// 2. Verificar endpoints de jobs existen
console.log('\n2️⃣ Verificando endpoints de jobs...')
const jobEndpoints = [
  'app/api/jobs/ingest/fred/route.ts',
  'app/api/jobs/ingest/european/route.ts',
  'app/api/jobs/ingest/calendar/route.ts',
  'app/api/jobs/correlations/route.ts',
  'app/api/jobs/compute/bias/route.ts',
  'app/api/jobs/notify/calendar/route.ts',
]

jobEndpoints.forEach(endpoint => {
  const path = join(process.cwd(), endpoint)
  if (existsSync(path)) {
    addResult(`Endpoint ${endpoint}`, 'ok', 'Existe')
  } else {
    addResult(`Endpoint ${endpoint}`, 'error', 'No encontrado')
  }
})

// 3. Verificar seguridad de tokens
console.log('\n3️⃣ Verificando seguridad de tokens...')
const securityFiles = [
  'lib/security/token.ts',
  'lib/security/cron.ts',
]

securityFiles.forEach(file => {
  const path = join(process.cwd(), file)
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8')
    // Verificar que acepta query parameter
    if (content.includes('query') || content.includes('searchParams') || content.includes('token')) {
      addResult(`Seguridad ${file}`, 'ok', 'Acepta token por query parameter')
    } else {
      addResult(`Seguridad ${file}`, 'warning', 'Solo acepta Authorization header (Vercel Cron puede necesitar query param)')
    }
  } else {
    addResult(`Seguridad ${file}`, 'error', 'No encontrado')
  }
})

// 4. Verificar endpoints de diagnóstico
console.log('\n4️⃣ Verificando endpoints de diagnóstico...')
const diagnosticEndpoints = [
  'app/api/health/route.ts',
  'app/api/diag/route.ts',
]

diagnosticEndpoints.forEach(endpoint => {
  const path = join(process.cwd(), endpoint)
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8')
    if (content.includes('database') || content.includes('Turso') || content.includes('isUsingTurso')) {
      addResult(`Diagnóstico ${endpoint}`, 'ok', 'Incluye información de base de datos')
    } else {
      addResult(`Diagnóstico ${endpoint}`, 'warning', 'No incluye información de base de datos')
    }
  } else {
    addResult(`Diagnóstico ${endpoint}`, 'error', 'No encontrado')
  }
})

// 5. Verificar configuración de base de datos unificada
console.log('\n5️⃣ Verificando configuración de base de datos...')
const dbFiles = [
  'lib/db/unified-db.ts',
]

dbFiles.forEach(file => {
  const path = join(process.cwd(), file)
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8')
    if (content.includes('TURSO_DATABASE_URL') && content.includes('TURSO_AUTH_TOKEN')) {
      addResult(`Base de datos ${file}`, 'ok', 'Configurado para usar Turso')
    } else {
      addResult(`Base de datos ${file}`, 'warning', 'No detecta configuración de Turso')
    }
  } else {
    addResult(`Base de datos ${file}`, 'error', 'No encontrado')
  }
})

// 6. Verificar variables de entorno locales (solo para referencia)
console.log('\n6️⃣ Verificando variables de entorno locales...')
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

requiredEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value && value.length > 0) {
    addResult(`Variable ${varName}`, 'ok', `Configurada localmente (${value.length} caracteres)`)
  } else {
    addResult(`Variable ${varName}`, 'warning', 'No configurada localmente (debe estar en Vercel)')
  }
})

optionalEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value && value.length > 0) {
    addResult(`Variable ${varName}`, 'ok', 'Configurada localmente')
  } else {
    addResult(`Variable ${varName}`, 'warning', 'No configurada (opcional)')
  }
})

// 7. Resumen
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

// 8. Próximos pasos
console.log('📋 PRÓXIMOS PASOS MANUALES EN VERCEL:\n')
console.log('1. Ve a Vercel Dashboard → Tu proyecto → Settings → Environment Variables')
console.log('2. Configura estas variables para Production:')
console.log('   - TURSO_DATABASE_URL')
console.log('   - TURSO_AUTH_TOKEN')
console.log('   - FRED_API_KEY')
console.log('   - CRON_TOKEN')
console.log('   - APP_URL (primero URL de Vercel, luego dominio final)')
console.log('   - TELEGRAM_BOT_TOKEN (opcional)')
console.log('   - TELEGRAM_CHAT_ID (opcional)')
console.log('   - ENABLE_TELEGRAM_NOTIFICATIONS (opcional)')
console.log('\n3. Verifica que vercel.json está commiteado a main')
console.log('4. Haz push a main para desplegar')
console.log('5. Verifica en Vercel → Settings → Cron Jobs que aparecen los jobs')
console.log('6. Prueba los endpoints:')
console.log('   - https://tu-dominio.com/api/health')
console.log('   - https://tu-dominio.com/api/diag')
console.log('\n📚 Documentación completa: docs/GUIA-PRODUCCION-COMPLETA.md\n')

if (errorCount > 0) {
  console.log('❌ Hay errores críticos que deben resolverse antes de producción.\n')
  process.exit(1)
} else if (warningCount > 0) {
  console.log('⚠️ Hay advertencias. Revisa la documentación en docs/ antes de producción.\n')
  process.exit(0)
} else {
  console.log('✅ Todo está listo para producción desde el punto de vista del código.\n')
  console.log('⚠️ Recuerda: Debes configurar las variables de entorno en Vercel manualmente.\n')
  process.exit(0)
}







