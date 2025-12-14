#!/usr/bin/env tsx
/**
 * Script de verificación completa del entorno local
 * Ejecuta todas las verificaciones necesarias para asegurar que local está al 100%
 */

// Cargar variables de entorno desde .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const CRON_TOKEN = process.env.CRON_TOKEN || ''

interface CheckResult {
  name: string
  passed: boolean
  message: string
  details?: string
}

const results: CheckResult[] = []

function addResult(name: string, passed: boolean, message: string, details?: string) {
  results.push({ name, passed, message, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${name}: ${message}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

async function checkEnvFile() {
  console.log('\n📋 Verificando archivo .env.local...')
  
  const envPath = join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) {
    addResult(
      'Archivo .env.local',
      false,
      'No existe',
      'Crea .env.local copiando desde .env.local.example'
    )
    return
  }

  addResult('Archivo .env.local', true, 'Existe')

  // Verificar variables críticas
  const requiredVars = [
    'FRED_API_KEY',
    'CRON_TOKEN',
    'APP_URL',
  ]

  const optionalVars = [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'INGEST_KEY',
  ]

  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      addResult(`Variable ${varName}`, false, 'No configurada', 'Variable obligatoria')
    } else {
      addResult(`Variable ${varName}`, true, 'Configurada')
    }
  }

  for (const varName of optionalVars) {
    const value = process.env[varName]
    if (value && value.trim() !== '') {
      addResult(`Variable ${varName}`, true, 'Configurada (opcional)')
    } else {
      addResult(`Variable ${varName}`, true, 'No configurada (opcional, OK)')
    }
  }
}

async function checkDatabase() {
  console.log('\n🗄️  Verificando conexión a base de datos...')
  
  try {
    // Importar dinámicamente para evitar errores si el módulo no está disponible
    const { getUnifiedDB, isUsingTurso } = await import('../lib/db/unified-db')
    
    const usingTurso = isUsingTurso()
    addResult(
      'Tipo de base de datos',
      true,
      usingTurso ? 'Turso' : 'SQLite local'
    )

    const db = getUnifiedDB()
    const testResult = await db.prepare('SELECT 1 as test').get() as { test: number } | undefined
    
    if (testResult?.test === 1) {
      addResult('Conexión a BD', true, 'Conexión exitosa')
    } else {
      addResult('Conexión a BD', false, 'Test SELECT 1 falló')
    }

    // Verificar tablas
    const tablesResult = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    addResult('Tablas en BD', true, `${tablesResult.length} tablas encontradas`)

    // Verificar datos
    const obsCount = await db.prepare('SELECT COUNT(1) as c FROM macro_observations').get() as { c: number } | undefined
    const count = obsCount?.c || 0
    
    if (count > 0) {
      addResult('Datos en BD', true, `${count} observaciones encontradas`)
    } else {
      addResult('Datos en BD', false, 'Base de datos vacía', 'Ejecuta: pnpm job:bootstrap')
    }

  } catch (error: any) {
    addResult('Conexión a BD', false, 'Error', error.message)
  }
}

