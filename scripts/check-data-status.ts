/**
 * Script para verificar el estado de los datos en la base de datos
 * Llama a /api/health y muestra un resumen detallado
 */

const BASE_URL = process.env.APP_URL || 'https://macro-dashboard-seven.vercel.app'

async function checkHealth() {
  try {
    console.log('🔍 Verificando estado de los datos...\n')
    console.log(`📍 URL: ${BASE_URL}\n`)

    const response = await fetch(`${BASE_URL}/api/health`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error(`❌ Error ${response.status}: ${response.statusText}`)
      const text = await response.text()
      console.error(`   Respuesta: ${text}`)
      return
    }

    const data = await response.json()

    console.log('='.repeat(60))
    console.log('📊 ESTADO DE LOS DATOS')
    console.log('='.repeat(60))
    console.log(`\n📈 Observaciones Macro:`)
    console.log(`   Total: ${data.observationCount || 0}`)
    console.log(`   Última fecha: ${data.latestDate || 'N/A'}`)
    
    console.log(`\n📊 Bias:`)
    console.log(`   Registros: ${data.biasCount || 0}`)
    
    console.log(`\n🔗 Correlaciones:`)
    console.log(`   Total: ${data.correlationCount || 0}`)
    
    console.log(`\n💾 Base de datos:`)
    console.log(`   Estado: ${data.hasData ? '✅ Con datos' : '❌ Sin datos'}`)
    
    // Interpretación
    console.log('\n' + '='.repeat(60))
    console.log('📋 INTERPRETACIÓN')
    console.log('='.repeat(60))
    
    if (data.observationCount === 0) {
      console.log('❌ PROBLEMA: No hay observaciones macro')
      console.log('   → Los endpoints /api/jobs/ingest/fred no están ingiriendo datos')
      console.log('   → Verifica: CRON_TOKEN, FRED_API_KEY, APP_URL')
    } else if (data.biasCount === 0) {
      console.log('⚠️  PROBLEMA: Hay observaciones pero no hay bias calculado')
      console.log('   → Ejecuta: /api/jobs/compute/bias')
    } else if (data.correlationCount === 0) {
      console.log('⚠️  PROBLEMA: No hay correlaciones calculadas')
      console.log('   → Ejecuta: /api/jobs/correlations')
    } else {
      console.log('✅ Los datos están presentes')
      if (data.latestDate) {
        const latestDate = new Date(data.latestDate)
        const daysAgo = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysAgo > 7) {
          console.log(`⚠️  ADVERTENCIA: Última fecha es de hace ${daysAgo} días`)
          console.log('   → Los datos pueden estar desactualizados')
        } else {
          console.log(`✅ Datos recientes (última fecha: ${daysAgo} días atrás)`)
        }
      }
    }
    
    console.log('\n' + '='.repeat(60))
  } catch (error) {
    console.error('❌ Error verificando estado:', error)
    process.exit(1)
  }
}

checkHealth()




export {}
