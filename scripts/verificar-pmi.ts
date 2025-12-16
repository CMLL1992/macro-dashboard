/**
 * Script para verificar si el PMI se ingirió correctamente
 */

import { getDB } from '@/lib/db/schema'
import { getUnifiedDB, isUsingTurso } from '@/lib/db/unified-db'

async function verificarPMI() {
  console.log('🔍 Verificando datos de PMI (USPMI)...\n')

  if (isUsingTurso()) {
    const db = getUnifiedDB()
    
    // Verificar si existe la serie
    const series = await db.prepare('SELECT * FROM macro_series WHERE series_id = ?').get('USPMI')
    if (series) {
      console.log('✅ Serie USPMI encontrada en macro_series:')
      console.log('   - Source:', (series as any).source)
      console.log('   - Name:', (series as any).name)
      console.log('   - Frequency:', (series as any).frequency)
      console.log('   - Last Updated:', (series as any).last_updated)
    } else {
      console.log('❌ Serie USPMI NO encontrada en macro_series')
    }

    // Contar observaciones
    const countResult = await db.prepare('SELECT COUNT(1) as c FROM macro_observations WHERE series_id = ?').get('USPMI')
    const count = (countResult as { c: number }).c
    console.log(`\n📊 Observaciones de USPMI: ${count}`)

    if (count > 0) {
      // Obtener las últimas 5 observaciones
      const latest = await db.prepare(
        'SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5'
      ).all('USPMI')
      
      console.log('\n📈 Últimas 5 observaciones:')
      for (const row of latest as Array<{ date: string; value: number }>) {
        console.log(`   - ${row.date}: ${row.value}`)
      }
    }
  } else {
    const db = getDB()
    
    // Verificar si existe la serie
    const series = db.prepare('SELECT * FROM macro_series WHERE series_id = ?').get('USPMI') as any
    if (series) {
      console.log('✅ Serie USPMI encontrada en macro_series:')
      console.log('   - Source:', series.source)
      console.log('   - Name:', series.name)
      console.log('   - Frequency:', series.frequency)
      console.log('   - Last Updated:', series.last_updated)
    } else {
      console.log('❌ Serie USPMI NO encontrada en macro_series')
    }

    // Contar observaciones
    const count = db.prepare('SELECT COUNT(1) as c FROM macro_observations WHERE series_id = ?').get('USPMI') as { c: number }
    console.log(`\n📊 Observaciones de USPMI: ${count.c}`)

    if (count.c > 0) {
      // Obtener las últimas 5 observaciones
      const latest = db.prepare(
        'SELECT date, value FROM macro_observations WHERE series_id = ? ORDER BY date DESC LIMIT 5'
      ).all('USPMI') as Array<{ date: string; value: number }>
      
      console.log('\n📈 Últimas 5 observaciones:')
      for (const row of latest) {
        console.log(`   - ${row.date}: ${row.value}`)
      }
    }
  }
}

verificarPMI()
  .then(() => {
    console.log('\n✅ Verificación completada')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

















