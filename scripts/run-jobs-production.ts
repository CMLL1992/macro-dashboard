#!/usr/bin/env tsx

/**
 * Script para lanzar los jobs de ingesta en producción
 * 
 * Uso:
 *   CRON_TOKEN=tu_token tsx scripts/run-jobs-production.ts
 *   O
 *   tsx scripts/run-jobs-production.ts tu_token
 */

const BASE_URL = 'https://macro-dashboard-seven.vercel.app'
const CRON_TOKEN = process.argv[2] || process.env.CRON_TOKEN

if (!CRON_TOKEN) {
  console.error('❌ Error: CRON_TOKEN no proporcionado')
  console.error('Uso: CRON_TOKEN=tu_token tsx scripts/run-jobs-production.ts')
  console.error('O: tsx scripts/run-jobs-production.ts tu_token')
  process.exit(1)
}

interface JobResponse {
  success: boolean
  ingested?: number
  processed?: number
  computed?: number
  errors?: number
  duration_ms?: number
  finishedAt?: string
  error?: string
}

async function runJob(endpoint: string, name: string): Promise<{ status: number; body: JobResponse }> {
  console.log(`\n📊 ${name}...`)
  console.log(`   Endpoint: ${BASE_URL}${endpoint}`)
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await response.json() as JobResponse
    const status = response.status

    console.log(`   Status: ${status}`)
    
    if (status === 200 && body.success) {
      console.log(`   ✅ Success!`)
      if (body.ingested !== undefined) {
        console.log(`   📈 Ingested: ${body.ingested} series`)
      }
      if (body.processed !== undefined) {
        console.log(`   📈 Processed: ${body.processed} symbols`)
      }
      if (body.computed !== undefined) {
        console.log(`   📈 Computed: ${body.computed} assets`)
      }
      if (body.errors !== undefined && body.errors > 0) {
        console.log(`   ⚠️  Errors: ${body.errors}`)
      }
      if (body.duration_ms !== undefined) {
        console.log(`   ⏱️  Duration: ${body.duration_ms}ms`)
      }
    } else {
      console.log(`   ❌ Error: ${body.error || 'Unknown error'}`)
    }

    return { status, body }
  } catch (error) {
    console.error(`   ❌ Request failed:`, error instanceof Error ? error.message : String(error))
    return { status: 0, body: { success: false, error: error instanceof Error ? error.message : String(error) } }
  }
}

async function checkHealth() {
  console.log(`\n🔍 Verificando estado después de los jobs...`)
  
  try {
    const healthResponse = await fetch(`${BASE_URL}/api/health`)
    const health = await healthResponse.json() as any
    
    console.log(`\n📊 /api/health:`)
    console.log(`   hasData: ${health.hasData}`)
    console.log(`   observationCount: ${health.observationCount}`)
    console.log(`   biasCount: ${health.biasCount}`)
    console.log(`   correlationCount: ${health.correlationCount}`)
    console.log(`   latestDate: ${health.latestDate || 'null'}`)
    
    if (health.health) {
      console.log(`   health.hasObservations: ${health.health.hasObservations}`)
      console.log(`   health.hasBias: ${health.health.hasBias}`)
      console.log(`   health.hasCorrelations: ${health.health.hasCorrelations}`)
    }
  } catch (error) {
    console.error(`   ❌ Error checking health:`, error instanceof Error ? error.message : String(error))
  }
  
  try {
    const diagResponse = await fetch(`${BASE_URL}/api/diag`)
    const diag = await diagResponse.json() as any
    
    console.log(`\n🔬 /api/diag:`)
    console.log(`   lastIngestAt: ${diag.lastIngestAt || 'null'}`)
    console.log(`   lastWarmupResult: ${diag.lastWarmupResult || 'null'}`)
  } catch (error) {
    console.error(`   ❌ Error checking diag:`, error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  console.log('🚀 Lanzando jobs en producción')
  console.log(`   Base URL: ${BASE_URL}`)
  console.log(`   CRON_TOKEN: ${CRON_TOKEN ? CRON_TOKEN.substring(0, 8) + '...' : 'NOT SET'}`)

  const results = {
    fred: await runJob('/api/jobs/ingest/fred', '1. Ingest FRED'),
    correlations: await runJob('/api/jobs/correlations', '2. Calculate Correlations'),
    bias: await runJob('/api/jobs/compute/bias', '3. Compute Bias'),
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 RESUMEN:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  if (results.fred.status === 200 && results.fred.body.success) {
    console.log('✅ /api/jobs/ingest/fred: OK')
  } else {
    console.log(`❌ /api/jobs/ingest/fred: Error ${results.fred.status}`)
  }

  if (results.correlations.status === 200 && results.correlations.body.success) {
    console.log('✅ /api/jobs/correlations: OK')
  } else {
    console.log(`❌ /api/jobs/correlations: Error ${results.correlations.status}`)
  }

  if (results.bias.status === 200 && results.bias.body.success) {
    console.log('✅ /api/jobs/compute/bias: OK')
  } else {
    console.log(`❌ /api/jobs/compute/bias: Error ${results.bias.status}`)
  }

  // Esperar un poco antes de verificar (los jobs pueden tardar)
  console.log('\n⏳ Esperando 5 segundos antes de verificar estado...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  await checkHealth()

  console.log('\n✅ Proceso completado!')
}

main().catch(error => {
  console.error('❌ Error fatal:', error)
  process.exit(1)
})

