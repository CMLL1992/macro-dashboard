#!/usr/bin/env tsx
/**
 * Script para actualizar todos los datos: FRED, correlaciones y bias
 * Lee el CRON_TOKEN del .env.local y llama a los endpoints
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

const APP_URL = process.env.APP_URL || 'http://localhost:3000'
const CRON_TOKEN = process.env.CRON_TOKEN

if (!CRON_TOKEN) {
  console.error('❌ CRON_TOKEN no encontrado en .env.local')
  process.exit(1)
}

async function callEndpoint(endpoint: string, name: string) {
  console.log(`\n🔄 ${name}...`)
  console.log(`📍 URL: ${APP_URL}${endpoint}`)
  
  try {
    const response = await fetch(`${APP_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log(`✅ ${name} completado`)
      if (data.ingested !== undefined) {
        console.log(`   - Series actualizadas: ${data.ingested}`)
        console.log(`   - Errores: ${data.errors || 0}`)
      }
      if (data.updatedPairsCount !== undefined) {
        console.log(`   - Pares actualizados: ${data.updatedPairsCount}`)
      }
      if (data.duration_ms !== undefined) {
        console.log(`   - Duración: ${data.duration_ms}ms`)
      }
      return true
    } else {
      console.error(`❌ Error en ${name}:`, data)
      return false
    }
  } catch (error) {
    console.error(`❌ Error al llamar al endpoint ${name}:`, error)
    return false
  }
}

async function updateAll() {
  console.log('🚀 Actualizando todos los datos del dashboard...\n')
  
  // 1. Actualizar datos FRED
  const fredOk = await callEndpoint('/api/jobs/ingest/fred', 'Actualizando datos FRED')
  if (!fredOk) {
    console.error('❌ Falló la actualización de FRED, abortando...')
    process.exit(1)
  }
  
  // Esperar un poco entre llamadas
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 2. Calcular correlaciones
  const corrOk = await callEndpoint('/api/jobs/correlations', 'Calculando correlaciones')
  if (!corrOk) {
    console.warn('⚠️ Falló la actualización de correlaciones, continuando...')
  }
  
  // Esperar un poco entre llamadas
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // 3. Calcular bias
  const biasOk = await callEndpoint('/api/jobs/compute/bias', 'Calculando bias macro')
  if (!biasOk) {
    console.warn('⚠️ Falló la actualización de bias, continuando...')
  }
  
  console.log('\n✅ Actualización completada!')
  console.log(`📅 Verifica el dashboard en: ${APP_URL}/dashboard`)
}

updateAll()