async function checkEndpoints() {
  console.log('\n🔌 Verificando endpoints...')
  
  // Verificar que el servidor esté corriendo
  try {
    const response = await fetch(`${APP_URL}/api/health`)
    if (response.ok) {
      const data = await response.json()
      addResult('Endpoint /api/health', true, 'Responde correctamente')
      
      if (data.ready) {
        addResult('Datos en /api/health', true, 'ready: true')
      } else {
        addResult('Datos en /api/health', false, 'ready: false', 'Ejecuta jobs de ingesta')
      }
    } else {
      addResult('Endpoint /api/health', false, `Status ${response.status}`)
    }
  } catch (error: any) {
    addResult(
      'Endpoint /api/health',
      false,
      'No responde',
      `¿Está corriendo el servidor? (pnpm dev). Error: ${error.message}`
    )
    return // Si no hay servidor, no podemos verificar más endpoints
  }

  // Verificar /api/health/db
  try {
    const response = await fetch(`${APP_URL}/api/health/db`)
    if (response.ok) {
      const data = await response.json()
      if (data.ok) {
        addResult('Endpoint /api/health/db', true, 'BD conectada correctamente')
      } else {
        addResult('Endpoint /api/health/db', false, 'BD no conectada', data.error)
      }
    } else {
      addResult('Endpoint /api/health/db', false, `Status ${response.status}`)
    }
  } catch (error: any) {
    addResult('Endpoint /api/health/db', false, 'Error', error.message)
  }

  // Verificar /api/dashboard
  try {
    const response = await fetch(`${APP_URL}/api/dashboard`)
    if (response.ok) {
      const data = await response.json()
      const items = (Array.isArray(data) ? data : data.items || data.data?.items || []) as any[]
      if (Array.isArray(items) && items.length > 0) {
        addResult('Endpoint /api/dashboard', true, `${items.length} items`)
      } else {
        addResult('Endpoint /api/dashboard', false, 'Sin datos', 'Ejecuta jobs de ingesta')
      }
    } else {
      addResult('Endpoint /api/dashboard', false, `Status ${response.status}`)
    }
  } catch (error: any) {
    addResult('Endpoint /api/dashboard', false, 'Error', error.message)
  }

  // Verificar /api/bias
  try {
    const response = await fetch(`${APP_URL}/api/bias`)
    if (response.ok) {
      const data = await response.json()
      const table = (data.table || data.tableTactical || data.items || []) as any[]
      if (Array.isArray(table) && table.length > 0) {
        addResult('Endpoint /api/bias', true, `${table.length} sesgos`)
      } else {
        addResult('Endpoint /api/bias', false, 'Sin sesgos', 'Ejecuta: pnpm job:bias')
      }
    } else {
      addResult('Endpoint /api/bias', false, `Status ${response.status}`)
    }
  } catch (error: any) {
    addResult('Endpoint /api/bias', false, 'Error', error.message)
  }

  // Verificar /api/correlations
  try {
    const response = await fetch(`${APP_URL}/api/correlations`)
    if (response.ok) {
      const data = await response.json()
      const points = Array.isArray(data)
        ? data
        : (data.points || data.data?.points || []) as any[]
      const count = Array.isArray(points) ? points.length : 0
      if (count > 0) {
        addResult('Endpoint /api/correlations', true, `${count} correlaciones`)
      } else {
        addResult('Endpoint /api/correlations', false, 'Sin correlaciones', 'Ejecuta: pnpm job:correlations')
      }
    } else {
      addResult('Endpoint /api/correlations', false, `Status ${response.status}`)
    }
  } catch (error: any) {
    addResult('Endpoint /api/correlations', false, 'Error', error.message)
  }
}

async function checkScripts() {
  console.log('\n⚙️  Verificando scripts disponibles...')
  
  try {
    const packageJson = await import('../package.json')
    const scripts = packageJson.default.scripts || {}

    const requiredScripts = ['dev', 'build', 'start']
    const jobScripts = ['job:ingest:fred', 'job:correlations', 'job:bias', 'job:bootstrap']

    for (const script of requiredScripts) {
      if (scripts[script]) {
        addResult(`Script pnpm ${script}`, true, 'Disponible')
      } else {
        addResult(`Script pnpm ${script}`, false, 'No encontrado')
      }
    }

    for (const script of jobScripts) {
      if (scripts[script]) {
        addResult(`Script pnpm ${script}`, true, 'Disponible')
      } else {
        addResult(`Script pnpm ${script}`, false, 'No encontrado')
      }
    }
  } catch (error: any) {
    addResult('Scripts', false, 'Error al leer package.json', error.message)
  }
}

