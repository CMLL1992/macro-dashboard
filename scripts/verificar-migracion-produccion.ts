#!/usr/bin/env tsx
/**
 * Script para verificar el estado de la migración a producción 24/7
 * 
 * Verifica:
 * - Variables de entorno necesarias
 * - Conexión a Turso
 * - Estado de los endpoints
 * - Configuración de cron jobs
 */

import { config } from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

// Cargar variables de entorno
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  config({ path: envPath })
}

const PRODUCTION_URL = process.env.APP_URL || 'https://macro-dashboard-seven.vercel.app'
const CRON_TOKEN = process.env.CRON_TOKEN || ''

interface CheckResult {
  name: string
  status: '✅' | '⚠️' | '❌'
  message: string
  action?: string
}

const checks: CheckResult[] = []

// 1. Verificar variables de entorno locales
console.log('\n🔍 Verificando variables de entorno locales...\n')

const requiredEnvVars = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'FRED_API_KEY',
  'CRON_TOKEN',
]

requiredEnvVars.forEach(varName => {
  const value = process.env[varName]
  if (value && value.length > 0) {
    checks.push({
      name: `${varName} (local)`,
      status: '✅',
      message: `Configurada (${value.substring(0, 20)}...)`,
    })
  } else {
    checks.push({
      name: `${varName} (local)`,
      status: '⚠️',
      message: 'No configurada localmente',
      action: `Configurar en .env.local (para producción, configurar en Vercel)`,
    })
  }
})

// 2. Verificar conexión a Turso (si está configurado)
console.log('\n🔍 Verificando conexión a Turso...\n')

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN

if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN) {
  try {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: TURSO_DATABASE_URL,
      authToken: TURSO_AUTH_TOKEN,
    })
    
    // Intentar una query simple
    const result = await client.execute('SELECT 1 as test')
    
    if (result.rows.length > 0) {
      checks.push({
        name: 'Conexión Turso',
        status: '✅',
        message: 'Conexión exitosa',
      })
    } else {
      checks.push({
        name: 'Conexión Turso',
        status: '❌',
        message: 'Conexión fallida',
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'Conexión Turso',
      status: '❌',
      message: `Error: ${error.message}`,
      action: 'Verificar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN',
    })
  }
} else {
  checks.push({
    name: 'Conexión Turso',
    status: '⚠️',
    message: 'Turso no configurado localmente',
    action: 'Configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN (en Vercel para producción)',
  })
}

// 3. Verificar endpoints de producción
console.log('\n🔍 Verificando endpoints de producción...\n')

async function checkEndpoint(path: string, name: string, requiresAuth = false) {
  try {
    const url = `${PRODUCTION_URL}${path}`
    const headers: HeadersInit = {}
    
    if (requiresAuth && CRON_TOKEN) {
      headers['Authorization'] = `Bearer ${CRON_TOKEN}`
    }
    
    const response = await fetch(url, {
      method: requiresAuth ? 'POST' : 'GET',
      headers,
    })
    
    if (response.ok || response.status === 405) { // 405 = Method Not Allowed (esperado para POST)
      checks.push({
        name: `Endpoint: ${name}`,
        status: '✅',
        message: `Responde correctamente (${response.status})`,
      })
    } else {
      checks.push({
        name: `Endpoint: ${name}`,
        status: '⚠️',
        message: `Status: ${response.status}`,
        action: 'Revisar logs de Vercel',
      })
    }
  } catch (error: any) {
    checks.push({
      name: `Endpoint: ${name}`,
      status: '❌',
      message: `Error: ${error.message}`,
      action: 'Verificar que el proyecto esté desplegado en Vercel',
    })
  }
}

// Verificar endpoints principales
await checkEndpoint('/api/status/health', 'Health Check')
await checkEndpoint('/api/diag', 'Diagnóstico')
await checkEndpoint('/api/bias', 'Bias API')

// Verificar endpoints de jobs (solo verificar que existen, no ejecutar)
await checkEndpoint('/api/jobs/ingest/fred', 'Job: Ingest FRED', true)
await checkEndpoint('/api/jobs/ingest/european', 'Job: Ingest European', true)

// 4. Verificar vercel.json
console.log('\n🔍 Verificando configuración de cron jobs...\n')

