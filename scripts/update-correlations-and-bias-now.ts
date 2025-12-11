#!/usr/bin/env tsx
/**
 * Script para actualizar solo correlaciones y bias macro.
 * Reutiliza APP_URL y CRON_TOKEN desde .env.local igual que update-all-now.ts
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
        Authorization: `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`✅ ${name} completado`)
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

async function updateCorrelationsAndBias() {
  console.log('🚀 Actualizando correlaciones y bias macro...\n')

  // 1. Correlaciones
  const corrOk = await callEndpoint(
    '/api/jobs/correlations',
    'Calculando correlaciones',
  )

  if (!corrOk) {
    console.error('❌ Falló la actualización de correlaciones')
  }

  // Pequeña pausa
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // 2. Bias macro
  const biasOk = await callEndpoint(
    '/api/jobs/compute/bias',
    'Calculando bias macro',
  )

  if (!biasOk) {
    console.error('❌ Falló la actualización de bias macro')
  }

  if (corrOk && biasOk) {
    console.log('\n✅ Correlaciones y bias actualizados correctamente')
    console.log(`📅 Verifica el dashboard en: ${APP_URL}/dashboard`)
  } else {
    console.log('\n⚠️ Hubo errores en alguno de los jobs (ver logs arriba)')
  }
}

updateCorrelationsAndBias()