async function checkDataIntegrity() {
  console.log('\n🔍 Verificando integridad de datos (verificación rápida)...')
  
  try {
    // Verificar solo indicadores críticos para no saturar la API
    const { getUnifiedDB } = await import('../lib/db/unified-db')
    const db = getUnifiedDB()
    
    // Verificar NFP (payems_delta)
    const nfpObs = await db.prepare(
      `SELECT date, value FROM macro_observations 
       WHERE series_id = 'PAYEMS' 
       ORDER BY date DESC LIMIT 2`
    ).all() as Array<{ date: string; value: number }>
    
    if (nfpObs.length >= 2) {
      const latest = nfpObs[0]
      const previous = nfpObs[1]
      const delta = latest.value - previous.value
      
      if (delta === 0) {
        addResult('NFP Δ (payems_delta)', false, 'Valor placeholder detectado (0)', 'Debe mostrarse como "Dato pendiente"')
      } else {
        addResult('NFP Δ (payems_delta)', true, `Valor real: ${delta.toFixed(0)}K`)
      }
    } else {
      addResult('NFP Δ (payems_delta)', false, 'Sin datos suficientes')
    }
    
    // Verificar GDP QoQ
    const gdpObs = await db.prepare(
      `SELECT date, value FROM macro_observations 
       WHERE series_id = 'GDPC1' 
       ORDER BY date DESC LIMIT 2`
    ).all() as Array<{ date: string; value: number }>
    
    if (gdpObs.length >= 2) {
      const latest = gdpObs[0]
      const previous = gdpObs[1]
      const qoq = ((latest.value / previous.value) - 1) * 100
      const annualized = qoq * 4
      
      if (annualized === 0 || Math.abs(annualized) < 0.01) {
        addResult('GDP QoQ Anualizado', false, 'Valor placeholder sospechoso', 'Verificar con fuente oficial')
      } else {
        addResult('GDP QoQ Anualizado', true, `Valor: ${annualized.toFixed(2)}%`)
      }
    } else {
      addResult('GDP QoQ Anualizado', false, 'Sin datos suficientes')
    }
    
    // Verificar valores 0 en últimos puntos
    const zeroValues = await db.prepare(
      `SELECT series_id, date, value FROM macro_observations 
       WHERE value = 0 
       AND date = (SELECT MAX(date) FROM macro_observations WHERE series_id = macro_observations.series_id)
       AND series_id IN ('PAYEMS', 'GDPC1', 'UNRATE')
       LIMIT 10`
    ).all() as Array<{ series_id: string; date: string; value: number }>
    
    if (zeroValues.length > 0) {
      addResult('Valores placeholder detectados', false, `${zeroValues.length} indicadores con valor 0`, 
        `Series: ${zeroValues.map(v => v.series_id).join(', ')}`)
    } else {
      addResult('Valores placeholder detectados', true, 'No se detectaron placeholders')
    }
    
    addResult('Verificación de integridad', true, 'Verificación rápida completada', 
      'Ejecuta "pnpm verify:data" para verificación completa contra fuentes oficiales')
    
  } catch (error: any) {
    addResult('Verificación de integridad', false, 'Error', error.message)
  }
}

async function main() {
  console.log('🔍 Verificación Completa del Entorno Local')
  console.log('=' .repeat(60))

  await checkEnvFile()
  await checkDatabase()
  await checkEndpoints()
  await checkScripts()
  await checkDataIntegrity()

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN')
  console.log('='.repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  console.log(`✅ Pasadas: ${passed}/${total}`)
  console.log(`❌ Fallidas: ${failed}/${total}`)

  if (failed > 0) {
    console.log('\n⚠️  Verificaciones fallidas:')
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   ❌ ${r.name}: ${r.message}`)
      if (r.details) {
        console.log(`      ${r.details}`)
      }
    })
  }

  console.log('\n' + '='.repeat(60))
  
  if (failed === 0) {
    console.log('🎉 ¡Todo está funcionando correctamente!')
    console.log('✅ El entorno local está al 100%')
    console.log('🚀 Puedes proceder a desplegar a Vercel')
    process.exit(0)
  } else {
    console.log('⚠️  Hay verificaciones que necesitan atención')
    console.log('📋 Revisa el checklist en CHECKLIST-LOCAL.md')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Error fatal:', error)
  process.exit(1)
})