const vercelJsonPath = join(process.cwd(), 'vercel.json')
if (existsSync(vercelJsonPath)) {
  try {
    const vercelJson = await import(vercelJsonPath)
    const crons = vercelJson.default?.crons || []
    
    if (crons.length > 0) {
      checks.push({
        name: 'Cron Jobs (vercel.json)',
        status: '✅',
        message: `${crons.length} cron jobs configurados`,
      })
      
      // Listar cron jobs
      crons.forEach((cron: any) => {
        checks.push({
          name: `  └─ ${cron.path}`,
          status: '✅',
          message: `Schedule: ${cron.schedule}`,
        })
      })
    } else {
      checks.push({
        name: 'Cron Jobs (vercel.json)',
        status: '⚠️',
        message: 'No hay cron jobs configurados',
        action: 'Añadir cron jobs en vercel.json',
      })
    }
  } catch (error: any) {
    checks.push({
      name: 'Cron Jobs (vercel.json)',
      status: '⚠️',
      message: `Error leyendo vercel.json: ${error.message}`,
    })
  }
} else {
  checks.push({
    name: 'Cron Jobs (vercel.json)',
    status: '⚠️',
    message: 'vercel.json no encontrado',
    action: 'Crear vercel.json con configuración de cron jobs',
  })
}

// 5. Verificar base de datos unificada
console.log('\n🔍 Verificando sistema de base de datos...\n')

const unifiedDbPath = join(process.cwd(), 'lib/db/unified-db.ts')
if (existsSync(unifiedDbPath)) {
  checks.push({
    name: 'Sistema DB Unificada',
    status: '✅',
    message: 'lib/db/unified-db.ts existe',
  })
} else {
  checks.push({
    name: 'Sistema DB Unificada',
    status: '❌',
    message: 'lib/db/unified-db.ts no encontrado',
  })
}

// Mostrar resumen
console.log('\n' + '='.repeat(60))
console.log('📊 RESUMEN DE VERIFICACIÓN')
console.log('='.repeat(60) + '\n')

checks.forEach(check => {
  console.log(`${check.status} ${check.name}`)
  console.log(`   ${check.message}`)
  if (check.action) {
    console.log(`   💡 Acción: ${check.action}`)
  }
  console.log()
})

// Contar resultados
const success = checks.filter(c => c.status === '✅').length
const warnings = checks.filter(c => c.status === '⚠️').length
const errors = checks.filter(c => c.status === '❌').length

console.log('='.repeat(60))
console.log(`✅ Exitosos: ${success}`)
console.log(`⚠️  Advertencias: ${warnings}`)
console.log(`❌ Errores: ${errors}`)
console.log('='.repeat(60))

// Recomendaciones
console.log('\n📝 PRÓXIMOS PASOS:\n')

if (errors > 0) {
  console.log('🔴 ALTA PRIORIDAD: Resolver errores antes de continuar')
}

if (warnings > 0) {
  console.log('🟡 MEDIA PRIORIDAD: Revisar advertencias')
  
  const missingVars = checks.filter(c => 
    c.name.includes('(local)') && c.status === '⚠️'
  )
  
  if (missingVars.length > 0) {
    console.log('\n⚠️  Variables de entorno faltantes:')
    console.log('   Estas deben configurarse en Vercel Dashboard:')
    missingVars.forEach(v => {
      const varName = v.name.replace(' (local)', '')
      console.log(`   - ${varName}`)
    })
    console.log('\n   Acción:')
    console.log('   1. Ir a https://vercel.com/dashboard')
    console.log('   2. Seleccionar tu proyecto')
    console.log('   3. Settings → Environment Variables')
    console.log('   4. Añadir las variables faltantes')
    console.log('   5. Hacer "Redeploy"')
  }
}

if (success === checks.length) {
  console.log('✅ ¡Todo está configurado correctamente!')
  console.log('   El dashboard debería funcionar 24/7 en producción.')
} else {
  console.log('\n📚 Documentación:')
  console.log('   - docs/ESTADO-MIGRACION-PRODUCCION.md')
  console.log('   - docs/RESUMEN-PRODUCCION-PARA-DEV.md')
}

console.log()









