#!/usr/bin/env tsx
/**
 * Script para actualizar datos FRED ahora mismo
 * Lee el CRON_TOKEN del .env.local y llama al endpoint
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

async function updateFred() {
  console.log('🔄 Actualizando datos FRED...')
  console.log(`📍 URL: ${APP_URL}/api/jobs/ingest/fred`)
  
  try {
    const response = await fetch(`${APP_URL}/api/jobs/ingest/fred`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    if (response.ok) {
      console.log('✅ Datos FRED actualizados correctamente')
      console.log(`   - Series actualizadas: ${data.ingested || 0}`)
      console.log(`   - Errores: ${data.errors || 0}`)
      console.log(`   - Duración: ${data.duration_ms || 0}ms`)
      console.log(`   - Finalizado: ${data.finishedAt || 'N/A'}`)
    } else {
      console.error('❌ Error actualizando datos FRED:', data)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error al llamar al endpoint:', error)
    process.exit(1)
  }
}

updateFred()

