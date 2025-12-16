/**
 * Script para ejecutar jobs de producción en batch mode
 * Ejecuta FRED → Assets → Bias en orden, continuando hasta done: true
 * 
 * Uso:
 *   pnpm tsx scripts/run-production-jobs.ts <PRODUCTION_URL> <CRON_TOKEN>
 * 
 * Ejemplo:
 *   pnpm tsx scripts/run-production-jobs.ts https://macro-dashboard.vercel.app Trading11!
 */

const PRODUCTION_URL = process.argv[2] || process.env.PRODUCTION_URL
const CRON_TOKEN = process.argv[3] || process.env.CRON_TOKEN || 'cbc3d1139031a75f4721ddb45bf8cca4a79b115d4c15ba83e1a1713898cdbc82'

if (!PRODUCTION_URL) {
  console.error('❌ Error: PRODUCTION_URL no especificada')
  console.error('   Uso: pnpm tsx scripts/run-production-jobs.ts <URL> [CRON_TOKEN]')
  console.error('   Ejemplo: pnpm tsx scripts/run-production-jobs.ts https://macro-dashboard.vercel.app Trading11!')
  process.exit(1)
}

interface JobResponse {
  success: boolean
  job: string
  processed: number
  nextCursor?: string | null
  done: boolean
  durationMs: number
  error?: string
}

async function executeJob(
  jobName: string,
  endpoint: string,
  batchSize: number,
  cursor?: string | null,
  reset: boolean = false
): Promise<JobResponse | null> {
  const params = new URLSearchParams()
  params.set('batch', batchSize.toString())
  if (reset) {
    params.set('reset', 'true')
  } else if (cursor) {
    params.set('cursor', cursor)
  }

  const url = `${PRODUCTION_URL}${endpoint}?${params.toString()}`
  
  console.log(`\n🔄 Ejecutando ${jobName}...`)
  console.log(`   URL: ${endpoint}`)
  if (reset) {
    console.log(`   ⚠️  RESET: true (reiniciando desde el principio)`)
  } else if (cursor) {
    console.log(`   📍 Continuando desde cursor: ${cursor}`)
  } else {
    console.log(`   🆕 Iniciando nuevo batch`)
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const text = await response.text()
      // Si es timeout 504, el cursor ya está guardado, podemos continuar
      if (response.status === 504) {
        console.log(`   ⚠️  Timeout 504 - El cursor ya está guardado en DB`)
        console.log(`   ✅ Continuaremos con el siguiente batch`)
        return null // Retornar null indica timeout pero podemos continuar
      }
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    const data = await response.json() as JobResponse
    
    console.log(`   ✅ Procesados: ${data.processed}`)
    console.log(`   ⏱️  Duración: ${(data.durationMs / 1000).toFixed(1)}s`)
    console.log(`   📊 Estado: ${data.done ? '✅ COMPLETADO' : '⏳ EN PROGRESO'}`)
    
    if (data.nextCursor) {
      console.log(`   📍 Siguiente cursor: ${data.nextCursor}`)
    }

    if (data.error) {
      console.error(`   ⚠️  Error: ${data.error}`)
    }

    return data
  } catch (error: any) {
    // Si es timeout, el cursor ya está guardado
    if (error.message?.includes('504') || error.message?.includes('TIMEOUT')) {
      console.log(`   ⚠️  Timeout detectado - El cursor ya está guardado en DB`)
      console.log(`   ✅ Continuaremos con el siguiente batch`)
      return null
    }
    console.error(`   ❌ Error al ejecutar ${jobName}:`, error.message)
    throw error
  }
}

