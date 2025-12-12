#!/usr/bin/env tsx

/**
 * Script para ejecutar el job de limpieza de pares
 * Elimina pares no incluidos en tactical-pairs.json de la base de datos
 * 
 * Uso:
 *   CRON_TOKEN=tu_token tsx scripts/cleanup-pairs.ts
 *   O
 *   tsx scripts/cleanup-pairs.ts tu_token
 */

const BASE_URL = 'https://macro-dashboard-seven.vercel.app'
const CRON_TOKEN = process.argv[2] || process.env.CRON_TOKEN

if (!CRON_TOKEN) {
  console.error('❌ Error: CRON_TOKEN no proporcionado')
  console.error('Uso: CRON_TOKEN=tu_token tsx scripts/cleanup-pairs.ts')
  console.error('O: tsx scripts/cleanup-pairs.ts tu_token')
  process.exit(1)
}

interface CleanupResponse {
  success: boolean
  job: string
  startedAt: string
  finishedAt: string
  duration_ms: number
  deleted: {
    pair_signals: number
    correlations: number
    correlations_history: number
  }
  allowedSymbols: string[]
  error?: string
}

async function runCleanup() {
  console.log('🧹 Ejecutando limpieza de pares en producción')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   CRON_TOKEN: ${CRON_TOKEN ? CRON_TOKEN.substring(0, 8) + '...' : 'NOT SET'}`)
  console.log('')

  try {
    const response = await fetch(`${BASE_URL}/api/jobs/cleanup/pairs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await response.json() as CleanupResponse
    const status = response.status

    console.log(`   Status: ${status}`)
    console.log('')

    if (status === 200 && body.success) {
      console.log('✅ Limpieza completada exitosamente')
      console.log('')
      console.log('📊 Resultados:')
      console.log(`   pair_signals eliminados: ${body.deleted.pair_signals}`)
      console.log(`   correlations eliminadas: ${body.deleted.correlations}`)
      console.log(`   correlations_history eliminadas: ${body.deleted.correlations_history}`)
      console.log(`   Duración: ${body.duration_ms}ms`)
      console.log('')
      console.log(`   Pares permitidos (${body.allowedSymbols.length}):`)
      body.allowedSymbols.forEach(symbol => {
        console.log(`     - ${symbol}`)
      })
    } else {
      console.log(`❌ Error: ${body.error || 'Unknown error'}`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`❌ Request failed:`, error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

runCleanup()