async function runJobUntilComplete(
  jobName: string,
  endpoint: string,
  batchSize: number,
  reset: boolean = false
): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🚀 INICIANDO: ${jobName}`)
  console.log(`${'='.repeat(60)}`)

  let cursor: string | null = null
  let iteration = 0
  let totalProcessed = 0
  let totalDuration = 0

  // Primera ejecución con reset
  if (reset) {
    iteration++
    const result = await executeJob(jobName, endpoint, batchSize, null, true)
    totalProcessed += result.processed
    totalDuration += result.durationMs
    cursor = result.nextCursor || null

    if (result.done) {
      console.log(`\n✅ ${jobName} completado en 1 iteración`)
      console.log(`   Total procesado: ${totalProcessed}`)
      console.log(`   Tiempo total: ${(totalDuration / 1000).toFixed(1)}s`)
      return
    }
  }

  // Continuar hasta done: true
  let consecutiveTimeouts = 0
  const MAX_CONSECUTIVE_TIMEOUTS = 3

  while (cursor !== null) {
    iteration++
    console.log(`\n   Iteración ${iteration}...`)
    
    const result = await executeJob(jobName, endpoint, batchSize, cursor, false)
    
    // Si es timeout, el cursor ya está guardado, continuamos con el mismo cursor
    if (result === null) {
      consecutiveTimeouts++
      console.log(`   ⚠️  Timeout ${consecutiveTimeouts}/${MAX_CONSECUTIVE_TIMEOUTS}`)
      
      if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
        console.log(`   ⚠️  Demasiados timeouts consecutivos. El cursor actual es: ${cursor}`)
        console.log(`   📋 Puedes continuar manualmente con este cursor`)
        throw new Error(`Demasiados timeouts consecutivos. Último cursor: ${cursor}`)
      }
      
      // Esperar un poco más antes de reintentar
      console.log(`   ⏳ Esperando 10s antes de reintentar...`)
      await new Promise(resolve => setTimeout(resolve, 10000))
      continue // Reintentar con el mismo cursor
    }

    // Resetear contador de timeouts si hay éxito
    consecutiveTimeouts = 0
    totalProcessed += result.processed
    totalDuration += result.durationMs
    cursor = result.nextCursor || null

    if (result.done) {
      console.log(`\n✅ ${jobName} completado en ${iteration} iteraciones`)
      console.log(`   Total procesado: ${totalProcessed}`)
      console.log(`   Tiempo total: ${(totalDuration / 1000).toFixed(1)}s`)
      return
    }

    // Pequeña pausa entre iteraciones para no saturar
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  // Si llegamos aquí sin done: true, algo está mal
  console.error(`\n⚠️  ${jobName} terminó sin done: true`)
  console.error(`   Último cursor: ${cursor}`)
  throw new Error(`${jobName} no completó correctamente`)
}

async function verifyJobState(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔍 VERIFICANDO ESTADO EN DB`)
  console.log(`${'='.repeat(60)}`)

  // Nota: Esta verificación requiere acceso a la DB
  // Por ahora solo mostramos un mensaje
  console.log(`\n📋 Para verificar en DB, ejecuta:`)
  console.log(`   SELECT job_name, cursor, last_run_status, last_run_duration_ms, updated_at`)
  console.log(`   FROM job_state`)
  console.log(`   ORDER BY updated_at DESC;`)
  console.log(`\n✅ Resultado esperado:`)
  console.log(`   - cursor: null`)
  console.log(`   - last_run_status: 'success'`)
  console.log(`   - Para todos los jobs: ingest_fred, ingest_assets, compute_bias`)
}

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🚀 EJECUTANDO JOBS DE PRODUCCIÓN EN BATCH MODE`)
  console.log(`${'='.repeat(60)}`)
  console.log(`\n📍 URL: ${PRODUCTION_URL}`)
  console.log(`🔐 Token: ${CRON_TOKEN.substring(0, 10)}...`)
  console.log(`\n⚠️  IMPORTANTE:`)
  console.log(`   - Orden: FRED → Assets → Bias`)
  console.log(`   - Cada job continuará hasta done: true`)
  console.log(`   - No ejecutar Bias hasta que FRED y Assets estén completos`)
  console.log(`\n⏳ Iniciando en 3 segundos...`)
  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    // 1. FRED (batch size 3 para evitar timeouts, según recomendación)
    await runJobUntilComplete(
      'FRED Ingestion',
      '/api/jobs/ingest/fred',
      3, // Batch size 3 según recomendación
      false // NO reset - continuar desde donde quedó
    )

    // 2. Assets
    await runJobUntilComplete(
      'Assets Ingestion',
      '/api/jobs/ingest/assets',
      2,
      true // reset
    )

    // 3. Bias (solo después de FRED y Assets)
    console.log(`\n${'='.repeat(60)}`)
    console.log(`⚠️  VERIFICANDO PREREQUISITOS PARA BIAS`)
    console.log(`${'='.repeat(60)}`)
    console.log(`\n✅ FRED completado`)
    console.log(`✅ Assets completado`)
    console.log(`\n🚀 Procediendo con Bias...`)

    await runJobUntilComplete(
      'Bias Computation',
      '/api/jobs/compute/bias',
      5,
      true // reset
    )

    // Verificación final
    await verifyJobState()

    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ TODOS LOS JOBS COMPLETADOS EXITOSAMENTE`)
    console.log(`${'='.repeat(60)}`)
    console.log(`\n📊 Resumen:`)
    console.log(`   ✅ FRED: Completado`)
    console.log(`   ✅ Assets: Completado`)
    console.log(`   ✅ Bias: Completado`)
    console.log(`\n🎯 Próximos pasos:`)
    console.log(`   1. Verificar job_state en DB`)
    console.log(`   2. Revisar dashboards en producción`)
    console.log(`   3. Verificar que no hay 504 en logs de Vercel`)

  } catch (error: any) {
    console.error(`\n${'='.repeat(60)}`)
    console.error(`❌ ERROR FATAL`)
    console.error(`${'='.repeat(60)}`)
    console.error(`\n${error.message}`)
    console.error(`\n🔍 Revisa:`)
    console.error(`   - URL de producción correcta`)
    console.error(`   - CRON_TOKEN válido`)
    console.error(`   - Logs de Vercel para más detalles`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌ Error fatal:', err)
  process.exit(1)
})

